import fs from 'node:fs';
import {installPDFPreview} from './install-pdf-preview.mjs';
const root=new URL('../',import.meta.url);
installPDFPreview(new URL('public/v1/',root).pathname);
for(const name of ['pdf-preview.html','pdf-preview-demo.mjs'])fs.copyFileSync(new URL('src/'+name,root),new URL('public/'+name,root));
