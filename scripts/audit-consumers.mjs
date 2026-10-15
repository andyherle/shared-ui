/* Read-only consumer inventory. Application source/data never leave their roots. */
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
const canonical=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../public/v1');
const files=['styles.css','runtime.js','icons.svg','manifest.json'];
const hash=(bytes,algorithm='sha256')=>createHash(algorithm).update(bytes).digest(algorithm==='sha384'?'base64':'hex');
export function auditBundle(target,{source=canonical}={}){
  const result={target:path.resolve(target),version:null,revision:null,stale:[],errors:[]};
  try{
    const bundle=JSON.parse(fs.readFileSync(path.join(target,'bundle.json'))),release=JSON.parse(fs.readFileSync(path.join(target,'manifest.json')));
    result.version=bundle.version;result.revision=bundle.revision;
    if(bundle.repository!=='https://github.com/andyherle/shared-ui')throw new Error('Unrecognized bundle repository');
    if(release.protocol!==1||!/^1\.\d+\.\d+$/.test(release.version)||bundle.version!==release.version||bundle.revision!==release.revision)result.errors.push('Bundle/release identity mismatch');
    for(const file of files){
      const bytes=fs.readFileSync(path.join(target,file));
      if(bundle.files?.[file]!==hash(bytes))result.errors.push('Generated file drift: '+file);
      if(!bytes.equals(fs.readFileSync(path.join(source,file))))result.stale.push(file);
      if(file==='styles.css'&&(hash(bytes)!==release.revision||'sha384-'+hash(bytes,'sha384')!==release.integrity||release.stylesheet!==`styles.${release.revision}.css`))result.errors.push('Stylesheet integrity mismatch');
      if(file==='runtime.js')new vm.Script(bytes.toString(),{filename:file});
    }
  }catch(error){result.errors.push(error.message);}
  return result;
}
export function discoverBundles(root){
  const targets=[],skipped=new Set(['.git','node_modules','.venv','venv','dist','build','__pycache__','.aura','.aurafx']);
  function walk(directory){
    if(fs.existsSync(path.join(directory,'bundle.json'))){
      try{if(JSON.parse(fs.readFileSync(path.join(directory,'bundle.json'))).repository==='https://github.com/andyherle/shared-ui'){targets.push(directory);return;}}catch{}
    }
    for(const item of fs.readdirSync(directory,{withFileTypes:true}))if(item.isDirectory()&&!item.name.startsWith('.')&&!skipped.has(item.name))walk(path.join(directory,item.name));
  }
  walk(path.resolve(root));return targets.sort();
}
if(process.argv[1]===fileURLToPath(import.meta.url)){
  const args=process.argv.slice(2),targets=new Set();let allowStale=false;
  for(let i=0;i<args.length;i++){
    if(args[i]==='--root'){if(!args[i+1])throw new Error('Missing --root directory');for(const target of discoverBundles(args[++i]))targets.add(target);}
    else if(args[i]==='--target'){if(!args[i+1])throw new Error('Missing --target directory');targets.add(path.resolve(args[++i]));}
    else if(args[i]==='--allow-stale')allowStale=true;
    else throw new Error('Unknown argument: '+args[i]);
  }
  if(!targets.size)throw new Error('No bundles found; pass --root /path/to/apps or --target /path/to/assets');
  const results=[...targets].map(target=>auditBundle(target));
  console.log(JSON.stringify({checked:results.length,results},null,2));
  if(results.some(result=>result.errors.length||!allowStale&&result.stale.length))process.exitCode=1;
}
