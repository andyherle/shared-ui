(() => {
'use strict';
const $=id=>document.getElementById(id),root=document.documentElement,UI=window.SharedUI;
for(const tile of document.querySelectorAll('[data-app-color]'))UI.setAppColor(tile,tile.dataset.appColor);
let sampleDirection='desc';
UI.setSortDirection($('sample-sort'),sampleDirection,{sprite:'./v1/icons.svg'});
$('sample-sort').addEventListener('click',()=>{sampleDirection=sampleDirection==='asc'?'desc':'asc';UI.setSortDirection($('sample-sort'),sampleDirection,{sprite:'./v1/icons.svg'});});
function sampleSelection(){let count=0;for(const card of $('sample-selection').children){const selected=card.querySelector('input').checked;UI.setSelection(card,selected);if(selected)count++;}$('sample-context').hidden=!count;$('sample-context').querySelector('[role=status]').textContent=`${count} selected`;UI.refreshActions(document);}
$('sample-selection').addEventListener('change',sampleSelection);
$('sample-selection').addEventListener('click',event=>{const open=event.target.closest('button');if(!open)return;if(event.shiftKey){const input=open.closest('article').querySelector('input');input.checked=!input.checked;sampleSelection();}else toast('Sample opened');});
$('sample-clear').addEventListener('click',()=>{for(const input of $('sample-selection').querySelectorAll('input'))input.checked=false;sampleSelection();});
UI.createBackToTop($('sample-top'),{scrollTarget:$('sample-scroll'),focusTarget:$('sample-scroll'),sprite:'./v1/icons.svg'});
UI.createColumnResize($('resizable-sheet'));
const pack=$('pack'),mode=$('mode'),density=$('density');
const embedded=$('embedded-host').attachShadow({mode:'open'}),embeddedCSS=document.createElement('link');
embeddedCSS.rel='stylesheet';embeddedCSS.href='./v1/styles.css';embedded.append(embeddedCSS,$('embedded-form').content.cloneNode(true));
const embeddedRoot=embedded.querySelector('[data-ui]');
UI.adoptAction(embedded.querySelector('button'),{label:'Save folder',icon:'save',sprite:'./v1/icons.svg'});
embedded.querySelector('form').addEventListener('submit',event=>{event.preventDefault();const status=embedded.querySelector('[role=status]');status.textContent='Folder retained: '+embedded.querySelector('input').value;status.dataset.state='success';});
for(const swatch of document.querySelectorAll('[data-colour]'))swatch.style.setProperty('--colour',swatch.dataset.colour);
for(const action of document.querySelectorAll('[data-ui-icon]'))UI.adoptAction(action,{icon:action.dataset.uiIcon,sprite:'./v1/icons.svg'});
const preview=$('responsive-preview'),previewWidth=$('preview-width');
function resizePreview(value){const fit=value==='fit';const width=Math.max(180,Math.min(900,Number(value)||320));preview.style.width=fit?'100%':width+'px';if(!fit)previewWidth.value=width;$('preview-width-value').textContent=fit?'Fit container':width+' px';}
previewWidth.addEventListener('input',()=>resizePreview(previewWidth.value));
for(const button of document.querySelectorAll('[data-preview-width]'))button.addEventListener('click',()=>resizePreview(button.dataset.previewWidth));
let toastTimer=null,source=null,sourceAbort=null,lockWaiting=false,pageActive=true,layoutRevision=null,labChannel=null;
const hostedStatic=location.hostname.endsWith('.github.io');
try{if(window.BroadcastChannel)labChannel=new BroadcastChannel('shared-ui-lab-events');}catch{}
function toast(text){$('toast').textContent=text;$('toast').hidden=false;clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('toast').hidden=true,2800);}
function tokens(){const style=getComputedStyle(root),items=[['Background','bg'],['Surface','surface'],['Text','text'],['Muted','muted'],['Border','line'],['Accent','accent'],['Primary','primary'],['Focus','accent']];$('tokens').replaceChildren();for(const [name,key] of items){const group=document.createElement('div'),swatch=document.createElement('span'),term=document.createElement('dt'),value=document.createElement('dd');swatch.className='lab-token-swatch';swatch.style.background=style.getPropertyValue('--ui-'+key);term.textContent=name;value.textContent=style.getPropertyValue('--ui-'+key).trim();group.append(swatch,term,value);$('tokens').append(group);}$('revision').textContent='Style revision · '+(root.dataset.uiRevision||'bundled').slice(0,12);}
function appearance(){embeddedRoot.dataset.ui=pack.value;embeddedRoot.dataset.theme=mode.value;embeddedRoot.dataset.uiDensity=density.value;root.dataset.ui=pack.value;root.dataset.theme=mode.value;if(density.value==='default')delete document.body.dataset.uiDensity;else document.body.dataset.uiDensity=density.value;try{sessionStorage.setItem('style-lab-appearance',JSON.stringify({pack:pack.value,mode:mode.value,density:density.value}));}catch{}requestAnimationFrame(tokens);$('embed-example').textContent=`<html data-ui="${pack.value}" data-theme="${mode.value}">\n<link rel="stylesheet" href="${new URL('./v1/styles.css',location.href).href}">\n<button data-ui-variant="primary">Save</button>\n<article class="ui-prose">…</article>`;}
try{const saved=JSON.parse(sessionStorage.getItem('style-lab-appearance')||'null');if(saved&&['personal','postvisual'].includes(saved.pack)&&['light','dark'].includes(saved.mode)){pack.value=saved.pack;mode.value=saved.mode;if(['default','dense','compact','comfortable'].includes(saved.density))density.value=saved.density;}}catch{}
for(const select of [pack,mode,density])select.addEventListener('change',appearance);appearance();$('css-url').value=new URL('./v1/styles.css',location.href).href;
$('copy-css').addEventListener('click',async()=>{try{await navigator.clipboard.writeText($('css-url').value);toast('CSS URL copied');}catch{$('css-url').focus();$('css-url').select();toast('Select and copy the CSS URL');}});
document.addEventListener('click',event=>{
const button=event.target.closest('button');if(!button)return;
if(button.dataset.toast){toast(button.dataset.toast);button.closest('details.ui-menu')?.removeAttribute('open');}
if(button.dataset.dialog){button.closest('details.ui-menu')?.removeAttribute('open');$(button.dataset.dialog).showModal();}
if(button.hasAttribute('data-toggle'))button.setAttribute('aria-pressed',String(button.getAttribute('aria-pressed')!=='true'));
if(button.dataset.segment){for(const peer of document.querySelectorAll(`[data-segment="${button.dataset.segment}"]`))peer.setAttribute('aria-pressed',String(peer===button));}
});
$('compact-search-form').addEventListener('submit',event=>{event.preventDefault();toast('Search keeps its value and native form behavior.');});
$('busy-button').addEventListener('click',async()=>{const button=$('busy-button');button.disabled=true;button.setAttribute('aria-busy','true');button.querySelector('span').textContent='Running…';$('busy-status').textContent='Working';$('busy-status').dataset.state='pending';await new Promise(resolve=>setTimeout(resolve,750));button.disabled=false;button.removeAttribute('aria-busy');button.querySelector('span').textContent='Run task';$('busy-status').textContent='Completed';$('busy-status').dataset.state='success';});
const form=$('sample-form');form.addEventListener('submit',event=>{event.preventDefault();let invalid=null;for(const field of form.elements){if(typeof field.checkValidity!=='function')continue;const valid=field.checkValidity();field.setAttribute('aria-invalid',String(!valid));if(!valid&&!invalid)invalid=field;}if(invalid){$('form-status').textContent='Check the highlighted fields.';$('form-status').className='ui-status';$('form-status').dataset.state='error';invalid.focus();return;}$('form-status').textContent='Validation passed. Sample values retained.';$('form-status').className='ui-status';$('form-status').dataset.state='success';});
form.addEventListener('input',event=>{if(event.target.getAttribute('aria-invalid')==='true')event.target.setAttribute('aria-invalid',String(!event.target.checkValidity()));});form.addEventListener('reset',()=>{for(const field of form.elements)field.removeAttribute('aria-invalid');$('form-status').textContent='';delete $('form-status').dataset.state;});
const combo=UI.createCombobox($('combobox'),{options:['Button','Canvas','Checkbox','Color picker','Dialog','Disclosure','Lightbox','Menu','Search','Selector','Slider','Table','Tabs','Textarea','Timeline'],onSelect:item=>toast(item.label+' selected')});
function tagPill(tag,remove){const button=document.createElement('button');button.type='button';button.className='ui-tag';const label=document.createElement('span'),mark=document.createElement('span');label.textContent=tag;mark.textContent='×';mark.setAttribute('aria-hidden','true');button.append(label,mark);button.setAttribute('aria-label','Remove '+tag);button.addEventListener('click',remove);return button;}
const simpleTags=new Set();const simpleTagInput=UI.createTagInput($('tag-input'),{options:()=>['Landscape','Motion','Portrait','Detail'],excluded:()=>[...simpleTags],onCommit:value=>{for(const tag of value.split(',').map(x=>x.trim()).filter(Boolean)){if(simpleTags.has(tag))continue;simpleTags.add(tag);const pill=tagPill(tag,()=>{simpleTags.delete(tag);pill.remove();});$('tags').append(pill);}}});
const fixtureTags=new Set(['Editorial','motion']);
function drawFixtureTags(){for(const pill of $('fixture-tags').querySelectorAll('.ui-tag'))pill.remove();for(const tag of fixtureTags){const pill=tagPill(tag,()=>{fixtureTags.delete(tag);pill.remove();fixtureTagInput.draw();});$('fixture-tag-form').before(pill);}}
const fixtureTagInput=UI.createTagInput($('fixture-tag-input'),{options:()=>['Editorial','motion','Mood','Portrait','Texture','Wide'],excluded:()=>[...fixtureTags],onCommit:value=>{for(const tag of value.split(',').map(x=>x.trim()).filter(Boolean))if(![...fixtureTags].some(existing=>existing.toLocaleLowerCase()===tag.toLocaleLowerCase()))fixtureTags.add(tag);drawFixtureTags();$('fixture-tag-status').textContent='Tags saved';$('fixture-tag-status').dataset.state='success';}});drawFixtureTags();
$('fixture-tag-form').addEventListener('submit',event=>{event.preventDefault();fixtureTagInput.flush();});
$('fixture-tag-input').addEventListener('keydown',event=>{if(event.key==='Enter'&&event.shiftKey){event.preventDefault();fixtureTagInput.flush();$('fixture-tag-status').textContent='Saved · next media';}});
const fixtureZoom=UI.createZoom($('fixture-zoom'),{min:72,max:420,step:20,value:220,outLabel:'Smaller tiles',inLabel:'Larger tiles',format:value=>value+' px',sprite:'./v1/icons.svg'});
UI.adoptAction($('fixture-save'),{labelStates:['Save','Saving…','Saved'],sprite:'./v1/icons.svg'});
UI.reserveText($('fixture-workspace-status'),['Live','Unsaved','Saving…','Saved','Save failed']);
function fixtureState(){
 const header=$('fixture-workspace-header'),before=UI.captureLayout(header),state=$('fixture-state').value,button=$('fixture-save');
 $('fixture-layout-check').textContent='Checking…';delete $('fixture-layout-check').dataset.checkedState;
 UI.setActionLabel(button,state==='saving'?'Saving…':state==='saved'?'Saved':'Save',{ariaLabel:state==='saving'?'Saving…':state==='saved'?'Saved':'Save'});
 button.setAttribute('aria-busy',String(state==='saving'));button.disabled=state==='saving';
 UI.setText($('fixture-workspace-status'),{live:'Live',dirty:'Unsaved',saving:'Saving…',saved:'Saved',error:'Save failed'}[state]);
 $('fixture-workspace-status').dataset.state=state==='error'?'error':state==='saving'?'pending':state==='saved'?'success':'live';
 requestAnimationFrame(()=>requestAnimationFrame(()=>{const issues=[...UI.compareLayout(before),...UI.auditControls(header).issues.filter(issue=>issue.severity==='error')],output=$('fixture-layout-check');output.textContent=issues.length?issues.map(issue=>issue.code+': '+issue.name).join('; '):'Stable · no command movement';output.dataset.state=issues.length?'error':'live';output.dataset.checkedState=state;}));
}
$('fixture-state').addEventListener('change',fixtureState);
$('fixture-save').addEventListener('click',()=>{$('fixture-state').value='saved';fixtureState();});
function fixtureWidth(value){$('fixture-container').style.inlineSize=value==='fit'?'100%':`min(100%,${value}px)`;$('fixture-width-value').textContent=value==='fit'?'Fit':value+' px';if(value!=='fit')$('fixture-width').value=value;}
$('fixture-width').addEventListener('input',event=>fixtureWidth(event.target.value));for(const button of document.querySelectorAll('[data-fixture-width]'))button.addEventListener('click',()=>fixtureWidth(button.dataset.fixtureWidth));
for(const id of ['fixture-task-form','fixture-reply-form'])$(id).addEventListener('submit',event=>{event.preventDefault();$('fixture-task-status').textContent=id==='fixture-reply-form'?'Reply saved':'Action selected';$('fixture-task-status').dataset.state='success';});
$('fixture-capture-form').addEventListener('submit',event=>{event.preventDefault();const journal=new FormData(event.currentTarget).get('destination')==='daily';$('fixture-capture-status').textContent=journal?'Saved to Journal':'Capture saved';$('fixture-capture-status').dataset.state='success';});
$('range').addEventListener('input',()=>{$('range-value').textContent=$('range').value+'%';});$('color').addEventListener('input',()=>{$('color-value').textContent=$('color').value;});
const selectedRows=()=>{const boxes=[...$('sample-table').querySelectorAll('tbody input[type=checkbox]')],selected=boxes.filter(box=>box.checked).length;$('table-selection').textContent=selected+' selected';$('select-all').checked=selected===boxes.length;$('select-all').indeterminate=selected>0&&selected<boxes.length;};
$('select-all').addEventListener('change',()=>{for(const box of $('sample-table').querySelectorAll('tbody input[type=checkbox]'))box.checked=$('select-all').checked;selectedRows();});$('sample-table').addEventListener('change',selectedRows);
let descending=false;$('sort-table').addEventListener('click',()=>{const body=$('sample-table').tBodies[0],rows=[...body.rows];rows.sort((a,b)=>a.cells[1].textContent.localeCompare(b.cells[1].textContent)*(descending?-1:1));body.append(...rows);descending=!descending;UI.setActionLabel($('sort-table'),'Name '+(descending?'↑':'↓'),{ariaLabel:descending?'Name sorted ascending':'Name sorted descending'});});
let page=1;function pagination(){ $('page-number').textContent=`Page ${page} of 3`;$('page-prev').disabled=page===1;$('page-next').disabled=page===3;}$('page-prev').addEventListener('click',()=>{page=Math.max(1,page-1);pagination();});$('page-next').addEventListener('click',()=>{page=Math.min(3,page+1);pagination();});
const board=$('board'),nodes=[...board.querySelectorAll('[data-node]')];let drag=null,zoom=1,selectedNode=nodes[0];
function selectNode(node){selectedNode=node;$('node-width').value=node.offsetWidth||node.dataset.width||120;$('node-blend').value=node.dataset.blend||'Normal';$('node-visible').checked=!node.hidden;$('node-opacity').value=node.dataset.opacity||100;for(const peer of nodes)peer.setAttribute('aria-pressed',String(peer===node));$('node-name').value=node.dataset.node;}
$('node-width').addEventListener('input',()=>{const width=Math.max(40,Math.min(300,Number($('node-width').value)||120));selectedNode.style.width=width+'px';selectedNode.dataset.width=width;});
$('node-color').addEventListener('input',()=>UI.setCardColor(selectedNode,$('node-color').value));
$('node-blend').addEventListener('change',()=>{selectedNode.dataset.blend=$('node-blend').value;selectedNode.style.mixBlendMode=$('node-blend').value.toLowerCase();});
$('node-visible').addEventListener('change',()=>{selectedNode.hidden=!$('node-visible').checked;});
$('node-opacity').addEventListener('input',()=>{selectedNode.dataset.opacity=$('node-opacity').value;selectedNode.style.opacity=Number($('node-opacity').value)/100;});
board.addEventListener('pointerdown',event=>{const node=event.target.closest('[data-node]');if(!node)return;selectNode(node);delete node.dataset.uiPlacing;node.dataset.uiDragging='true';drag={node,id:event.pointerId,x:event.clientX,y:event.clientY,left:node.offsetLeft,top:node.offsetTop};node.setPointerCapture(event.pointerId);});
board.addEventListener('pointermove',event=>{if(!drag||drag.id!==event.pointerId)return;drag.node.style.left=Math.max(0,Math.min(board.clientWidth-drag.node.offsetWidth,drag.left+(event.clientX-drag.x)))+'px';drag.node.style.top=Math.max(0,Math.min(board.clientHeight-drag.node.offsetHeight,drag.top+(event.clientY-drag.y)))+'px';});
function endDrag(){if(drag){delete drag.node.dataset.uiDragging;drag.node.dataset.uiPlacing='true';drag.node.addEventListener('animationend',()=>delete drag.node.dataset.uiPlacing,{once:true});}drag=null;}board.addEventListener('pointerup',endDrag);board.addEventListener('pointercancel',endDrag);for(const node of nodes)node.addEventListener('click',()=>selectNode(node));
$('canvas-reset').addEventListener('click',()=>{for(const node of nodes){node.style.left='';node.style.top='';}zoom=1;renderZoom();});function renderZoom(){board.style.setProperty('--ui-graphic-scale',String(zoom));for(const node of nodes){node.style.scale=String(zoom);node.style.transformOrigin='top left';}$('canvas-zoom').textContent=Math.round(zoom*100)+'%';}
$('canvas-zoom-out').addEventListener('click',()=>{zoom=Math.max(.5,zoom-.1);renderZoom();});$('canvas-zoom-in').addEventListener('click',()=>{zoom=Math.min(1.5,zoom+.1);renderZoom();});$('canvas-fit').addEventListener('click',()=>{zoom=1;renderZoom();});selectNode(nodes[0]);
let playing=false,raf=null,last=null,frame=0;const keys=new Set();function timeline(){frame=Math.max(0,Math.min(120,frame));$('frame').value=Math.floor(frame);$('scrub').value=frame;$('timeline-status').textContent=(playing?'Playing':'Paused')+' · Frame '+Math.floor(frame);UI.setActionLabel($('play'),playing?'Pause':'Play',{ariaLabel:playing?'Pause timeline':'Play timeline',title:playing?'Pause timeline':'Play timeline',icon:playing?'pause':'play',sprite:'./v1/icons.svg'});}
function animate(time){if(!playing||document.visibilityState==='hidden')return;if(last!==null)frame=(frame+(time-last)/1000*Number($('fps').value))%121;last=time;timeline();raf=requestAnimationFrame(animate);}
function stopAnimation(){cancelAnimationFrame(raf);raf=null;last=null;}
$('play').addEventListener('click',()=>{playing=!playing;stopAnimation();timeline();if(playing)raf=requestAnimationFrame(animate);});$('timeline-reset').addEventListener('click',()=>{playing=false;stopAnimation();frame=0;timeline();});for(const id of ['frame','scrub'])$(id).addEventListener('input',()=>{frame=Number($(id).value)||0;timeline();});
$('add-key').addEventListener('click',()=>{const value=Math.floor(frame);if(keys.has(value))return;keys.add(value);const button=document.createElement('button');button.type='button';button.textContent='◆ '+value;button.setAttribute('aria-label','Go to keyframe '+value);button.addEventListener('click',()=>{frame=value;timeline();});$('keyframes').append(button);});
$('easing').addEventListener('change',()=>{const paths={linear:'M0 120L300 0',ease:'M0 120C150 120 150 0 300 0',in:'M0 120Q220 120 300 0',out:'M0 120Q80 0 300 0'};$('curve').querySelector('.lab-curve-line').setAttribute('d',paths[$('easing').value]);$('curve').setAttribute('aria-label',$('easing').selectedOptions[0].textContent+' easing curve');});
const media=[{name:'Reference',file:'reference.svg',alt:'Abstract reference composition'},{name:'Detail',file:'detail.svg',alt:'Abstract detail composition'},{name:'Motion',file:'motion.svg',alt:'Abstract motion composition'}];let current=0;
function lightbox(){const item=media[current];$('lightbox-name').textContent=item.name;$('lightbox-image').src='./assets/'+item.file;$('lightbox-image').alt=item.alt;delete $('lightbox-image').dataset.zoomed;$('lightbox-count').textContent=`${current+1} / ${media.length}`;}
const mediaLightbox=UI.createLightbox($('lightbox'),{onNavigate:direction=>{current=(current+direction+media.length)%media.length;lightbox();}});
for(const button of document.querySelectorAll('[data-lightbox]'))button.addEventListener('click',()=>{current=Number(button.dataset.lightbox);lightbox();mediaLightbox.open(button);});
$('lightbox-close').addEventListener('click',()=>mediaLightbox.close());$('lightbox-prev').addEventListener('click',()=>{current=(current-1+media.length)%media.length;lightbox();});$('lightbox-next').addEventListener('click',()=>{current=(current+1)%media.length;lightbox();});$('lightbox-zoom').addEventListener('click',()=>{$('lightbox-image').dataset.zoomed=String($('lightbox-image').dataset.zoomed!=='true');});$('lightbox-reset').addEventListener('click',()=>delete $('lightbox-image').dataset.zoomed);
for(const button of $('rating').querySelectorAll('[data-rating]'))button.addEventListener('click',()=>{const count=Number(button.dataset.rating);for(const peer of $('rating').querySelectorAll('[data-rating]')){const selected=Number(peer.dataset.rating)<=count;peer.setAttribute('aria-pressed',String(selected));peer.textContent=selected?'★':'☆';}});
const iconNames=JSON.parse('@@ICON_NAMES@@');for(const name of iconNames){const item=document.createElement('div'),svg=document.createElementNS('http://www.w3.org/2000/svg','svg'),use=document.createElementNS('http://www.w3.org/2000/svg','use'),label=document.createElement('span');svg.classList.add('ui-icon');svg.setAttribute('viewBox','0 0 24 24');svg.setAttribute('aria-hidden','true');use.setAttribute('href','./v1/icons.svg#ui-'+name);svg.append(use);label.textContent=name;item.append(svg,label);$('icon-grid').append(item);}
for(const audio of document.querySelectorAll('audio'))audio.volume=.15;
function describeRefresh(updated){$('live-status').textContent=!$('reload-interface').hidden?'Interface changed':updated?'CSS refreshed':'CSS current';}
function receiveBuild(data){
 if(data.labRevision&&data.labRevision!==layoutRevision){layoutRevision=data.labRevision;void refreshLayout();}
 if(data.kind==='code'){$('live-status').textContent='Interface changed';$('reload-interface').hidden=false;}
}
if(labChannel)labChannel.onmessage=event=>{if(event.data&&typeof event.data==='object')receiveBuild(event.data);};
async function refresh({manual=false}={}){
 const button=$('refresh');if(manual)button.disabled=true;
 try{
  let updated;
  if(manual&&!hostedStatic){
   const response=await fetch('./refresh',{method:'POST',headers:{'x-ui-lab':'refresh'}});if(!response.ok)throw new Error('Refresh unavailable');
   const data=await response.json();receiveBuild(data);labChannel?.postMessage(data);updated=await UI.instance.acceptRelease(data);
  }else updated=await UI.instance.refresh();
  requestAnimationFrame(tokens);describeRefresh(updated);if(manual)toast(updated?'CSS refreshed in place':'CSS is current');
 }catch{$('live-status').textContent='Using bundled styles';if(manual)toast('Bundled styles remain available');}
 finally{button.disabled=false;}
}
$('refresh').addEventListener('click',()=>refresh({manual:true}));
$('reload-interface').addEventListener('click',()=>location.reload());
function closeSource(){source?.close();source=null;sourceAbort?.abort();sourceAbort=null;}
async function openSource(){
 if(hostedStatic){$('live-status').textContent='Published styles';return;}
 if(!pageActive||document.visibilityState==='hidden'||source||lockWaiting)return;
 const controller=new AbortController();sourceAbort=controller;lockWaiting=true;
 const connect=()=>new Promise(resolve=>{if(controller.signal.aborted){resolve();return;}source=new EventSource('./events');source.onopen=()=>{$('live-status').textContent='Live CSS';};source.onmessage=event=>{try{const data=JSON.parse(event.data);receiveBuild(data);labChannel?.postMessage(data);if(data.revision)void UI.instance.acceptRelease(data).then(updated=>{requestAnimationFrame(tokens);describeRefresh(updated);}).catch(()=>{});}catch{}};source.onerror=()=>{$('live-status').textContent='Reconnecting…';};controller.signal.addEventListener('abort',()=>{source?.close();source=null;resolve();},{once:true});});
 try{if(navigator.locks){$('live-status').textContent='Live CSS';await navigator.locks.request('shared-ui-lab-stream',{signal:controller.signal},connect);}else await connect();}catch{}finally{lockWaiting=false;if(sourceAbort===controller)sourceAbort=null;if(pageActive&&document.visibilityState!=='hidden'&&controller.signal.aborted)requestAnimationFrame(()=>void openSource());}
}
async function refreshLayout(){const old=document.querySelector('link[href*="lab.css"]'),next=document.createElement('link');next.rel='stylesheet';next.href='./lab.css?refresh='+Date.now();next.media='not all';next.onload=()=>{next.media='all';old?.remove();};next.onerror=()=>next.remove();document.head.append(next);}
document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='hidden'){closeSource();stopAnimation();for(const media of document.querySelectorAll('audio,video'))media.pause();}else{void openSource();if(playing)raf=requestAnimationFrame(animate);requestAnimationFrame(tokens);}});
window.addEventListener('pagehide',event=>{pageActive=false;closeSource();stopAnimation();clearTimeout(toastTimer);if(!event.persisted){UI.releaseActions(embeddedRoot);combo.dispose();simpleTagInput.dispose();fixtureTagInput.dispose();labChannel?.close();}});window.addEventListener('pageshow',event=>{pageActive=true;if(event.persisted){void openSource();if(playing)raf=requestAnimationFrame(animate);requestAnimationFrame(tokens);}});
document.addEventListener('ui:styles',()=>requestAnimationFrame(tokens));
window.addEventListener('storage',event=>{if(event.key?.startsWith('shared-ui:v1:'))requestAnimationFrame(tokens);});
for(const action of document.querySelectorAll('[data-copy-field]'))action.addEventListener('click',async()=>{const input=action.parentElement.querySelector('input');try{await navigator.clipboard.writeText(input.value);toast('Link copied');}catch{input.focus();input.select();toast('Select and copy the link');}});
void openSource();timeline();
})();

document.getElementById('group-width')?.addEventListener('input',event=>{document.querySelector('.lab-fit-sample').style.inlineSize=`min(100%,${event.target.value}px)`;});
