import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {gzipSync} from 'node:zlib';
import {publishGeneratedFiles} from './generated-files.mjs';
const digest=bytes=>createHash('sha256').update(bytes).digest('hex');
export function timelineAssets(root,compact){
 const css=compact(fs.readFileSync(path.join(root,'src/timeline.css'),'utf8'))+'\n';
 if(Buffer.byteLength(css)>2048||gzipSync(css).length>1024||/@import|url\s*\(/i.test(css))throw Error('Timeline CSS exceeds its bounded local budget');
 const manifest={component:'timeline',version:1,files:{'timeline.css':digest(css)},sizes:{css:Buffer.byteLength(css),cssGzip:gzipSync(css).length}};
 return new Map([['v1/timeline.css',css],['v1/timeline.manifest.json',JSON.stringify(manifest,null,2)+'\n']]);
}
export function installTimeline(target,{source,check=false}={}){
 const css=fs.readFileSync(path.join(source,'timeline.css')),manifest=JSON.parse(fs.readFileSync(path.join(source,'timeline.manifest.json'),'utf8'));
 if(manifest.component!=='timeline'||manifest.version!==1||digest(css)!==manifest.files?.['timeline.css']||css.length>2048||gzipSync(css).length>1024||/@import|url\s*\(/i.test(css))throw Error('Timeline bundle integrity failed');
 const files=new Map([['timeline.css',css],['timeline.manifest.json',Buffer.from(JSON.stringify(manifest,null,2)+'\n')]]);
 const changed=publishGeneratedFiles(target,files,{check,stale:'Stale timeline bundle: '});
 return {component:'timeline',changed,checked:check,sizes:manifest.sizes};
}
