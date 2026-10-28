/* One-way packaging. Only these optional files are owned by this installer. */
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {notificationFeedAssets} from './notification-feed-bundle.mjs';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export function installNotificationFeed(target, {check = false, source = root} = {}) {
  if (!target) throw new Error('Pass --target with the generated Shared UI directory');
  const files = notificationFeedAssets(source);
  const changed = [...files].filter(([name, bytes]) => {
    try { return !fs.readFileSync(path.join(target, name)).equals(bytes); } catch (error) { if (error.code !== 'ENOENT') throw error; return true; }
  });
  if (check && changed.length) throw new Error('Notification assets differ: ' + changed.map(([name]) => name).join(', '));
  if (!check) {
    fs.mkdirSync(target, {recursive: true});
    // Stage every output first; manifest is committed last. Temp files are local.
    const staged = [];
    try {
      for (const [name, bytes] of changed) {
        const temp = path.join(target, '.' + name + '.' + process.pid + '.tmp');
        fs.writeFileSync(temp, bytes, {flag: 'wx'}); staged.push([temp, path.join(target, name)]);
      }
      for (const [temp, destination] of staged) fs.renameSync(temp, destination);
    } finally { for (const [temp] of staged) { try { fs.unlinkSync(temp); } catch (error) { if (error.code !== 'ENOENT') throw error; } } }
  }
  return {target: path.resolve(target), checked: check, changed: changed.map(([name]) => name)};
}
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  const at = args.indexOf('--target');
  if (at < 0 || !args[at + 1] || args.some((arg, i) => i !== at && i !== at + 1 && arg !== '--check')) throw new Error('Usage: node scripts/install-notification-feed.mjs --target <directory> [--check]');
  console.log(JSON.stringify(installNotificationFeed(args[at + 1], {check: args.includes('--check')})));
}
