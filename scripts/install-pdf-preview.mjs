// One-way opt-in packaging; PDF.js itself remains a host-pinned dependency.
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {publishGeneratedFiles} from './generated-files.mjs';
import {installOptions} from './install-options.mjs';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
export function installPDFPreview(target,{check=false}={}){
  if(!target)throw new Error('Pass --target with a generated shared-ui directory');
  const bytes=fs.readFileSync(path.join(root,'src/pdf-preview.mjs'));
  execFileSync(process.execPath,['--check','--input-type=module'],{input:bytes});
  const hash=createHash('sha256').update(bytes).digest('hex');
  const files=new Map([['pdf-preview.mjs',bytes],['pdf-preview.bundle.json',Buffer.from(JSON.stringify({repository:'https://github.com/andyherle/shared-ui',protocol:1,files:{'pdf-preview.mjs':hash}},null,2)+'\n')]]);
  const changed=publishGeneratedFiles(target,files,{check,stale:'Generated PDF preview drift: '});
  return {target,changed,checked:check};
}
if(process.argv[1]===fileURLToPath(import.meta.url)){
  const {target,check}=installOptions(process.argv.slice(2));
  console.log(JSON.stringify(installPDFPreview(target,{check})));
}
