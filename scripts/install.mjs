/* One-way packaging of the canonical shared UI. Never fetch or execute remote code. */
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import vm from 'node:vm';
import {publishGeneratedFiles} from './generated-files.mjs';
import {installOptions} from './install-options.mjs';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const hash=(bytes,algorithm='sha256')=>createHash(algorithm).update(bytes).digest(algorithm==='sha384'?'base64':'hex');
export function installBundle(target,{check=false,source=path.join(root,'public/v1')}={}) {
  if(!target)throw new Error('Pass --target with the app’s generated shared-ui asset directory');
  const names=['styles.css','runtime.js','icons.svg','manifest.json'];
  const files=new Map(names.map(name=>[name,fs.readFileSync(path.join(source,name))]));
  const release=JSON.parse(files.get('manifest.json'));
  if(release.protocol!==1||!/^1\.\d+\.\d+$/.test(release.version)||hash(files.get('styles.css'))!==release.revision||'sha384-'+hash(files.get('styles.css'),'sha384')!==release.integrity||release.stylesheet!==`styles.${release.revision}.css`)throw new Error('Shared UI bundle integrity failed');
  new vm.Script(files.get('runtime.js').toString(),{filename:'runtime.js'});
  const icons=files.get('icons.svg').toString();
  if(!icons.startsWith('<svg xmlns="http://www.w3.org/2000/svg">')||/<script|\bon\w+\s*=|\bhref\s*=/i.test(icons))throw new Error('Shared UI icons must be a passive local sprite');
  files.set('bundle.json',Buffer.from(JSON.stringify({repository:'https://github.com/andyherle/shared-ui',version:release.version,revision:release.revision,files:Object.fromEntries([...files].map(([name,bytes])=>[name,hash(bytes)]))},null,2)+'\n'));
  target=path.resolve(target);
  const changed=publishGeneratedFiles(target,files,{check,stale:'Generated UI assets are out of date: '});
  return {target,revision:release.revision,changed,checked:check};
}
if(process.argv[1]===fileURLToPath(import.meta.url)){
  const {target,check}=installOptions(process.argv.slice(2));
  console.log(JSON.stringify(installBundle(target,{check})));
}
