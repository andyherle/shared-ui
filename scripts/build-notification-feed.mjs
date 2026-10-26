// Optional catalogue/build: leaves the core v1 bundle and manifest untouched.
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {installNotificationFeed} from './install-notification-feed.mjs';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
installNotificationFeed(path.join(root,'public/v1'));
fs.copyFileSync(path.join(root,'src/notification-feed.html'),path.join(root,'public/notification-feed.html'));
console.log('Built public/notification-feed.html and the optional notification bundle.');
