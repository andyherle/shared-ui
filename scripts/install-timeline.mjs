import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {installTimeline} from './timeline-bundle.mjs';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..'),args=process.argv.slice(2);let target,check=false;
for(let i=0;i<args.length;i++){if(args[i]==='--target')target=args[++i];else if(args[i]==='--check')check=true;else throw Error('Unknown argument');}if(!target)throw Error('Pass --target');
console.log(JSON.stringify(installTimeline(path.resolve(target),{source:path.join(root,'public/v1'),check})));
