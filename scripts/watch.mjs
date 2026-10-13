/* Optional editing session: one-way dev source -> managed host. */
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
let timer;
function sync(){const result=spawnSync(process.execPath,[path.join(root,'scripts/service.mjs'),'sync'],{cwd:root,encoding:'utf8',timeout:15000});process.stdout.write(result.status===0?'Styles refreshed\n':result.stderr||'Build failed; working styles retained\n');}
sync();const watcher=fs.watch(path.join(root,'src'),{recursive:true},()=>{clearTimeout(timer);timer=setTimeout(sync,150);});
console.log('Watching src. CSS updates in place; code changes offer a Reload interface button. Ctrl-C ends this editing session.');
for(const signal of ['SIGTERM','SIGINT'])process.on(signal,()=>{clearTimeout(timer);watcher.close();process.exit(0);});
