import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {installDebugBundle} from './debug-bundle.mjs';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const args=process.argv.slice(2);let target,check=false;
for(let i=0;i<args.length;i++){if(args[i]==='--target')target=args[++i];else if(args[i]==='--check')check=true;else throw new Error('Unknown argument: '+args[i]);}
if(!target)throw new Error('Pass --target for the reviewed optional debug bundle');
console.log(JSON.stringify(installDebugBundle(path.resolve(target),{check,source:path.join(root,'public/v1')})));
