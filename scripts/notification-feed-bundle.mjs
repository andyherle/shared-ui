/* Optional, source-owned package; does not update the automatic CSS channel. */
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {gzipSync} from 'node:zlib';
export function notificationFeedAssets(root) {
  const css = fs.readFileSync(path.join(root, 'src/notification-feed.css'));
  const js = fs.readFileSync(path.join(root, 'src/swipe-actions.mjs'));
  if (css.length > 8192 || gzipSync(css).length > 2500 || /@import|url\s*\(/i.test(css.toString())) throw new Error('Notification CSS exceeds its optional budget or imports external assets');
  if (js.length > 8192) throw new Error('Swipe module exceeds its optional budget');
  const files = new Map([['notification-feed.css', css], ['swipe-actions.mjs', js]]);
  const manifest = {protocol: 1, component: 'notification-feed', version: 1,
    repository: 'https://github.com/andyherle/shared-ui',
    files: Object.fromEntries([...files].map(([name, bytes]) => [name, createHash('sha256').update(bytes).digest('hex')]))};
  files.set('notification-feed.bundle.json', Buffer.from(JSON.stringify(manifest, null, 2) + '\n'));
  return files;
}
