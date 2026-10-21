// One-way opt-in packaging; PDF.js itself remains a host-pinned dependency.
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
export function installPDFPreview(target,{check=false}={}){
  if(!target)throw new Error('Pass --target with a generated shared-ui directory');
  const bytes=fs.readFileSync(path.join(root,'src/pdf-preview.mjs'));
  execFileSync(process.execPath,['--check','--input-type=module'],{input:bytes});
  const hash=createHash('sha256').update(bytes).digest('hex');
  const files=new Map([['pdf-preview.mjs',bytes],['pdf-preview.bundle.json',Buffer.from(JSON.stringify({repository:'https://github.com/andyherle/shared-ui',protocol:1,files:{'pdf-preview.mjs':hash}},null,2)+'\n')]]);
  const changed=[...files].filter(([name,data])=>!fs.existsSync(path.join(target,name))||!fs.readFileSync(path.join(target,name)).equals(data)).map(([name])=>name);
  if(check&&changed.length)throw new Error('Generated PDF preview drift: '+changed.join(', '));
  if(!check){fs.mkdirSync(target,{recursive:true});for(const name of changed){const destination=path.join(target,name),temporary=destination+'.tmp';fs.writeFileSync(temporary,files.get(name));fs.renameSync(temporary,destination);}}
  return {target,changed,checked:check};
}
if(process.argv[1]===fileURLToPath(import.meta.url)){
  const args=process.argv.slice(2);let target,check=false;
  for(let i=0;i<args.length;i++){if(args[i]==='--target')target=args[++i];else if(args[i]==='--check')check=true;else throw new Error('Unknown argument: '+args[i]);}
  console.log(JSON.stringify(installPDFPreview(target,{check})));
}
