// One-way generated assets: validate every destination and stage every byte
// before replacing files. Callers supply validated content, in publication order.
import fs from 'node:fs';
import path from 'node:path';

function info(file) {
  try { return fs.lstatSync(file); }
  catch (error) { if (error.code !== 'ENOENT') throw error; return null; }
}
function directory(file) {
  const stat = info(file);
  if (stat && (!stat.isDirectory() || stat.isSymbolicLink()))
    throw new Error('Generated directory must be a real directory: ' + file);
}
function ordinary(file) {
  const stat = info(file);
  if (stat && (!stat.isFile() || stat.isSymbolicLink() || stat.nlink !== 1))
    throw new Error('Generated assets must be ordinary files: ' + file);
  return stat;
}

export function publishGeneratedFiles(target, files, {check = false, stale = 'Generated assets are out of date: '} = {}) {
  if (typeof target !== 'string' || !target.trim()) throw new Error('Pass a generated asset directory');
  target = path.resolve(target);
  directory(target);
  const entries = [...files].map(([name, content]) => {
    if (typeof name !== 'string' || name.includes('\\') || path.isAbsolute(name) ||
        name.split('/').some(part => !part || part === '.' || part === '..'))
      throw new Error('Generated asset names must stay inside their directory');
    let parent = target;
    for (const part of name.split('/').slice(0, -1)) { parent = path.join(parent, part); directory(parent); }
    const destination = path.join(target, name), stat = ordinary(destination);
    const bytes = Buffer.isBuffer(content) ? content : Buffer.from(content);
    return {name, destination, bytes, changed: !stat || !fs.readFileSync(destination).equals(bytes)};
  });
  const changed = entries.filter(entry => entry.changed);
  if (check && changed.length) throw new Error(stale + changed.map(entry => entry.name).join(', '));
  if (check || !changed.length) return changed.map(entry => entry.name);

  fs.mkdirSync(target, {recursive: true});
  directory(target);
  // Exclusive random staging avoids predictable .tmp symlinks and collisions.
  // Keep staging on the destination filesystem for atomic per-file renames.
  const stage = fs.mkdtempSync(path.join(target, '.shared-ui-stage-'));
  try {
    for (const [index, entry] of changed.entries())
      fs.writeFileSync(path.join(stage, String(index)), entry.bytes, {flag: 'wx', mode: 0o644});
    // Recheck all paths before the first replacement, including unchanged files.
    directory(target);
    for (const entry of entries) {
      let parent = target;
      for (const part of entry.name.split('/').slice(0, -1)) {
        parent = path.join(parent, part); directory(parent); fs.mkdirSync(parent, {recursive: true});
      }
      ordinary(entry.destination);
    }
    for (const [index, entry] of changed.entries()) fs.renameSync(path.join(stage, String(index)), entry.destination);
  } finally { fs.rmSync(stage, {recursive: true, force: true}); }
  return changed.map(entry => entry.name);
}
