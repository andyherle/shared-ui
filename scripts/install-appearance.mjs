#!/usr/bin/env node
/* Optional source modules, separate from the installed release quartet.
 * This command is an explicit one-time install; editing profile values never runs it.
 */
import fs from 'node:fs';
import path from 'node:path';
import {createHash, randomUUID} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {execFileSync} from 'node:child_process';

const repository = fileURLToPath(new URL('../', import.meta.url));
const source = fileURLToPath(new URL('../src/appearance/', import.meta.url));
export const APPEARANCE_FILES = Object.freeze(['schema.mjs', 'controller.mjs', 'persistence.mjs', 'editor.mjs', 'editor.css']);
const digest = bytes => createHash('sha256').update(bytes).digest('hex');
function realDirectory(requested, create = false) {
  const absolute = path.resolve(requested);
  const missing = [];
  let ancestor = absolute;
  while (!fs.existsSync(ancestor)) {missing.push(ancestor); ancestor = path.dirname(ancestor);}
  for (let current = ancestor; ; current = path.dirname(current)) {
    const info = fs.lstatSync(current);
    if (!info.isDirectory() || info.isSymbolicLink()) throw new Error('Appearance install requires real directories without symbolic links.');
    if (path.dirname(current) === current) break;
  }
  if (create) for (const dir of missing.reverse()) fs.mkdirSync(dir, {mode: 0o755});
  return absolute;
}
function readRegular(file, maximum = 262144) {
  const fd = fs.openSync(file, fs.constants.O_RDONLY | fs.constants.O_NOFOLLOW);
  try {
    const info = fs.fstatSync(fd);
    if (!info.isFile() || info.nlink !== 1 || info.size > maximum) throw new Error('Appearance assets must be bounded regular files.');
    return fs.readFileSync(fd);
  } finally {fs.closeSync(fd);}
}
export function installAppearance(target, {check = false, sourceRevision} = {}) {
  if (typeof target !== 'string' || !path.isAbsolute(target) || path.basename(target) !== 'appearance')
    throw new Error('Pass an absolute --target ending in /shared-ui/appearance (or a dedicated /appearance asset directory).');
  if (!/^[0-9a-f]{40}$/.test(sourceRevision ?? '')) throw new Error('Pass the exact full --source-revision of this reviewed shared-ui source.');
  target = realDirectory(target);
  if (target === path.resolve(source) || target.startsWith(path.resolve(source) + path.sep)) throw new Error('The install target cannot be the source directory.');
  const head = execFileSync('git', ['-C', repository, 'rev-parse', '--verify', 'HEAD'], {encoding: 'utf8'}).trim();
  if (head !== sourceRevision) throw new Error('Source revision does not match the reviewed checkout HEAD.');
  const files = new Map(APPEARANCE_FILES.map(name => {
    const bytes = readRegular(path.join(source, name));
    const pinned = execFileSync('git', ['-C', repository, 'show', sourceRevision + ':src/appearance/' + name], {maxBuffer: 262144});
    if (!bytes.equals(pinned)) throw new Error('Appearance source differs from its pinned commit: ' + name);
    return [name, bytes];
  }));
  const hashes = Object.fromEntries([...files].map(([name, bytes]) => [name, digest(bytes)]));
  const metadata = {protocol: 'shared-ui-appearance-assets-v1', sourceRevision, files: hashes};
  files.set('appearance-bundle.json', Buffer.from(JSON.stringify(metadata, null, 2) + '\n'));
  const changed = [];
  for (const [name, bytes] of files) {
    const destination = path.join(target, name);
    if (!fs.existsSync(destination) || !readRegular(destination).equals(bytes)) changed.push(name);
  }
  if (check && changed.length) throw new Error('Appearance assets differ: ' + changed.join(', '));
  if (!check && changed.length) {
    realDirectory(target, true);
    // Write all reviewed sources before the descriptive manifest. Never write
    // baseline styles.css/runtime.js/icons.svg/manifest.json or an arbitrary path.
    for (const name of changed) {
      const destination = path.join(target, name), temporary = path.join(target, '.' + name + '.' + randomUUID() + '.tmp');
      try {
        const fd = fs.openSync(temporary, fs.constants.O_WRONLY | fs.constants.O_CREAT | fs.constants.O_EXCL | fs.constants.O_NOFOLLOW, 0o644);
        try {fs.writeFileSync(fd, files.get(name)); fs.fsyncSync(fd);} finally {fs.closeSync(fd);}
        fs.renameSync(temporary, destination);
      } finally {try {fs.unlinkSync(temporary);} catch (error) {if (error.code !== 'ENOENT') throw error;}}
    }
  }
  return {target, sourceRevision, files: hashes, changed, checked: check};
}
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  let target, sourceRevision, check = false;
  const args = process.argv.slice(2), seen = new Set();
  for (let index = 0; index < args.length; index++) {
    const flag = args[index];
    if (seen.has(flag)) throw new Error('Repeated option: ' + flag);
    seen.add(flag);
    if (flag === '--target') target = args[++index];
    else if (flag === '--source-revision') sourceRevision = args[++index];
    else if (flag === '--check') check = true;
    else throw new Error('Unknown option: ' + flag);
  }
  process.stdout.write(JSON.stringify(installAppearance(target, {check, sourceRevision})) + '\n');
}
