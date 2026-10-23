import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {installDebugBundle} from './debug-bundle.mjs';
import {installOptions} from './install-options.mjs';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const {target,check}=installOptions(process.argv.slice(2));
console.log(JSON.stringify(installDebugBundle(path.resolve(target),{check,source:path.join(root,'public/v1')})));
