import test from 'node:test';
import assert from 'node:assert/strict';
import {createAppearancePatch, parseAppearancePatch, serializeAppearancePatch, createLocalAppearancePersistence} from '../src/appearance/persistence.mjs';

const registry = {schemaVersion: 1, id: 'test-appearance', revision: 1, modules: [
  {id: 'test.panel', label: 'Panel', selector: '#testPanel', controls: [{property: '--test-width', label: 'Width', type: 'length', unit: 'px', min: 100, max: 500, default: '200px'}]},
  {id: 'test.grip', label: 'Grip', selector: '#testGrip', controls: [{property: '--test-opacity', label: 'Opacity', type: 'number', min: 0, max: 1, default: '0.5'}]}
]};
const patch = {'test.panel': {'--test-width': '280px'}, 'test.grip': {'--test-opacity': '0.4'}};

// Independent transactional fake: transactions from separate connections are
// serialized and only committed on completion, as required by the IDB adapter.
function database() {
  const rows = new Map(); let queue = Promise.resolve();
  const api = {
    rows,
    open() {
      const request = {};
      queueMicrotask(() => {
        request.result = {
          objectStoreNames: {contains: () => true}, close() {},
          transaction() {
            const tx = {}; let release, aborted = false, ended = false;
            const before = queue; queue = new Promise(resolve => {release = resolve;});
            const writes = [];
            const complete = () => {
              if (ended) return; ended = true;
              if (!aborted) {for (const [key, value] of writes) rows.set(key, structuredClone(value)); tx.oncomplete?.();}
              else tx.onabort?.();
              release();
            };
            tx.abort = () => {aborted = true; queueMicrotask(complete);};
            tx.objectStore = () => ({
              get(key) {
                const result = {};
                before.then(() => queueMicrotask(() => {
                  if (aborted) return complete();
                  result.result = rows.has(key) ? structuredClone(rows.get(key)) : undefined;
                  result.onsuccess?.();
                  queueMicrotask(complete);
                }));
                return result;
              },
              put(value) {writes.push([value.key, structuredClone(value)]);}
            });
            return tx;
          }
        };
        request.onsuccess?.();
      });
      return request;
    }
  };
  return api;
}

test('portable appearance patches contain only registered values and exact module identity', () => {
  const value = createAppearancePatch(registry, patch);
  assert.deepEqual(parseAppearancePatch(registry, serializeAppearancePatch(registry, patch)), value);
  assert.equal(value.registryId, registry.id); assert.equal(value.registryRevision, 1);
  assert.deepEqual(Object.keys(value).sort(), ['overrides', 'registryId', 'registryRevision', 'schemaVersion']);
  assert.throws(() => parseAppearancePatch({...registry, revision: 2}, value), /different module registration/);
  assert.throws(() => parseAppearancePatch(registry, {...value, selector: 'body'}), /Invalid appearance patch/);
  assert.throws(() => parseAppearancePatch(registry, {...value, overrides: {'test.panel': {'--not-declared': '2px'}}}));
  assert.throws(() => parseAppearancePatch(registry, {...value, overrides: {'test.panel': {'--test-width': 'url(https://example.invalid)'}}}));
  assert.throws(() => parseAppearancePatch(registry, ' '.repeat(131073)), /too large/);
});

test('one save persists both modules; a separate connection reloads exactly that revision', async () => {
  const idb = database(), first = createLocalAppearancePersistence({registry, indexedDB: idb});
  assert.deepEqual(await first.load(), {overrides: {}, revision: 0});
  const saved = await first.save(patch, {expectedRevision: 0});
  assert.equal(saved.revision, 1); assert.deepEqual(saved.overrides, createAppearancePatch(registry, patch).overrides);
  const second = createLocalAppearancePersistence({registry, indexedDB: idb});
  assert.deepEqual(await second.load(), saved);
  await first.close(); await second.close();
});

test('two tabs saving the same old revision cannot silently overwrite one another', async () => {
  const idb = database(), a = createLocalAppearancePersistence({registry, indexedDB: idb}), b = createLocalAppearancePersistence({registry, indexedDB: idb});
  const results = await Promise.allSettled([a.save(patch, {expectedRevision: 0}), b.save({}, {expectedRevision: 0})]);
  assert.equal(results.filter(value => value.status === 'fulfilled').length, 1);
  const rejected = results.find(value => value.status === 'rejected');
  assert.equal(rejected.reason.code, 'REVISION_CONFLICT');
  assert.deepEqual((await b.load()).overrides, createAppearancePatch(registry, patch).overrides);
  assert.equal((await b.load()).revision, 1);
  await a.close(); await b.close();
});

test('corrupt or mismatched saved profiles are kept for recovery and never silently replaced', async () => {
  const idb = database();
  idb.rows.set(registry.id, {key: registry.id, revision: 3, patch: {...createAppearancePatch(registry, patch), registryRevision: 2}});
  const persistence = createLocalAppearancePersistence({registry, indexedDB: idb});
  await assert.rejects(persistence.load(), error => error.code === 'REGISTRY_MISMATCH');
  await assert.rejects(persistence.save({}, {expectedRevision: 3}), error => error.code === 'REGISTRY_MISMATCH');
  assert.equal(idb.rows.get(registry.id).revision, 3);
  await persistence.close();
});

test('blocked storage does not report success or fall back to an unversioned write', async () => {
  const persistence = createLocalAppearancePersistence({registry, indexedDB: null});
  await assert.rejects(persistence.load(), error => error.code === 'STORAGE_UNAVAILABLE');
  await assert.rejects(persistence.save(patch, {expectedRevision: 0}), error => error.code === 'STORAGE_UNAVAILABLE');
  assert.throws(() => createLocalAppearancePersistence({registry, databaseName: '../foreign'}), /Invalid appearance storage/);
  await persistence.close();
});
