#!/usr/bin/env node
/* Private inventory in, validated generated assets out. Never edits app source. */
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {installBundle} from './install.mjs';
const source = fileURLToPath(new URL('../public/v1/', import.meta.url));
const names = ['styles.css', 'runtime.js', 'icons.svg', 'manifest.json', 'bundle.json'];
function requireThat(value, message) {if (!value) throw new Error(message);}
function destination(consumer) {
  requireThat(consumer && Object.keys(consumer).every(key => ['id', 'root', 'assets'].includes(key)), 'Unknown consumer field');
  requireThat(typeof consumer.id === 'string' && /^[a-z][a-z0-9-]{0,79}$/.test(consumer.id), 'Invalid consumer ID');
  requireThat(typeof consumer.root === 'string' && path.isAbsolute(consumer.root), 'Consumer root must be absolute');
  requireThat(typeof consumer.assets === 'string' && consumer.assets.length > 0 && !path.isAbsolute(consumer.assets), 'Assets must be a relative generated directory');
  const parts = consumer.assets.split(/[\\/]/); requireThat(parts.every(part => part && part !== '.' && part !== '..'), 'Assets cannot escape the consumer root');
  const root = path.resolve(consumer.root), stat = fs.lstatSync(root);
  requireThat(stat.isDirectory() && !stat.isSymbolicLink(), 'Consumer root must be a real directory');
  let target = root;
  for (const part of parts) {
    target = path.join(target, part);
    if (fs.existsSync(target)) {const info = fs.lstatSync(target); requireThat(info.isDirectory() && !info.isSymbolicLink(), 'Generated directory cannot traverse symlinks');}
    else {try {fs.lstatSync(target); throw new Error('Generated directory cannot contain a broken symlink');} catch (error) {if (error.code !== 'ENOENT') throw error;}}
  }
  for (const name of names) {
    try {const info = fs.lstatSync(path.join(target, name)); requireThat(info.isFile() && !info.isSymbolicLink() && info.nlink === 1, 'Generated assets must be ordinary files');}
    catch (error) {if (error.code !== 'ENOENT') throw error;}
  }
  return target;
}
export function updateConsumers(config, {apply = false, expectedVersion, expectedRevision, only} = {}) {
  requireThat(config && config.schemaVersion === 1 && Array.isArray(config.consumers) && config.consumers.length <= 100, 'Invalid private consumer inventory');
  requireThat(Object.keys(config).every(key => ['schemaVersion', 'consumers'].includes(key)), 'Unknown inventory field');
  const release = JSON.parse(fs.readFileSync(path.join(source, 'manifest.json')));
  if (apply) requireThat(expectedVersion === release.version && expectedRevision === release.revision, 'Apply requires the exact --version and --revision from a reviewed plan');
  const seen = new Set(), paths = new Set();
  const consumers = config.consumers.map(consumer => {
    requireThat(!seen.has(consumer.id), 'Duplicate consumer ID'); seen.add(consumer.id);
    const target = destination(consumer), canonical = path.join(fs.realpathSync(consumer.root), consumer.assets);
    requireThat(!paths.has(canonical), 'Duplicate generated asset destination'); paths.add(canonical);
    return {id: consumer.id, target};
  }).filter(consumer => !only || consumer.id === only);
  requireThat(consumers.length > 0, 'No matching consumers');
  // Validate every destination and source before modifying the first app.
  const plans = consumers.map(consumer => {
    try {installBundle(consumer.target, {check: true, source}); return {...consumer, current: true};}
    catch (error) {if (!error.message.startsWith('Generated UI assets are out of date:')) throw error; return {...consumer, current: false, changed: error.message.split(': ')[1].split(', ')};}
  });
  if (apply) for (const plan of plans) {
    installBundle(plan.target, {source}); installBundle(plan.target, {check: true, source}); plan.verified = true;
  }
  return {version: release.version, revision: release.revision, mode: apply ? 'applied' : 'plan', consumers: plans};
}
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  try {
    const args = process.argv.slice(2), options = {}; let file, check = false;
    const seen = new Set();
    for (let index = 0; index < args.length; index++) {
      const arg = args[index]; requireThat(!seen.has(arg), 'Repeated argument'); seen.add(arg);
      if (arg === '--apply') options.apply = true;
      else if (arg === '--check') check = true;
      else if (['--config', '--version', '--revision', '--app'].includes(arg)) {
        const value = args[++index]; requireThat(value && !value.startsWith('--'), `Missing ${arg} value`);
        if (arg === '--config') file = value;
        else options[{'--version': 'expectedVersion', '--revision': 'expectedRevision', '--app': 'only'}[arg]] = value;
      } else throw new Error('Unknown argument: ' + arg);
    }
    requireThat(file && !(check && options.apply), 'Use --config <private inventory.json> with either --check or --apply');
    const result = updateConsumers(JSON.parse(fs.readFileSync(file, 'utf8')), options); process.stdout.write(JSON.stringify(result, null, 2) + '\n');
    if (check && result.consumers.some(consumer => !consumer.current)) process.exitCode = 1;
  } catch (error) {process.stderr.write(error.message + '\n'); process.exitCode = 2;}
}
