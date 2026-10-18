import fs from 'node:fs';
import path from 'node:path';
import {randomUUID} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {json, object, requireThat, StudioError} from './validation.mjs';

const MAX_STORE_BYTES = 32 * 1024 * 1024;
const repositoryRoot = fs.realpathSync(fileURLToPath(new URL('../../', import.meta.url)));
const inside = (parent, child) => child === parent || child.startsWith(parent + path.sep);

/** A registered local directory, one atomic state file, one cross-process lock.
 * No command accepts a filename. Crashed locks are never silently stolen.
 */
export function openStore(directory, {writable = false} = {}) {
  requireThat(typeof directory === 'string' && path.isAbsolute(directory), 'Store directory must be absolute');
  const requested = path.resolve(directory);
  let ancestor = requested;
  while (!fs.existsSync(ancestor)) ancestor = path.dirname(ancestor);
  const prospective = path.resolve(fs.realpathSync(ancestor), path.relative(ancestor, requested));
  requireThat(!inside(repositoryRoot, prospective), 'Keep private Studio state outside the public repository');
  for (let parent = prospective; ; parent = path.dirname(parent)) {
    requireThat(!fs.existsSync(path.join(parent, '.git')), 'Keep private Studio state outside Git working trees');
    if (path.dirname(parent) === parent) break;
  }
  if (!fs.existsSync(requested)) {
    requireThat(writable, 'Store does not exist', 'STORE_NOT_FOUND');
    fs.mkdirSync(requested, {recursive: true, mode: 0o700});
  }
  const info = fs.lstatSync(requested);
  requireThat(info.isDirectory() && !info.isSymbolicLink(), 'Store root must be a real directory');
  const root = fs.realpathSync(requested), identity = {dev: info.dev, ino: info.ino};
  const statePath = path.join(root, 'studio.json'), lockPath = path.join(root, '.studio-lock');
  function checkRoot() {
    const current = fs.lstatSync(root);
    requireThat(current.isDirectory() && !current.isSymbolicLink() && current.dev === identity.dev && current.ino === identity.ino && fs.realpathSync(root) === root, 'Store root changed', 'UNSAFE_STORE');
  }
  function read() {
    checkRoot();
    let fd;
    try { fd = fs.openSync(statePath, fs.constants.O_RDONLY | fs.constants.O_NOFOLLOW); }
    catch (error) { if (error.code === 'ENOENT') return {schemaVersion: 1, documents: {}}; throw error; }
    try {
      const stat = fs.fstatSync(fd);
      requireThat(stat.isFile() && stat.nlink === 1 && stat.size <= MAX_STORE_BYTES, 'Invalid store file', 'UNSAFE_STORE');
      const state = json(JSON.parse(fs.readFileSync(fd, 'utf8')), MAX_STORE_BYTES);
      object(state, 'store', ['schemaVersion', 'documents', 'configurations']); requireThat(state.schemaVersion === 1, 'Unsupported store schema');
      object(state.documents, 'stored documents'); requireThat(Object.keys(state.documents).length <= 1000, 'Store document limit exceeded');
      if (state.configurations) {object(state.configurations, 'stored configurations'); requireThat(Object.keys(state.configurations).length <= 100, 'Store configuration limit exceeded');}
      return state;
    } finally { fs.closeSync(fd); }
  }
  function write(state) {
    checkRoot();
    const encoded = JSON.stringify(json(state, MAX_STORE_BYTES)) + '\n';
    const temporary = path.join(root, `.studio-${randomUUID()}.tmp`);
    let fd;
    try {
      fd = fs.openSync(temporary, fs.constants.O_CREAT | fs.constants.O_EXCL | fs.constants.O_WRONLY | fs.constants.O_NOFOLLOW, 0o600);
      fs.writeFileSync(fd, encoded); fs.fsyncSync(fd); fs.closeSync(fd); fd = undefined;
      checkRoot();
      if (fs.existsSync(statePath)) {
        const current = fs.lstatSync(statePath);
        requireThat(current.isFile() && !current.isSymbolicLink() && current.nlink === 1, 'Invalid store destination', 'UNSAFE_STORE');
      }
      fs.renameSync(temporary, statePath);
      const directoryFD = fs.openSync(root, fs.constants.O_RDONLY | fs.constants.O_NOFOLLOW);
      try { fs.fsyncSync(directoryFD); } finally { fs.closeSync(directoryFD); }
    } finally {
      if (fd !== undefined) fs.closeSync(fd);
      try { fs.unlinkSync(temporary); } catch (error) { if (error.code !== 'ENOENT') throw error; }
    }
  }
  return {
    read,
    transact(update) {
      requireThat(writable, 'This adapter has read-only permission', 'FORBIDDEN'); checkRoot();
      try { fs.mkdirSync(lockPath, {mode: 0o700}); }
      catch (error) {
        if (error.code === 'EEXIST') throw new StudioError('STORE_BUSY', 'Another writer holds the store lock. Retry after it finishes; inspect a persistent lock before manual recovery.');
        throw error;
      }
      try {
        const state = read(), {result, changed} = update(state);
        if (changed) write(state);
        return json(result);
      } finally { fs.rmdirSync(lockPath); }
    }
  };
}
