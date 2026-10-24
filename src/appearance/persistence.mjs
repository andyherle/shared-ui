import {validateRegistry, validateOverrides} from './schema.mjs';

function failure(code, message) {return Object.assign(new Error(message), {code});}
function ownObject(value, keys) {
  if (!value || typeof value !== 'object' || Array.isArray(value) ||
      Object.keys(value).some(key => !keys.includes(key))) throw failure('INVALID_PATCH', 'Invalid appearance patch.');
}

/** Portable values only: registrations and selectors remain reviewed application source. */
export function createAppearancePatch(registry, overrides) {
  registry = validateRegistry(registry);
  return {schemaVersion: 1, registryId: registry.id, registryRevision: registry.revision,
    overrides: validateOverrides(registry, overrides)};
}
export function parseAppearancePatch(registry, input) {
  registry = validateRegistry(registry);
  if (typeof input === 'string') {
    if (new TextEncoder().encode(input).length > 131072) throw failure('INVALID_PATCH', 'Appearance patch is too large.');
    try {input = JSON.parse(input);} catch {throw failure('INVALID_PATCH', 'Use an appearance JSON patch.');}
  }
  ownObject(input, ['schemaVersion', 'registryId', 'registryRevision', 'overrides']);
  if (input.schemaVersion !== 1 || input.registryId !== registry.id || input.registryRevision !== registry.revision)
    throw failure('REGISTRY_MISMATCH', 'This patch belongs to a different module registration. Keep it for review; it was not applied.');
  return createAppearancePatch(registry, input.overrides);
}
export function serializeAppearancePatch(registry, overrides) {
  return JSON.stringify(createAppearancePatch(registry, overrides), null, 2) + '\n';
}

/** Explicit saves use a single IndexedDB read/write transaction across tabs.
 * No storage/network operation occurs in the preview path.
 */
export function createLocalAppearancePersistence({registry, indexedDB = globalThis.indexedDB,
    databaseName = 'shared-ui-appearance'} = {}) {
  registry = validateRegistry(registry);
  if (typeof databaseName !== 'string' || !/^[a-z0-9-]{1,80}$/.test(databaseName)) throw failure('INVALID_STORAGE', 'Invalid appearance storage name.');
  const key = registry.id;
  let opening, disposed = false;
  const unavailable = () => failure('STORAGE_UNAVAILABLE', 'Local profile storage is unavailable. Export the patch to keep your changes.');
  function open() {
    if (disposed) return Promise.reject(unavailable());
    if (!indexedDB) return Promise.reject(unavailable());
    if (!opening) opening = new Promise((resolve, reject) => {
      let request;
      try {request = indexedDB.open(databaseName, 1);} catch {reject(unavailable()); return;}
      let failed = false;
      request.onupgradeneeded = () => {
        if (!request.result.objectStoreNames.contains('profiles')) request.result.createObjectStore('profiles', {keyPath: 'key'});
      };
      request.onerror = () => {failed = true; reject(unavailable());};
      request.onblocked = () => {failed = true; reject(failure('STORAGE_BLOCKED', 'Close an older Appearance editor tab, then reload this page. Your preview has not been saved.'));};
      request.onsuccess = () => {
        const db = request.result;
        if (failed || disposed) {db.close(); reject(unavailable()); return;}
        db.onversionchange = () => {db.close(); opening = undefined;};
        resolve(db);
      };
    }).catch(error => {opening = undefined; throw error;});
    return opening;
  }
  function readRecord(record) {
    if (record === undefined) return {overrides: {}, revision: 0};
    ownObject(record, ['key', 'revision', 'patch']);
    if (record.key !== key || !Number.isSafeInteger(record.revision) || record.revision < 1) throw failure('INVALID_STORAGE', 'Saved appearance profile is invalid. Export the current preview before recovering the profile.');
    return {overrides: parseAppearancePatch(registry, record.patch).overrides, revision: record.revision};
  }
  async function transaction(mode, update) {
    const db = await open();
    return new Promise((resolve, reject) => {
      let tx, result, problem;
      try {tx = db.transaction('profiles', mode);} catch {reject(unavailable()); return;}
      const store = tx.objectStore('profiles');
      const request = store.get(key);
      request.onsuccess = () => {
        try {
          const current = readRecord(request.result);
          result = update ? update(current, store) : current;
        } catch (error) {problem = error; tx.abort();}
      };
      request.onerror = () => {problem = unavailable();};
      tx.oncomplete = () => resolve(result);
      tx.onabort = () => reject(problem ?? unavailable());
      tx.onerror = () => {problem ??= unavailable();};
    });
  }
  return Object.freeze({
    load: () => transaction('readonly'),
    save(overrides, {expectedRevision} = {}) {
      const patch = createAppearancePatch(registry, overrides);
      if (!Number.isSafeInteger(expectedRevision) || expectedRevision < 0) return Promise.reject(failure('INVALID_REVISION', 'Read the saved profile before saving.'));
      return transaction('readwrite', (current, store) => {
        if (current.revision !== expectedRevision) throw failure('REVISION_CONFLICT', 'Another tab saved this profile. Your preview is intact. Export it or load the saved profile before choosing what to keep.');
        if (current.revision >= Number.MAX_SAFE_INTEGER) throw failure('INVALID_REVISION', 'Profile revision limit reached.');
        const revision = current.revision + 1;
        store.put({key, revision, patch});
        return {overrides: patch.overrides, revision};
      });
    },
    async close() {disposed = true; if (opening) {try {(await opening).close();} catch {}}}
  });
}
