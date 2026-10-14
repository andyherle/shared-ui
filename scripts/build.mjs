import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import vm from 'node:vm';
import {gzipSync} from 'node:zlib';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
// Compact punctuation outside strings; preserve descendant selectors and calc spaces.
export function compactCSS(source){
  let out='',quote='',escaped=false,space=false;
  for(const char of source.replace(/\/\*[\s\S]*?\*\//g,'')){
    if(quote){out+=char;if(escaped)escaped=false;else if(char==='\\')escaped=true;else if(char===quote)quote='';continue;}
    if(/\s/.test(char)){space=true;continue;}
    if(space&&out&&!/[{};,:>]$/.test(out)&&!/[{};,>]/.test(char))out+=' ';
    if(char==='}'&&out.endsWith(';'))out=out.slice(0,-1);
    space=false;out+=char;if(char==='"'||char==="'")quote=char;
  }
  return out.trim();
}
export function buildCSS(tokens,controls){
  const declarations=values=>Object.entries(values).map(([key,value])=>`--ui-${key}:${value};`).join('');
  const theme=(selector,values,scheme)=>`${selector}{color-scheme:${scheme};${declarations(values)}}`;
  const packs=[];
  for(const [name,pack] of Object.entries(tokens)){
    const base=`html[data-ui="${name}"]`,mode=name==='personal'?'light':'dark';
    packs.push(`${base}{${declarations(pack.defaults)}}`,theme(base,pack[mode],mode));
    for(const appearance of ['light','dark'])packs.push(theme(`${base}[data-theme="${appearance}"]`,pack[appearance],appearance));
    if(name==='personal')packs.push(`@media(prefers-color-scheme:dark){${theme(`${base}:not([data-theme="light"])`,pack.dark,'dark')}}`);
  }
  return `@layer app,ui.tokens,ui.controls,ui.prose;@layer ui.tokens{${packs.join('')}}\n`+compactCSS(controls)+'\n';
}
export function manifest(css){return {protocol:1,version:'1.2.0',revision:createHash('sha256').update(css).digest('hex'),integrity:'sha384-'+createHash('sha384').update(css).digest('base64'),stylesheet:'styles.'+createHash('sha256').update(css).digest('hex')+'.css'};}
export function buildSite(directory=root){
  const read=name=>fs.readFileSync(path.join(directory,'src',name),'utf8');
  for(const file of ['runtime.js','components.js','lab.js'])new vm.Script(read(file),{filename:file});
  const css=buildCSS(JSON.parse(read('tokens.json')),read('controls.css'));
  if(Buffer.byteLength(css)>32000||/@import|url\s*\(/i.test(css))throw new Error('Styles must remain below 32 KB with no external imports');
  const release=manifest(css),out=path.join(directory,'public/v1');
  const icons=JSON.parse(read('icons.json'));
  const symbols=Object.entries(icons).map(([name,paths])=>{
    if(!/^[a-z][a-z0-9-]*$/.test(name)||!Array.isArray(paths)||paths.some(d=>!/^[-MmLlHhVvCcSsQqTtAaZz0-9.,\s+]+$/.test(d)))throw new Error('Invalid icon path');
    return `<symbol id="ui-${name}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">${paths.map(d=>`<path d="${d}"/>`).join('')}</symbol>`;
  }).join('');
  // Validate every input before replacing any last-working asset. Publish the manifest last.
  const assets=new Map([
    ['v1/'+release.stylesheet,css],['v1/styles.css',css],
    ['v1/runtime.js',read('runtime.js')+'\n'+read('components.js')],
    ['v1/icons.svg','<svg xmlns="http://www.w3.org/2000/svg"><defs>'+symbols+'</defs></svg>'],
    ['index.html',read('index.html').replaceAll('@@REVISION@@',release.revision).replaceAll('@@VERSION@@',release.version)],
    ['lab.js',read('lab.js').replace('@@ICON_NAMES@@',JSON.stringify(Object.keys(icons)))],['lab.css',read('lab.css')],
    ['v1/manifest.json',JSON.stringify(release)+'\n']
  ]);
  fs.mkdirSync(out,{recursive:true});
  for(const [name,content] of assets){const target=path.join(directory,'public',name),temporary=target+'.'+process.pid+'.tmp';fs.writeFileSync(temporary,content);fs.renameSync(temporary,target);}
  return {revision:release.revision,cssBytes:Buffer.byteLength(css),gzipBytes:gzipSync(css).length};
}
if(process.argv[1]===fileURLToPath(import.meta.url))console.log(JSON.stringify(buildSite()));
