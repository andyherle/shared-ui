import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {gzipSync} from 'node:zlib';
import {fileURLToPath} from 'node:url';
import {notificationFeedAssets} from '../scripts/notification-feed-bundle.mjs';
import {installNotificationFeed} from '../scripts/install-notification-feed.mjs';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
test('optional feed assets have bounded CSS, exact integrity and no external imports',()=>{
 const files=notificationFeedAssets(root); assert.equal(files.size,3);
 const manifest=JSON.parse(files.get('notification-feed.bundle.json'));
 for(const [name,digest] of Object.entries(manifest.files)) assert.equal(createHash('sha256').update(files.get(name)).digest('hex'),digest);
 const css=files.get('notification-feed.css'); assert.ok(css.length<=8192);assert.ok(gzipSync(css).length<=2500);
 assert.doesNotMatch(css.toString(),/@import|url\s*\(/i);
 assert.match(css.toString(),/data-ui="portal"/);
 assert.doesNotMatch(css.toString(),/\[data-ui="(?:personal|postvisual)"\]/);
});
test('installer changes only its three owned files and detects drift',()=>{
 const dest=fs.mkdtempSync(path.join(os.tmpdir(),'feed-test-'));
 try{
 fs.writeFileSync(path.join(dest,'styles.css'),'prior baseline');
 assert.equal(installNotificationFeed(dest).changed.length,3);
 assert.equal(installNotificationFeed(dest,{check:true}).changed.length,0);
 assert.equal(fs.readFileSync(path.join(dest,'styles.css'),'utf8'),'prior baseline');
 fs.appendFileSync(path.join(dest,'swipe-actions.mjs'),'\n// drift');
 assert.throws(()=>installNotificationFeed(dest,{check:true}),/differ/);
 installNotificationFeed(dest); assert.equal(installNotificationFeed(dest,{check:true}).changed.length,0);
 }finally{fs.rmSync(dest,{recursive:true,force:true});}
});
