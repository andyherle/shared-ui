import {timelineAssets} from './timeline-bundle.mjs';
import {debugAssets} from './debug-bundle.mjs';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import vm from 'node:vm';
import {gzipSync} from 'node:zlib';
import {resolvePacks} from '../src/packs.mjs';
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
// The baseline review fixture can load ONLY these shared floating-panel styles
// as an additional pinned fixture helper, without replacing its historical
// 1.10.2 complete four-file UI bundle. One CSS source block feeds both builds.
export function floatingPanelFixtureCSS(controls){
  const begin='/* shared-floating-panel:start */';
  const end='/* shared-floating-panel:end */';
  const first=controls.indexOf(begin),last=controls.indexOf(end);
  if(first<0||last<=first||controls.indexOf(begin,first+1)!==-1||
    controls.indexOf(end,last+1)!==-1)
    throw new Error('Shared floating style markers must appear exactly once');
  const rules=compactCSS(controls.slice(first+begin.length,last));
  if(!rules.includes('.ui-floating-panel')||/@import|url\s*\(/i.test(rules))
    throw new Error('No safe self-contained floating fixture CSS');
  return '@layer app,ui.tokens,ui.controls,ui.prose;@layer ui.controls{:where([data-ui]){'+rules+'}}\n';
}

export function buildCSS(tokens,controls){
  const definitions=tokens; tokens=resolvePacks(tokens);
  const color=value=>value.replace(/#[0-9a-f]{6}(?:[0-9a-f]{2})?\b/gi,hex=>{const pairs=hex.slice(1).match(/../g);return pairs.every(pair=>pair[0]===pair[1])?'#'+pairs.map(pair=>pair[0]).join(''):hex;});
  const declarations=values=>Object.entries(values).map(([key,value])=>`--ui-${key}:${color(value)};`).join('');
  const packs=[];
  // Hoist identical pack tokens once; each pack still owns its own palette.
  const names=Object.keys(tokens), shared={};
  for(const key of Object.keys(tokens[names[0]].light)){
    const first=tokens[names[0]];
    if(names.every(name=>tokens[name].light[key]===first.light[key]&&tokens[name].dark[key]===first.dark[key]))
      shared[key]=first.light[key]===first.dark[key]?first.light[key]:`light-dark(${first.light[key]},${first.dark[key]})`;
  }
  const defaults={};
  for(const [key,value] of Object.entries(tokens[names[0]].defaults))
    if(names.every(name=>tokens[name].defaults[key]===value))defaults[key]=value;
  packs.push(`[data-ui]{${declarations(defaults)}${declarations(shared)}}`);
  // Native color-scheme resolves both palettes without duplicating the dark
  // declarations for a saved choice and the system media query.
  for(const [name,pack] of Object.entries(tokens)){
    const base=`[data-ui="${name}"]`;
    const colors=Object.fromEntries(Object.keys(pack.light).filter(key=>!(key in shared)).map(key=>[key,pack.light[key]===pack.dark[key]?pack.light[key]:`light-dark(${pack.light[key]},${pack.dark[key]})`]));
    packs.push(`${base}{color-scheme:${name==='personal'&&!definitions.personal.mirror?'light dark':'dark'};${declarations(Object.fromEntries(Object.entries(pack.defaults).filter(([key])=>!(key in defaults))))}${declarations(colors)}}`);
  }
  packs.push('[data-ui][data-theme=light]{color-scheme:light}[data-ui][data-theme=dark]{color-scheme:dark}');
  return `@layer app,ui.tokens,ui.controls,ui.prose;@layer ui.tokens{${packs.join('')}}\n`+compactCSS(controls)+'\n';
}
export function manifest(css){
  // A running lab can rebuild after its source is refreshed. Read release metadata
  // at build time so a cached module cannot advertise an older control contract.
  const {version}=JSON.parse(fs.readFileSync(path.join(root,'package.json'),'utf8'));
  return {protocol:1,version,revision:createHash('sha256').update(css).digest('hex'),integrity:'sha384-'+createHash('sha384').update(css).digest('base64'),stylesheet:'styles.'+createHash('sha256').update(css).digest('hex')+'.css'};
}
export function buildSite(directory=root){
  const read=name=>fs.readFileSync(path.join(directory,'src',name),'utf8');
  for(const file of ['runtime.js','components.js','compositions.js','floating-panel.js','diagnostics.js','lab.js','composition-lab.js'])new vm.Script(read(file),{filename:file});
  const css=buildCSS(JSON.parse(read('tokens.json')),read('controls.css'));
  const floatingCss=floatingPanelFixtureCSS(read('controls.css'));
  const helper=read('floating-panel.js');
  // Composition layout is shared behavior. Bound raw and transfer size independently.
  const rawBytes=Buffer.byteLength(css),gzipBytes=gzipSync(css).length;
  if(rawBytes>36864||gzipBytes>8192||/@import|url\s*\(/i.test(css))
    throw new Error('Styles must remain within 36 KiB raw / 8 KiB gzip with no external imports');
  const release=manifest(css),out=path.join(directory,'public/v1');
  const icons=JSON.parse(read('icons.json'));
  const symbols=Object.entries(icons).map(([name,paths])=>{
    if(!/^[a-z][a-z0-9-]*$/.test(name)||!Array.isArray(paths)||paths.some(d=>!/^[-MmLlHhVvCcSsQqTtAaZz0-9.,\s+]+$/.test(d)))throw new Error('Invalid icon path');
    return `<symbol id="ui-${name}" viewBox="0 0 24 24" fill="${name==='keyframe-filled'?'currentColor':'none'}" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">${paths.map(d=>`<path d="${d}"/>`).join('')}</symbol>`;
  }).join('');
  // Validate every input before replacing any last-working asset. Publish the manifest last.
  const assets=new Map([
    ...debugAssets(directory,compactCSS),...timelineAssets(directory,compactCSS),
    ['debug.html',read('debug-lab.html').replaceAll('@@REVISION@@',release.revision).replaceAll('@@VERSION@@',release.version)],['debug-lab.js',read('debug-lab.js')],
    ['v1/'+release.stylesheet,css],['v1/styles.css',css],
    ['v1/runtime.js',read('runtime.js')+'\n'+read('components.js')+'\n'+read('compositions.js')+'\n'+helper+'\n'+read('diagnostics.js')],
    ['v1/floating-panel.fixture.css',floatingCss],
    ['v1/icons.svg','<svg xmlns="http://www.w3.org/2000/svg"><defs>'+symbols+'</defs></svg>'],
    ['index.html',read('index.html').replace('@@CONTROL_FIXTURE@@',read('fixture.html')).replaceAll('@@REVISION@@',release.revision).replaceAll('@@VERSION@@',release.version)],
    ['lab.js',read('lab.js').replace('@@ICON_NAMES@@',JSON.stringify(Object.keys(icons)))+'\n'+read('composition-lab.js')],['lab.css',read('lab.css')],
    ['v1/manifest.json',JSON.stringify(release)+'\n']
  ]);
  fs.mkdirSync(out,{recursive:true});
  for(const [name,content] of assets){const target=path.join(directory,'public',name),temporary=target+'.'+process.pid+'.tmp';fs.writeFileSync(temporary,content);fs.renameSync(temporary,target);}
  return {revision:release.revision,cssBytes:Buffer.byteLength(css),gzipBytes:gzipSync(css).length,
    floatingFixtureCssBytes:Buffer.byteLength(floatingCss),
    floatingFixtureCssSha256:createHash('sha256').update(floatingCss).digest('hex'),
    floatingHelperSha256:createHash('sha256').update(helper).digest('hex')};
}
if(process.argv[1]===fileURLToPath(import.meta.url))console.log(JSON.stringify(buildSite()));
