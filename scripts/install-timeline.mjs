import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {installTimeline} from './timeline-bundle.mjs';
import {installOptions} from './install-options.mjs';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const {target,check}=installOptions(process.argv.slice(2));
console.log(JSON.stringify(installTimeline(path.resolve(target),{source:path.join(root,'public/v1'),check})));
