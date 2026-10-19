import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import {createHash} from 'node:crypto';
import {gzipSync} from 'node:zlib';
export const DEBUG_BUDGET=Object.freeze({css:6144,cssGzip:2048,js:32768,jsGzip:10240});
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
export function debugAssets(root,compactCSS){
 const script=fs.readFileSync(path.join(root,'src/debug.js'),'utf8');new vm.Script(script,{filename:'debug.js'});
 const css=compactCSS(fs.readFileSync(path.join(root,'src/debug.css'),'utf8'))+'\n';
 const sizes={css:Buffer.byteLength(css),cssGzip:gzipSync(css).length,js:Buffer.byteLength(script),jsGzip:gzipSync(script).length};
 if(Object.keys(sizes).some(key=>sizes[key]>DEBUG_BUDGET[key])||/@import|url\s*\(/i.test(css))throw new Error('Optional debug component exceeds its budget or imports external CSS');
 const types=fs.readFileSync(path.join(root,'src/debug.d.ts'),'utf8');
 const manifest={component:'debug',version:1,requiresSharedUI:'1.12.0',files:{'debug.js':sha(script),'debug.css':sha(css),'debug.d.ts':sha(types)},sizes,budget:DEBUG_BUDGET};
 return new Map([['v1/debug.d.ts',types],['v1/debug.js',script],['v1/debug.css',css],['v1/debug.manifest.json',JSON.stringify(manifest,null,2)+'\n']]);
}
export function installDebugBundle(target,{source,check=false}={}){
 const manifest=JSON.parse(fs.readFileSync(path.join(source,'debug.manifest.json'),'utf8'));
 if(manifest.component!=='debug'||manifest.version!==1)throw new Error('Unsupported debug bundle');
 const files=new Map();
 for(const name of ['debug.js','debug.css','debug.d.ts']){
  const bytes=fs.readFileSync(path.join(source,name));if(sha(bytes)!==manifest.files?.[name])throw new Error('Debug component integrity failed: '+name);files.set(name,bytes);
 }
 if(files.get('debug.js').length>DEBUG_BUDGET.js||gzipSync(files.get('debug.js')).length>DEBUG_BUDGET.jsGzip||files.get('debug.css').length>DEBUG_BUDGET.css||gzipSync(files.get('debug.css')).length>DEBUG_BUDGET.cssGzip)throw new Error('Debug bundle exceeds limits');
 new vm.Script(files.get('debug.js').toString(),{filename:'debug.js'});
 if(/@import|url\s*\(/i.test(files.get('debug.css').toString()))throw new Error('External debug CSS imports are prohibited');
 files.set('debug.manifest.json',Buffer.from(JSON.stringify(manifest,null,2)+'\n'));
 const changed=[...files].filter(([name,bytes])=>!fs.existsSync(path.join(target,name))||!fs.readFileSync(path.join(target,name)).equals(bytes)).map(([name])=>name);
 if(check&&changed.length)throw new Error('Debug component is out of date: '+changed.join(', '));
 if(!check){fs.mkdirSync(target,{recursive:true});for(const name of changed){const dest=path.join(target,name),tmp=dest+'.'+process.pid+'.tmp';try{fs.writeFileSync(tmp,files.get(name));fs.renameSync(tmp,dest);}finally{if(fs.existsSync(tmp))fs.unlinkSync(tmp);}}}
 return {component:'debug',checked:check,changed,sizes:manifest.sizes};
}
