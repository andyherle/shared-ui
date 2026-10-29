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
UI.createTableToolbar($('resizable-sheet'),$('sample-table-controls'),{sprite:'./v1/icons.svg'});
const colourPicker=UI.createColorPicker($('fixture-colour'),{onChange:value=>UI.setCardColor($('fixture-colour-card'),value)});
$('fixture-colour').addEventListener('click',()=>colourPicker.open());
const pack=$('pack'),mode=$('mode'),density=$('density');
const embedded=$('embedded-host').attachShadow({mode:'open'}),embeddedCSS=document.createElement('link');
embeddedCSS.rel='stylesheet';embeddedCSS.href='./v1/styles.css';embedded.append(embeddedCSS,$('embedded-form').content.cloneNode(true));
const embeddedRoot=embedded.querySelector('[data-ui]');
UI.adoptAction(embedded.querySelector('button'),{label:'Save folder',icon:'save',sprite:'./v1/icons.svg'});
embedded.querySelector('form').addEventListener('submit',event=>{event.preventDefault();const status=embedded.querySelector('[role=status]');status.textContent='Folder retained: '+embedded.querySelector('input').value;status.dataset.state='success';});
for(const swatch of document.querySelectorAll('[data-colour]'))swatch.style.setProperty('--colour',swatch.dataset.colour);
for(const action of document.querySelectorAll('[data-ui-icon]'))UI.adoptAction(action,{icon:action.dataset.uiIcon,sprite:'./v1/icons.svg'});
for(const action of document.querySelectorAll('[data-ui-number]'))UI.adoptNumberedAction(action,{number:Number(action.dataset.uiNumber),sprite:'./v1/icons.svg'});
const boundedGridCount=$('bounded-grid-count');function showBoundedChoices(){[...$('bounded-grid-demo').querySelector('.ui-grid').children].forEach((card,i)=>card.hidden=i>=Number(boundedGridCount.value));}boundedGridCount.addEventListener('change',showBoundedChoices);showBoundedChoices();
$('action-layout-choice').addEventListener('change',event=>UI.setActionLayout($('action-layout-preview'),event.target.value));
const preview=$('responsive-preview'),previewWidth=$('preview-width');
function resizePreview(value){const fit=value==='fit';const width=Math.max(180,Math.min(900,Number(value)||320));preview.style.width=fit?'100%':width+'px';if(!fit)previewWidth.value=width;$('preview-width-value').textContent=fit?'Fit container':width+' px';}
previewWidth.addEventListener('input',()=>resizePreview(previewWidth.value));
for(const button of document.querySelectorAll('[data-preview-width]'))button.addEventListener('click',()=>resizePreview(button.dataset.previewWidth));
let toastTimer=null,source=null,sourceAbort=null,lockWaiting=false,pageActive=true,layoutRevision=null,labChannel=null;
const hostedStatic=location.hostname.endsWith('.github.io');

/* Shared fixture: the same native controls stay in place; only fixture
 * chrome/positioning comes from the single reusable SharedUI API. */
const floatingDemo=$('floating-review-panel');
const floatingProvenance=()=>({
  appName:'Shared UI Style Lab',appVersion:'source-preview',
  uiVersion:root.dataset.uiVersion,cssRevision:root.dataset.uiRevision,
  variant:hostedStatic?'unverified':'candidate',
  deploymentState:hostedStatic?'unverified':'not-deployed'
});
const floatingReview=UI.createFloatingPanel(floatingDemo,{
  label:'Fixture review',placement:'bottom-right',provenance:floatingProvenance()
});
$('floating-demo-toggle').addEventListener('click',()=>{
  floatingDemo.hidden=!floatingDemo.hidden;
  const opened=!floatingDemo.hidden;
  $('floating-demo-toggle').textContent=opened?'Hide review panel':'Show review panel';
  $('floating-demo-toggle').setAttribute('aria-expanded',String(opened));
  if(opened)floatingReview.reflow();
});
$('floating-demo-action').addEventListener('click',()=>{
  $('floating-demo-result').textContent='Retained: '+$('floating-demo-input').value;
});

try{if(window.BroadcastChannel)labChannel=new BroadcastChannel('shared-ui-lab-events');}catch{}
function toast(text){$('toast').textContent=text;$('toast').hidden=false;clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('toast').hidden=true,2800);}
function tokens(){const style=getComputedStyle(root),items=[['Background','bg'],['Surface','surface'],['Text','text'],['Muted','muted'],['Border','line'],['Accent','accent'],['Primary','primary'],['Focus','accent']];$('tokens').replaceChildren();for(const [name,key] of items){const group=document.createElement('div'),swatch=document.createElement('span'),term=document.createElement('dt'),value=document.createElement('dd');swatch.className='lab-token-swatch';swatch.style.background=style.getPropertyValue('--ui-'+key);term.textContent=name;value.textContent=style.getPropertyValue('--ui-'+key).trim();group.append(swatch,term,value);$('tokens').append(group);}$('revision').textContent='Style revision · '+(root.dataset.uiRevision||'bundled').slice(0,12);}
function appearance(){embeddedRoot.dataset.ui=pack.value;embeddedRoot.dataset.theme=mode.value;embeddedRoot.dataset.uiDensity=density.value;root.dataset.ui=pack.value;root.dataset.theme=mode.value;if(density.value==='default')delete document.body.dataset.uiDensity;else document.body.dataset.uiDensity=density.value;try{sessionStorage.setItem('style-lab-appearance',JSON.stringify({pack:pack.value,mode:mode.value,density:density.value}));}catch{}requestAnimationFrame(tokens);$('embed-example').textContent=`<html data-ui="${pack.value}" data-theme="${mode.value}">\n<link rel="stylesheet" href="${new URL('./v1/styles.css',location.href).href}">\n<button data-ui-variant="primary">Save</button>\n<article class="ui-prose">…</article>`;}
try{const saved=JSON.parse(sessionStorage.getItem('style-lab-appearance')||'null');if(saved&&['personal','postvisual'].includes(saved.pack)&&['light','dark'].includes(saved.mode)){pack.value=saved.pack;mode.value=saved.mode;if(['default','dense','compact','micro','comfortable'].includes(saved.density))density.value=saved.density;}}catch{}
for(const select of [pack,mode,density])select.addEventListener('change',appearance);appearance();$('css-url').value=new URL('./v1/styles.css',location.href).href;
$('copy-css').addEventListener('click',async()=>{try{await navigator.clipboard.writeText($('css-url').value);toast('CSS URL copied');}catch{$('css-url').focus();$('css-url').select();toast('Select and copy the CSS URL');}});
document.addEventListener('click',event=>{
const button=event.target.closest('button');if(!button)return;
if(button.dataset.toast){UI.setActionState(button,{state:'success',message:button.dataset.toast,sprite:'./v1/icons.svg'});button.closest('details.ui-menu')?.removeAttribute('open');}
if(button.dataset.dialog){button.closest('details.ui-menu')?.removeAttribute('open');$(button.dataset.dialog).showModal();}
if(button.hasAttribute('data-toggle'))button.setAttribute('aria-pressed',String(button.getAttribute('aria-pressed')!=='true'));
if(button.dataset.segment){for(const peer of document.querySelectorAll(`[data-segment="${button.dataset.segment}"]`))peer.setAttribute('aria-pressed',String(peer===button));}
});
$('compact-search-form').addEventListener('submit',event=>{event.preventDefault();toast('Search keeps its value and native form behavior.');});
$('busy-button').addEventListener('click',async()=>{const button=$('busy-button');button.disabled=true;button.setAttribute('aria-busy','true');button.querySelector('span').textContent='Running…';$('busy-status').textContent='Working';$('busy-status').dataset.state='pending';await new Promise(resolve=>setTimeout(resolve,750));button.disabled=false;button.removeAttribute('aria-busy');button.querySelector('span').textContent='Run task';$('busy-status').textContent='Completed';$('busy-status').dataset.state='success';});
const compactAnswer=$('compact-answer-form');UI.createSubmitGuard(compactAnswer);
compactAnswer.addEventListener('submit',event=>{event.preventDefault();const status=compactAnswer.querySelector('[role=status]');status.textContent='Answer saved.';status.dataset.state='success';});
const form=$('sample-form');form.addEventListener('submit',event=>{event.preventDefault();let invalid=null;for(const field of form.elements){if(typeof field.checkValidity!=='function')continue;const valid=field.checkValidity();field.setAttribute('aria-invalid',String(!valid));if(!valid&&!invalid)invalid=field;}if(invalid){$('form-status').textContent='Check the highlighted fields.';$('form-status').className='ui-status';$('form-status').dataset.state='error';invalid.focus();return;}$('form-status').textContent='Validation passed. Sample values retained.';$('form-status').className='ui-status';$('form-status').dataset.state='success';});
form.addEventListener('input',event=>{if(event.target.getAttribute('aria-invalid')==='true')event.target.setAttribute('aria-invalid',String(!event.target.checkValidity()));});form.addEventListener('reset',()=>{for(const field of form.elements)field.removeAttribute('aria-invalid');$('form-status').textContent='';delete $('form-status').dataset.state;});
const combo=UI.createCombobox($('combobox'),{options:['Button','Canvas','Checkbox','Color picker','Dialog','Disclosure','Lightbox','Menu','Search','Selector','Slider','Table','Tabs','Textarea','Timeline'],onSelect:item=>toast(item.label+' selected')});
function tagPill(tag,remove){const button=document.createElement('button');button.type='button';button.className='ui-tag';const label=document.createElement('span'),mark=document.createElement('span');label.textContent=tag;mark.textContent='×';mark.setAttribute('aria-hidden','true');button.append(label,mark);button.setAttribute('aria-label','Remove '+tag);button.addEventListener('click',remove);return button;}
const simpleTags=new Set();const simpleTagInput=UI.createTagInput($('tag-input'),{field:$('tag-field'),chips:$('tags'),options:()=>['Landscape','Motion','Portrait','Detail'],excluded:()=>[...simpleTags],onCommit:value=>{for(const tag of value.split(',').map(x=>x.trim()).filter(Boolean)){if(simpleTags.has(tag))continue;simpleTags.add(tag);const pill=tagPill(tag,()=>{simpleTags.delete(tag);pill.remove();});$('tags').append(pill);}}});
const fixtureTags=new Set(['Editorial','motion']);
function drawFixtureTags(){for(const pill of $('fixture-tags').querySelectorAll('.ui-tag'))pill.remove();for(const tag of fixtureTags){const pill=tagPill(tag,()=>{fixtureTags.delete(tag);pill.remove();fixtureTagInput.draw();});$('fixture-tag-form').before(pill);}}
const fixtureTagInput=UI.createTagInput($('fixture-tag-input'),{options:()=>['Editorial','motion','Mood','Portrait','Texture','Wide'],excluded:()=>[...fixtureTags],onCommit:value=>{for(const tag of value.split(',').map(x=>x.trim()).filter(Boolean))if(![...fixtureTags].some(existing=>existing.toLocaleLowerCase()===tag.toLocaleLowerCase()))fixtureTags.add(tag);drawFixtureTags();$('fixture-tag-status').textContent='Tags saved';$('fixture-tag-status').dataset.state='success';}});drawFixtureTags();
$('fixture-tag-form').addEventListener('submit',event=>{event.preventDefault();fixtureTagInput.flush();});
$('fixture-tag-input').addEventListener('keydown',event=>{if(event.key==='Enter'&&event.shiftKey){event.preventDefault();fixtureTagInput.flush();$('fixture-tag-status').textContent='Saved · next media';}});
const fixtureZoom=UI.createZoom($('fixture-zoom'),{min:72,max:420,step:20,value:220,outLabel:'Smaller tiles',inLabel:'Larger tiles',format:value=>value+' px',sprite:'./v1/icons.svg'});
UI.adoptAction($('fixture-save'),{labelStates:['Save','Saving…','Saved'],sprite:'./v1/icons.svg'});

function fixtureState(){
 const header=$('fixture-workspace-header'),before=UI.captureLayout(header),state=$('fixture-state').value,button=$('fixture-save');
 $('fixture-layout-check').textContent='Checking…';delete $('fixture-layout-check').dataset.checkedState;
 UI.setActionState(button,{state:state==='saving'?'pending':state==='saved'?'success':state==='error'?'error':'idle',message:{live:'Ready',dirty:'Unsaved',saving:'Saving…',saved:'Saved',error:'Save failed'}[state],sprite:'./v1/icons.svg'});
 button.disabled=state==='saving';$('fixture-workspace-status').hidden=true;
 requestAnimationFrame(()=>requestAnimationFrame(()=>{const issues=[...UI.compareLayout(before),...UI.auditControls(header).issues.filter(issue=>issue.severity==='error')],output=$('fixture-layout-check');output.textContent=issues.length?issues.map(issue=>issue.code+': '+issue.name).join('; '):'Stable · no command movement';output.dataset.state=issues.length?'error':'live';output.dataset.checkedState=state;}));
}
$('fixture-state').addEventListener('change',fixtureState);
$('fixture-save').addEventListener('click',()=>{$('fixture-state').value='saved';fixtureState();});
function fixtureWidth(value){$('fixture-container').style.inlineSize=value==='fit'?'100%':`min(100%,${value}px)`;$('fixture-width-value').textContent=value==='fit'?'Fit':value;if(value!=='fit')$('fixture-width').value=value;}
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
const media=[{name:'Reference',file:'reference.svg',alt:'Abstract reference composition'},{name:'Detail',file:'detail.svg',alt:'Abstract detail composition'},{name:'Motion',file:'motion.svg',alt:'Abstract motion composition',video:true}];let current=0;
const lightboxFullscreen=UI.createFullscreen($('lightbox-fullscreen'),{scope:$('lightbox'),media:()=>$('lightbox-video').hidden?null:$('lightbox-video'),sprite:'./v1/icons.svg'});
function lightbox(){const item=media[current];$('lightbox-video').pause();$('lightbox-video').hidden=!item.video;$('lightbox-image').hidden=Boolean(item.video);$('lightbox-zoom').disabled=$('lightbox-reset').disabled=Boolean(item.video);lightboxFullscreen.refresh();$('lightbox-name').textContent=item.name;$('lightbox-image').src='./assets/'+item.file;$('lightbox-image').alt=item.alt;delete $('lightbox-image').dataset.zoomed;$('lightbox-count').textContent=`${current+1} / ${media.length}`;}
const mediaLightbox={open(){ $('lightbox').showModal(); },close(){ $('lightbox').close(); }};
$('lightbox').addEventListener('close',()=>{$('lightbox-video').pause();});
$('lightbox').addEventListener('keydown',event=>{if(event.target.closest('input,textarea,select')||!['ArrowLeft','ArrowRight'].includes(event.key))return;event.preventDefault();current=(current+(event.key==='ArrowLeft'?-1:1)+media.length)%media.length;lightbox();});
const holdExample=$('lightbox-hold'),selectExample=()=>holdExample.setAttribute('aria-pressed',String(holdExample.getAttribute('aria-pressed')!=='true'));
UI.createPressHold(holdExample,{onHold:selectExample});holdExample.addEventListener('click',selectExample);
for(const button of document.querySelectorAll('[data-lightbox]'))button.addEventListener('click',()=>{current=Number(button.dataset.lightbox);lightbox();mediaLightbox.open(button);});
$('lightbox-close').addEventListener('click',()=>mediaLightbox.close());$('lightbox-prev').addEventListener('click',()=>{current=(current-1+media.length)%media.length;lightbox();});$('lightbox-next').addEventListener('click',()=>{current=(current+1)%media.length;lightbox();});$('lightbox-zoom').addEventListener('click',()=>{$('lightbox-image').dataset.zoomed=String($('lightbox-image').dataset.zoomed!=='true');});$('lightbox-reset').addEventListener('click',()=>delete $('lightbox-image').dataset.zoomed);
for(const button of $('rating').querySelectorAll('[data-rating]'))button.addEventListener('click',()=>{const count=Number(button.dataset.rating);for(const peer of $('rating').querySelectorAll('[data-rating]')){const selected=Number(peer.dataset.rating)<=count;peer.setAttribute('aria-pressed',String(selected));peer.textContent=selected?'★':'☆';}});
const iconNames=JSON.parse('@@ICON_NAMES@@');for(const name of iconNames){const item=document.createElement('div'),svg=document.createElementNS('http://www.w3.org/2000/svg','svg'),use=document.createElementNS('http://www.w3.org/2000/svg','use'),label=document.createElement('span');svg.classList.add('ui-icon');svg.setAttribute('viewBox','0 0 24 24');svg.setAttribute('aria-hidden','true');use.setAttribute('href','./v1/icons.svg#ui-'+name);svg.append(use);label.textContent=name;item.append(svg,label);$('icon-grid').append(item);}
for(const audio of document.querySelectorAll('audio'))audio.volume=.15;
function describeRefresh(updated){$('live-status').textContent=!$('reload-interface').hidden?'Changed':updated?'Updated':'Current';}
function receiveBuild(data){
 if(data.labRevision&&data.labRevision!==layoutRevision){layoutRevision=data.labRevision;void refreshLayout();}
 if(data.kind==='code'){$('live-status').textContent='Changed';$('reload-interface').hidden=false;}
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
window.addEventListener('pagehide',event=>{pageActive=false;closeSource();stopAnimation();clearTimeout(toastTimer);if(!event.persisted){floatingReview.dispose();UI.releaseActions(embeddedRoot);combo.dispose();simpleTagInput.dispose();fixtureTagInput.dispose();labChannel?.close();}});window.addEventListener('pageshow',event=>{pageActive=true;if(event.persisted){void openSource();if(playing)raf=requestAnimationFrame(animate);requestAnimationFrame(tokens);}});
document.addEventListener('ui:styles',()=>{floatingReview.setProvenance(floatingProvenance());requestAnimationFrame(tokens);});
window.addEventListener('storage',event=>{if(event.key?.startsWith('shared-ui:v1:'))requestAnimationFrame(tokens);});
for(const action of document.querySelectorAll('[data-copy-field]'))action.addEventListener('click',async()=>{const input=action.parentElement.querySelector('input');try{await navigator.clipboard.writeText(input.value);toast('Link copied');}catch{input.focus();input.select();toast('Select and copy the link');}});
for(const name of ['Alice Example','Very long collaborator name that stays in a tooltip'])$('fixture-avatars').append(UI.createAvatar(name));

const zoomFeedback=UI.createZoomFeedback(document,{sprite:'./v1/icons.svg'});
const zoomFixture=direction=>{fixtureZoom.setValue(direction?fixtureZoom.value+direction*20:220);zoomFeedback.show(fixtureZoom.value/220*100);};
document.addEventListener('ui:zoom',event=>zoomFixture(event.detail.direction));
UI.installZoomShortcuts(document,{canZoom:()=>!$('control-fixture').hidden&&!document.querySelector('dialog[open]'),onZoom:zoomFixture});

// Browse one component without rebuilding its native nodes or drafts.
const catalogueSections=[...document.querySelectorAll('#main > section')];
const componentSelect=$('component-select');
const catalogueGroups=new Map();
const groupFor=id=>{
  if(['foundations','content','icons'].includes(id))return 'Foundations';
  if(['filters','buttons','fields','choice','navigation','overlays','selection-navigation','embedded'].includes(id))return 'Controls';
  if(['page-width','responsive','compact-actions','adaptive-groups','workspace-density','compositions'].includes(id))return 'Layout';
  if(['sheet','data','file-previews'].includes(id))return 'Records and files';
  if(['control-fixture','floating-review','debug-console'].includes(id))return 'Advanced examples';
  if(id==='integration')return 'Development';
  return 'Workspace components';
};
for(const [index,section]of catalogueSections.entries()){
  const heading=section.querySelector('h2,h3,h4,h5');
  if(!section.id)section.id='component-'+index;
  const label=heading?.textContent.trim()||section.getAttribute('aria-label')||'Example '+(index+1);
  section.dataset.catalogueTitle=label;
  const category=groupFor(section.id);
  if(!catalogueGroups.has(category)){
    const group=document.createElement('optgroup');group.label=category;
    catalogueGroups.set(category,group);componentSelect.append(group);
  }
  const option=document.createElement('option');option.value=section.id;option.textContent=label;
  catalogueGroups.get(category).append(option);
  if(heading?.parentElement===section||heading?.parentElement===section.firstElementChild)heading.hidden=true;
}
function showCatalogueComponent(){
  let id;try{id=decodeURIComponent(location.hash.slice(1));}catch{id='';}
  const target=document.getElementById(id);
  const selected=catalogueSections.find(section=>section.id===id||target&&section.contains(target))||catalogueSections[0];
  for(const section of catalogueSections){
    section.hidden=section!==selected;
    if(section.hidden)for(const media of section.querySelectorAll('video,audio'))media.pause();
  }
  if(selected.id!=='timeline'){playing=false;stopAnimation();timeline();}
  if(selected.id!=='floating-review'){
    floatingDemo.hidden=true;
    $('floating-demo-toggle').setAttribute('aria-expanded','false');
    UI.setActionLabel($('floating-demo-toggle'),'Show review panel');
  }
  componentSelect.value=selected.id;
  $('component-title').textContent=selected.dataset.catalogueTitle;
  $('component-category').textContent=groupFor(selected.id);
  $('component-category').hidden=groupFor(selected.id)===selected.dataset.catalogueTitle;
  zoomFeedback.setVisible(selected.id==='control-fixture');
  document.querySelector('.lab-footer').hidden=true;
  UI.refreshActions(selected);
}
componentSelect.addEventListener('change',()=>{
  history.pushState(null,'','#'+componentSelect.value);showCatalogueComponent();window.scrollTo(0,0);
});
window.addEventListener('hashchange',showCatalogueComponent);
window.addEventListener('popstate',showCatalogueComponent);
showCatalogueComponent();

void openSource();timeline();
})();

document.getElementById('group-width')?.addEventListener('input',event=>{document.querySelector('.lab-fit-sample').style.inlineSize=`min(100%,${event.target.value}px)`;});

{const node=document.getElementById('fixtureSecondary');if(node)window.SharedUI.createAdaptiveSlot(node,{container:node.closest('.ui-header'),target:document.getElementById('fixtureSecondarySlot')});}

for(const input of document.querySelectorAll('.ui-function-value'))window.SharedUI.createFunctionControl(input);

// Both inspector previews mount the same shared components. Density only changes tokens.
function mountInspectorDemo(panel){
 const UI=window.SharedUI,doc=document,disposables=[];
 for(const [name,kind] of [['Tint','colour'],['Rotation','number'],['Visible','boolean']]){
  const row=doc.createElement('div');panel.append(row);
  const actions=doc.createElement('div');actions.className='ui-actions ui-inline';
  let control,onReset;
  if(kind==='boolean'){const value=UI.createBooleanControl({label:name,value:true,variant:'controller'});control=value.element;disposables.push(value);onReset=()=>value.setValue(true);}
  else if(kind==='colour'){const value=UI.createColourValue({label:name});value.sync('#7aa8ff');control=value.element;onReset=()=>value.sync('#7aa8ff');}
  else {control=doc.createElement('div');control.className='ui-field';const input=doc.createElement('input');input.type='text';input.value='45';input.setAttribute('aria-label','Rotation base value');control.append(input);disposables.push(UI.createFunctionControl(input));onReset=()=>{input.value='45';};
   const steppers=UI.createNumberSteppers(input,{label:name,step:.1,onStep:delta=>{input.value=String(Number((Number(input.value)+delta*.1).toPrecision(12)));input.dispatchEvent(new Event('input',{bubbles:true}));}});control.append(steppers.element);disposables.push(steppers);
   let expressionValue=null;
   const editor=UI.createExpressionEditor({label:name,sprite:'./v1/icons.svg',suggestions:[{insert:'base',description:'Keyframed or set base value'},{insert:'sin(time)',description:'Sine motion'},{insert:'noise(time, 0)',description:'Smooth noise'},{insert:'time',description:'Current time in seconds'}],onCommit:async expression=>{expressionValue=expression;UI.setExpressionState(input,{expression,base:input.value,result:input.value,onActivate:()=>editor.toggle(),controls:editor.element.id,label:name});editor.sync({expression,base:input.value,value:input.value});}});
   const key=doc.createElement('button');key.type='button';key.setAttribute('aria-label','Keyframe Rotation');let keyed=false;UI.setKeyframeState(key,{present:keyed,keyframed:keyed,sprite:'./v1/icons.svg'});key.addEventListener('click',()=>{keyed=!keyed;UI.setKeyframeState(key,{present:keyed,keyframed:keyed,sprite:'./v1/icons.svg'});});
   input.addEventListener('input',()=>editor.sync({expression:expressionValue,base:input.value,value:input.value}));
   disposables.push(editor);actions.prepend(key,editor.trigger);row.after(editor.element);editor.sync({base:45,value:45});
  }
  UI.adoptPropertyRow(row,{name,control,actions});UI.setPropertyAction(row,{onReset});UI.orderPropertyActions(actions);
 }
 for(const [name,control] of [['Geometry',UI.createChoiceControl({label:'Geometry',sprite:'./v1/icons.svg',options:['Cube','Sphere','Torus'],value:'Cube'})],['Palette',UI.createChoiceControl({label:'Palette',sprite:'./v1/icons.svg',options:['Aurora','Ember','Lagoon','Orchid','Citrus','Glacier','Rose','Copper'],value:'Aurora'})]]){const row=document.createElement('div'),actions=document.createElement('div');disposables.push(control);actions.className='ui-actions ui-inline';panel.append(row);UI.adoptPropertyRow(row,{name,control:control.element,actions});}
  for(const [name,multiline,readonly,value] of [['Title',false,false,'Control / Motion'],['Caption',true,false,'A shared language\nfor live controls'],['Active events',false,true,'3']]){const row=document.createElement('div'),field=document.createElement('div'),input=document.createElement(multiline?'textarea':'input'),actions=document.createElement('div');field.className='ui-field';input.value=value;input.readOnly=readonly;if(multiline)input.rows=2;field.append(input);actions.className='ui-actions ui-inline';panel.append(row);UI.adoptPropertyRow(row,{name,control:field,actions:readonly?undefined:actions});}
  const actionRow=document.createElement('div'),action=document.createElement('button');action.type='button';UI.adoptAction(action,{label:'Burst now',icon:'add',sprite:'./v1/icons.svg'});action.addEventListener('click',()=>UI.setActionState(action,{state:'success',sprite:'./v1/icons.svg'}));panel.append(actionRow);UI.adoptPropertyAction(actionRow,{name:'Trigger',label:'Burst now',action,icon:'add',sprite:'./v1/icons.svg'});
  const advanced=document.createElement('details');advanced.className='ui-section';advanced.innerHTML='<summary><h5>Curves &amp; channels</h5></summary><div class="ui-stack"></div>';panel.append(advanced);const advancedBody=advanced.lastElementChild;
  const curve=UI.createCurveValue({label:'Event envelope',sprite:'./v1/icons.svg'});disposables.push(curve);const curveRow=doc.createElement('div');advancedBody.append(curveRow);UI.adoptPropertyRow(curveRow,{name:'Event envelope',control:curve.element});
  const response=UI.createResponseControl({spec:{label:'Response',default:1,curve:'power-in',inputMin:.05,inputMax:12,step:.01},model:{powerCurve:(v,x)=>Math.pow(x,v),curveExponent:(x,y)=>Math.log(Math.max(.0001,Math.min(.9999,y)))/Math.log(Math.max(.0001,Math.min(.9999,x))),numberStep:s=>s.step,steppedNumber:(v,d,s)=>Math.max(s.inputMin,Math.min(s.inputMax,v+d*s.step))},onSet:()=>{}});advancedBody.append(response.element);disposables.push(response);
  const spec={key:'start',label:'Colour interval',min:0,max:1,step:.01,rangeControl:{end:'end',mode:'absolute',spectrum:'hue'}};
  const editor=UI.createIntervalControl({spec,onSet:()=>{},onError:console.error,model:{sliderBounds:(s,v)=>({min:Math.min(s.min,v),max:Math.max(s.max,v)}),rangeEndpoint:(s,e)=>e,rangeValue:(s,e)=>e,typedNumber:value=>{if(String(value).trim()===''||!Number.isFinite(Number(value)))throw new Error('Enter a finite number');return Number(value);},numberStep:s=>s.step||.01,steppedNumber:(v,d,s)=>v+d*(s.step||.01),wireNumberInput:()=>{}}});advancedBody.append(editor.element);disposables.push(editor);editor.sync(.1,spec,[{key:'end',value:.8,step:.01}]);
const row=document.createElement('div'),field=document.createElement('select');field.multiple=true;field.size=3;field.setAttribute('aria-label','Channels');for(const name of ['Colour','Shape','Motion']){const option=document.createElement('option');option.value=option.textContent=name;option.selected=name==='Colour';field.append(option);}advancedBody.append(row);window.SharedUI.adoptPropertyRow(row,{name:'Channels',control:field});
 window.addEventListener('pagehide',()=>{for(const control of disposables)control.dispose?.();},{once:true});
}
for(const panel of document.querySelectorAll('[data-effects-demo]'))mountInspectorDemo(panel);
document.getElementById('property-fixture-width')?.addEventListener('change',event=>document.getElementById('fixture-property-panel').style.inlineSize=event.target.value);
{
const panel=document.getElementById('micro-panel-demo'),input=document.getElementById('control-panel-font-size');
if(panel&&input){
  const scale=SharedUI.createControlScale(panel,{fontSize:Number(input.value)});
  input.addEventListener('input',()=>{if(input.validity.valid&&input.valueAsNumber>0)scale.setFontSize(input.valueAsNumber);});
  document.getElementById('micro-panel-density')?.addEventListener('change',event=>{panel.dataset.uiDensity=event.target.value;scale.refresh();});
}
}
for(const action of document.querySelectorAll('[data-keyframe-state]'))window.SharedUI.setKeyframeState(action,{present:action.dataset.keyframeState==='present',keyframed:action.dataset.keyframeState!=='empty',sprite:'./v1/icons.svg'});


{
const UI=window.SharedUI,$=id=>document.getElementById(id);
const textSuggestions=UI.createTextSuggestions($('text-suggestions'),{label:'Files',onSelect:item=>{const input=$('text-suggestions'),start=input.value.lastIndexOf('[[');input.setRangeText(item.value,start,input.selectionStart,'end');input.dispatchEvent(new Event('input',{bubbles:true}));}});
$('text-suggestions').addEventListener('input',()=>{const input=$('text-suggestions'),before=input.value.slice(0,input.selectionStart),start=before.lastIndexOf('[[');if(start<0||before.slice(start+2).includes(']')){textSuggestions.hide();return;}const query=before.slice(start+2).toLowerCase();textSuggestions.show(['Projects/Proposal.md','People/Example.md','Files/Reference.pdf'].filter(path=>path.toLowerCase().includes(query)).map(path=>({label:path,value:'[['+path.replace(/\.md$/,'')+']]'})));});

}

{const group=document.getElementById('fixture-panel-toggles');if(group)window.SharedUI.createPanelToggles({items:[...group.querySelectorAll('button')].map(button=>({id:button.dataset.panel,button,panel:document.getElementById('fixture-panel-'+button.dataset.panel)})),selected:['timeline']});}

{const root=document.getElementById('fixture-section-root'),actions=document.getElementById('fixture-section-actions');if(root&&actions)window.SharedUI.createSectionActions({root,actions});}
{const surface=document.getElementById('fixture-preview-stage'),content=document.getElementById('fixture-preview-media');if(surface&&content){const view=window.SharedUI.createMediaViewport({surface,content,onChange({scale}){document.getElementById('fixture-preview-scale').textContent=Math.round(scale*100)+'%';}});document.getElementById('fixture-preview-in').onclick=()=>view.zoom(1.2);document.getElementById('fixture-preview-out').onclick=()=>view.zoom(1/1.2);document.getElementById('fixture-preview-fit').onclick=()=>view.fit();window.addEventListener('pagehide',()=>view.dispose(),{once:true});}}

{const root=document.getElementById('fixture-preview-catalogue');if(root){const image=new URL('assets/reference.svg',location.href).href,items=['Geometry','Response','Network','Material'].map((label,i)=>({id:String(i),label,image,detail:'Synthetic scene · 16:9'}));const catalogue=window.SharedUI.createPreviewCatalogue({root,onSelect:id=>catalogue.update(items,id)});catalogue.update(items,'0');document.getElementById('fixture-proof-sheet').onclick=async()=>{const {canvas}=await window.SharedUI.renderProofSheet({items,title:'Synthetic proof sheet'}),link=document.getElementById('fixture-proof-download');link.href=canvas.toDataURL('image/png');link.hidden=false;};}}

{const toolbar=document.getElementById('context-demo-actions');if(toolbar){for(const [index,button]of [...toolbar.querySelectorAll('button')].entries())window.SharedUI.adoptAction(button,{label:button.textContent,icon:['edit','image','layers','palette'][index],sprite:'./v1/icons.svg'});const dock=window.SharedUI.createContextToolbar(toolbar,{container:document.getElementById('context-demo'),zoom:document.getElementById('context-demo-zoom')});window.addEventListener('pagehide',()=>dock.dispose(),{once:true});}}

{const panel=document.getElementById('resize-demo-panel');if(panel){const resize=window.SharedUI.createResizablePanel(panel,{container:document.getElementById('resize-demo'),value:320,min:160,minMain:180});window.addEventListener('pagehide',()=>resize.dispose(),{once:true});}}

{for(const panel of document.querySelectorAll('[data-effects-demo]')){const row=document.createElement('div'),input=document.createElement('input');input.className='ui-field';input.placeholder='Type anything';panel.append(row);SharedUI.adoptPropertyRow(row,{name:'Suggested text',control:input});const suggestions=SharedUI.createSuggestedInput(input,{options:()=>['Motion','Mood','Monochrome'],onCommit:value=>{input.value=value;}});window.addEventListener('pagehide',()=>suggestions.dispose(),{once:true});}}

window.SharedUI.createColorWheel({root:document.getElementById('colour-wheel'),multiple:true});

{const root=document.getElementById('review-controls-demo');if(root){const UI=window.SharedUI,review=UI.createReviewControls(root,{layout:'rows',navigation:root.querySelector('nav'),iconOnly:false,sprite:'./v1/icons.svg'}),input=root.querySelector('input'),chips=root.querySelector('[aria-label="Selected review tags"]');const addTag=tag=>{const button=document.createElement('button');button.type='button';button.className='ui-tag';UI.adoptAction(button,{label:tag,ariaLabel:'Remove '+tag});const remove=document.createElement('span');remove.setAttribute('aria-hidden','true');remove.textContent='×';button.append(remove);button.addEventListener('click',()=>button.remove());chips.append(button);};const control=UI.createTagInput(input,{field:review.slots.tags,chips,layout:'field',options:()=>['Motion','Reference','Texture'],onCommit:addTag});for(const tag of ['Motion','Reference','Colour study','Long descriptive reference tag'])addTag(tag);root.querySelector('form').addEventListener('submit',event=>{event.preventDefault();control.flush();});window.addEventListener('pagehide',()=>{control.dispose();review.dispose();},{once:true});}}

{const swatches=document.getElementById('swatch-panel-demo');if(swatches){SharedUI.createColorPanel({root:swatches,multiple:true});const toggle=SharedUI.createBooleanControl({label:'Show selected only',variant:'controller'});SharedUI.adoptPropertyRow(document.getElementById('toggle-action-demo'),{name:'Show selected only',control:toggle.element});const action=SharedUI.createFilterButton({sprite:'./v1/icons.svg'});document.getElementById('filter-action-demo').append(action.element);const confirmation=SharedUI.createConfirmAction(action.element,{message:'Clear this sample filter selection?',label:'Clear selection',sprite:'./v1/icons.svg',onConfirm:()=>{}});action.element.addEventListener('click',confirmation.open);}}

{const form=document.getElementById('filter-form-demo');if(form){
 const rows=[...document.querySelectorAll('#filter-records-demo tr')];
 const apply=values=>{let count=0;for(const row of rows){row.hidden=Boolean(values.query&&!row.textContent.toLowerCase().includes(values.query.toLowerCase())||values.status&&row.dataset.status!==values.status||values.from&&row.dataset.date<values.from||values.to&&row.dataset.date>values.to);if(!row.hidden)count++;}document.getElementById('filter-count-demo').textContent=`${count} of ${rows.length} records`;};
 const filters=SharedUI.createFilterMenu(form,{sprite:'./v1/icons.svg',onChange:apply});form.addEventListener('submit',event=>{event.preventDefault();apply(filters.values);});
}}

{const start=document.getElementById('guide-start');if(start){let step=0;const guide=SharedUI.createGuide({sprite:'./v1/icons.svg',onBack:()=>{step=Math.max(0,step-1);show();},onRestart:()=>{step=0;show();},onSkip:()=>guide.close(),onNext:()=>{if(step===0){step=1;show();}else guide.close();}});function show(){guide.update({title:step===2?'Saved':'Try a guided action',text:step===0?'The lesson leaves the sample field and normal controls usable. Continue, then save the sample note.':step===1?'Focus the sample note, type if you wish, and use Save sample. This step waits for the form submission.':'The form acknowledged its save. No timer advanced the lesson.',position:step+1,total:3,target:step===1?()=>document.getElementById('guide-save'):null,canNext:step!==1,nextLabel:step===2?'Done':'Next'});}start.addEventListener('click',()=>{step=0;guide.open({});show();});document.getElementById('guide-form').addEventListener('submit',event=>{event.preventDefault();document.getElementById('guide-result').textContent='Sample note saved';if(step===1){step=2;show();}});}}

{const UI=window.SharedUI,root=document.getElementById('compact-record-demo');if(root){const title=root.querySelector('#compact-title-row');UI.adoptPropertyRow(title,{name:'Title',control:title.querySelector('.ui-field'),layout:'compact'});const row=root.querySelector('#compact-tags-row'),field=root.querySelector('#compact-tags-field'),input=root.querySelector('#compact-tag-entry'),chips=root.querySelector('#compact-tag-chips');UI.adoptPropertyRow(row,{name:'Tags',control:field,layout:'compact'});const control=UI.createTagInput(input,{field,chips,layout:'field',options:()=>['Motion','Reference','Texture'],onCommit:value=>{const tag=document.createElement('button');tag.type='button';tag.className='ui-tag';UI.adoptAction(tag,{label:value,ariaLabel:'Remove '+value,sprite:'./v1/icons.svg'});tag.addEventListener('click',()=>tag.remove());chips.append(tag);}});field.querySelector('form').addEventListener('submit',event=>{event.preventDefault();control.flush();});for(const value of ['Motion','Reference']){input.value=value;control.flush();}window.addEventListener('pagehide',()=>control.dispose(),{once:true});}}
{const UI=window.SharedUI,trigger=document.getElementById('recent-choice-trigger'),element=document.getElementById('recent-choice-tray');if(trigger&&element){UI.adoptAction(trigger,{icon:'grid',label:'Recent choices',sprite:'./v1/icons.svg'});const host=UI.createAnchoredPopover(trigger,{element}),search=element.querySelector('input');for(const button of element.querySelectorAll('[data-choice]')){UI.adoptAction(button,{icon:button.dataset.uiIcon,label:button.textContent,sprite:'./v1/icons.svg'});button.addEventListener('click',()=>{document.getElementById('recent-choice-result').textContent=button.dataset.choice+' selected';host.close();trigger.focus();});}search.addEventListener('input',()=>{for(const button of element.querySelectorAll('[data-choice]'))button.hidden=!button.dataset.choice.toLowerCase().includes(search.value.toLowerCase());});window.addEventListener('pagehide',()=>host.dispose(),{once:true});}}
{const UI=window.SharedUI,field=document.getElementById('search-slot-field');if(field){const slot=UI.createResponsiveSlot(field,{primary:document.getElementById('search-slot-primary'),fallback:document.getElementById('search-slot-fallback')});window.addEventListener('pagehide',()=>slot.dispose(),{once:true});}}

{const start=document.getElementById('guide-tray-start');if(start){const tray=document.getElementById('guide-tray'),input=document.getElementById('guide-tray-note');let saved=false;const guide=SharedUI.createGuide({sprite:'./v1/icons.svg',onSkip:()=>guide.close(),onNext:()=>guide.close()});const host=SharedUI.createAnchoredPopover(start,{element:tray,onClose:()=>guide.close()});function show(){guide.update({title:saved?'Tray saved':'Keep the tray usable',text:saved?'The real form acknowledged its save.':'Focus the note and save it. Coaching stays inside the native tray so its controls remain usable.',target:saved?null:()=>input,position:saved?2:1,total:2,canNext:saved,nextLabel:'Done'});}start.addEventListener('click',()=>{if(!tray.matches(':popover-open'))return;saved=false;guide.open({});show();});document.getElementById('guide-tray-form').addEventListener('submit',event=>{event.preventDefault();saved=true;document.getElementById('guide-tray-result').textContent='Tray note saved';show();});}}
