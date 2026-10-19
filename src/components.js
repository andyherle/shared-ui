/* Optional native DOM helpers; no application state or rendering loop. */
(() => {
  'use strict';
  if(typeof window==='undefined'||!window.SharedUI)return;
  const UI=window.SharedUI,documents=new WeakMap();
  // Inspector rows share stable label/value/action columns; original controls stay alive.
  UI.adoptPropertyRow=(row,{name,control,actions}={})=>{
    const hasActions=Boolean(actions);
    if(!row||!control||row.ownerDocument!==control.ownerDocument||actions&&row.ownerDocument!==actions.ownerDocument)throw new TypeError('Property rows require controls from one document');
    const doc=row.ownerDocument;
    if(!actions){actions=doc.createElement('div');actions.className='ui-actions ui-inline';actions.hidden=true;}
    const input=control.matches?.('input,select,textarea')?control:control.querySelector('input,select,textarea');
    let label=row.querySelector(':scope > [data-ui-property-label]');
    if(!label){label=doc.createElement('label');label.dataset.uiPropertyLabel='';label.className='ui-label';row.prepend(label);}
    label.textContent=String(name);label.title=String(name);if(input){if(!input.id)input.id='ui-property-'+doc.defaultView.crypto.randomUUID();label.htmlFor=input.id;}
    row.classList.add('ui-property-row');Object.assign(row.style,{display:'grid',gridTemplateColumns:hasActions?'minmax(0,30%) minmax(0,1fr) minmax(0,min(35%,calc(3 * var(--ui-control-height) + 2 * var(--ui-gap))))':'minmax(0,30%) minmax(0,1fr)',alignItems:'center',gap:'var(--ui-gap)',marginBlock:'0',minInlineSize:'0',inlineSize:'100%'});
    Object.assign(control.style,{minInlineSize:'0',inlineSize:'100%',maxInlineSize:'100%'});
    Object.assign(actions.style,{minInlineSize:'0',justifyContent:'flex-end'});
    row.append(control,actions);return {element:row,label,control,actions};
  };
  const propertyResets=new WeakMap();
  UI.setPropertyReset=(row,{onReset}={})=>{
    let label=row.querySelector('[data-ui-property-label]')||row.querySelector('.parameter-head > label,.parameter-head > strong');if(!label)return;
    let entry=propertyResets.get(row);
    if(!entry&&typeof onReset==='function'){
      const button=row.ownerDocument.createElement('button');button.type='button';button.dataset.uiPropertyLabel='';button.dataset.uiSurface='graphic';
      button.style.color=label.style.color;Object.assign(button.style,{textAlign:'start',justifyContent:'start',justifySelf:'stretch',margin:'0',padding:'0'});
      const name=label.textContent;UI.adoptAction(button,{label:name});label.replaceWith(button);label=button;
      entry={button,name,reset:onReset,busy:false};
      const reset=async()=>{if(entry.busy||typeof entry.reset!=='function')return;entry.busy=true;button.disabled=true;button.setAttribute('aria-busy','true');try{await entry.reset();}catch(error){button.title=error.message;}finally{entry.busy=false;button.disabled=typeof entry.reset!=='function';button.setAttribute('aria-busy','false');}};
      button.addEventListener('dblclick',()=>void reset());
      button.addEventListener('click',event=>{if(event.detail===0)void reset();});
      propertyResets.set(row,entry);
    }
    if(entry){entry.reset=onReset;entry.button.disabled=entry.busy||typeof onReset!=='function';entry.button.setAttribute('aria-label',`${entry.name} — reset to default`);entry.button.title=`Double-click to reset ${entry.name}; Enter or Space when focused`;}
    return label;
  };
  // Canonical property action order, without replacing nodes or disturbing unchanged focus.
  UI.orderPropertyActions=group=>{
    if(!group)return;const rank={keyframe:0,fx:1,event:2},children=[...group.children];
    const ordered=children.slice().sort((a,b)=>(rank[a.dataset.uiPropertyAction]??3)-(rank[b.dataset.uiPropertyAction]??3));
    if(ordered.some((node,index)=>node!==children[index]))group.append(...ordered);
    return group;
  };
  // Automation changes the existing label, never inspector geometry or authored values.
  UI.setPropertyState=(row,{active=false,description='',color}={})=>{
    const label=row.querySelector('[data-ui-property-label]')||row.querySelector('.parameter-head > label,.parameter-head > strong');
    row.dataset.uiDriven=String(Boolean(active));if(!label)return;
    label.style.color=active?(color||'var(--ui-accent)'):'';
    label.title=description||label.textContent;
  };
  // The icon marks the playhead; the normal pressed surface means animation exists.
  UI.setKeyframeState=(action,{present=false,keyframed=present,sprite}={})=>{
    action.dataset.uiPropertyAction='keyframe';
    const icon=present?'keyframe-filled':'keyframe',changed=action.dataset.uiKeyframeIcon!==icon||action.getAttribute('aria-pressed')!==String(Boolean(keyframed));
    if(action.dataset.uiKeyframeIcon!==icon){UI.adoptAction(action,{icon,iconOnly:true,sprite});action.dataset.uiKeyframeIcon=icon;}
    const graphic=action.querySelector?.('svg.ui-icon');if(graphic)graphic.style.color=present?'var(--ui-text)':'';
    action.setAttribute('aria-pressed',String(Boolean(keyframed)));return changed;
  };
  UI.createBooleanControl=({label,value=false,variant='regular',onChange=()=>{},document=window.document}={})=>{
    const element=document.createElement('label');element.className=variant==='controller'?'ui-icon-choice ui-controller-toggle':'ui-switch';
    const input=document.createElement('input');input.type='checkbox';input.setAttribute('aria-label',String(label));input.setAttribute('role','switch');
    const output=document.createElement('span');output.className='ui-label';output.hidden=variant==='controller';element.append(input,output);
    if(variant==='controller')element.className='ui-switch ui-controller-toggle';
    output.hidden=false;
    const setValue=value=>{input.checked=Boolean(value);output.textContent=input.checked?'On':'Off';element.title=String(label)+': '+output.textContent;};
    const change=()=>{setValue(input.checked);onChange(input.checked);};input.addEventListener('change',change);setValue(value);
    return {element,input,output,setValue,dispose(){input.removeEventListener('change',change);}};
  };
  // Native multiline expression input; applications retain validation, evaluation and History.
  UI.createExpressionEditor=({label='Value',suggestions=[],onCommit=async()=>{},document=window.document,sprite}={})=>{
    const view=document.defaultView,removers=[];
    const element=document.createElement('form');element.className='ui-stack';element.hidden=true;element.noValidate=true;
    element.id='ui-expression-'+view.crypto.randomUUID();element.setAttribute('aria-label',label+' expression');
    const trigger=document.createElement('button');trigger.type='button';trigger.className='formula-toggle';trigger.dataset.uiPropertyAction='fx';
    UI.adoptAction(trigger,{label:label+' expression',icon:'formula',iconOnly:true,sprite});
    trigger.setAttribute('aria-expanded','false');trigger.setAttribute('aria-controls',element.id);
    const input=document.createElement('textarea');input.rows=3;input.spellcheck=false;input.autocomplete='off';input.className='ui-mono';input.placeholder='base + sin(time)';input.setAttribute('aria-label',label+' expression');input.style.inlineSize='100%';input.style.minInlineSize='0';
    const choices=document.createElement('div');choices.className='ui-actions';choices.hidden=true;choices.setAttribute('role','group');choices.setAttribute('aria-label','Expression suggestions');
    const actions=document.createElement('div');actions.className='ui-actions';
    const apply=document.createElement('button');apply.type='submit';apply.dataset.uiVariant='primary';UI.adoptAction(apply,{label:'Apply',icon:'check',sprite});
    const clear=document.createElement('button');clear.type='button';UI.adoptAction(clear,{label:'Clear',ariaLabel:'Clear formula',icon:'close',sprite});
    const readouts=document.createElement('div');readouts.className='ui-actions ui-fill';readouts.style.flex='1 1 15rem';
    const readout=name=>{const field=document.createElement('label');field.className='ui-field';field.dataset.uiLabel='always';const caption=document.createElement('span');caption.className='ui-label';caption.textContent=name;const value=document.createElement('input');value.type='text';value.readOnly=true;value.size=6;value.setAttribute('aria-label',name+' for '+label);field.append(caption,value);readouts.append(field);return value;};
    const baseValue=readout('Base'),result=readout('Result');
    const commands=document.createElement('div');commands.className='ui-actions ui-inline';commands.style.marginInlineStart='auto';
    const status=document.createElement('output');status.className='ui-status';status.setAttribute('role','status');
    commands.append(clear,apply);actions.append(readouts,commands);element.append(input,choices,actions,status);
    let source='',dirty=false,disposed=false,pending=null,options=suggestions,matches=[],prefix='',start=0,active=-1,composing=false;
    const on=(node,type,fn)=>{node.addEventListener(type,fn);removers.push(()=>node.removeEventListener(type,fn));};
    const hide=()=>{matches=[];choices.replaceChildren();choices.hidden=true;active=-1;};
    function complete(index){const item=matches[index];if(!item)return;const end=input.selectionStart,insert=String(item.insert??item.value??item.label);input.setRangeText(insert,start,end,'end');dirty=true;input.dataset.draft='true';input.setCustomValidity('');hide();input.focus();}
    function suggest(){
      if(composing)return;
      const before=input.value.slice(0,input.selectionStart),match=before.match(/[a-zA-Z_][a-zA-Z_0-9]*$/);prefix=match?.[0]||'';start=before.length-prefix.length;hide();if(!prefix)return;
      matches=options.filter(item=>String(item.insert??item.value??item.label).toLowerCase().startsWith(prefix.toLowerCase())).slice(0,6);
      choices.hidden=!matches.length;
      for(const [i,item]of matches.entries()){const button=document.createElement('button');button.type='button';button.textContent=String(item.insert??item.value??item.label);button.title=String(item.description||item.label||'');button.addEventListener('mousedown',e=>e.preventDefault());button.addEventListener('click',()=>complete(i));choices.append(button);}
    }
    function setOpen(open){open=Boolean(open);element.hidden=!open;trigger.setAttribute('aria-expanded',String(open));if(open)input.focus();else hide();return open;}
    const toggle=()=>setOpen(element.hidden);
    async function flush(){
      if(pending)return pending;if(!dirty)return;
      const next=input.value.trim();pending=(async()=>{apply.disabled=true;try{await onCommit(next||null);source=next;dirty=input.value.trim()!==next;if(!dirty)delete input.dataset.draft;clear.disabled=!source&&!dirty;input.setCustomValidity('');input.setAttribute('aria-invalid','false');status.textContent='';}catch(error){input.setCustomValidity(error.message);input.setAttribute('aria-invalid','true');status.dataset.state='error';status.textContent=error.message;throw error;}finally{apply.disabled=false;pending=null;}})();return pending;
    }
    on(trigger,'click',toggle);
    on(input,'input',()=>{dirty=true;clear.disabled=false;input.dataset.draft='true';input.setCustomValidity('');input.setAttribute('aria-invalid','false');status.textContent='';suggest();});
    on(input,'compositionstart',()=>{composing=true;hide();});on(input,'compositionend',()=>{composing=false;suggest();});
    on(input,'keydown',event=>{
      if(event.isComposing||composing)return;
      if((event.ctrlKey||event.metaKey)&&event.key==='Enter'){event.preventDefault();void flush().catch(()=>{});return;}
      if(matches.length&&['ArrowDown','ArrowUp','Tab'].includes(event.key)){
        event.preventDefault();if(event.key==='Tab'){complete(Math.max(0,active));return;}
        active=(active+(event.key==='ArrowDown'?1:-1)+matches.length)%matches.length;
        Array.from(choices.children).forEach((button,i)=>button.setAttribute('aria-pressed',String(i===active)));return;
      }
      if(matches.length&&event.key==='Enter'&&active>=0){event.preventDefault();complete(active);return;}
      if(event.key==='Escape'){event.preventDefault();event.stopPropagation();if(matches.length){hide();return;}input.value=source;dirty=false;delete input.dataset.draft;input.setCustomValidity('');input.setAttribute('aria-invalid','false');status.textContent='';setOpen(false);trigger.focus();}
    });
    on(element,'submit',event=>{event.preventDefault();void flush().catch(()=>{});});
    on(clear,'click',()=>{input.value='';dirty=true;input.dataset.draft='true';hide();void flush().catch(()=>{});});
    return {element,trigger,input,flush,setOpen,toggle,setSuggestions(next){options=next||[];},sync({expression,base,value,error}={}){source=String(expression||'');if(!dirty&&document.activeElement!==input)input.value=source;trigger.title=(source?'Edit':'Add')+' expression for '+label;if(document.activeElement!==baseValue)baseValue.value=String(base??'');if(document.activeElement!==result)result.value=String(value??'');if(!dirty){status.textContent=error||'';status.dataset.state=error?'error':'';}clear.disabled=!source&&!dirty;},dispose(){if(disposed)return;disposed=true;hide();for(const remove of removers)remove();}};
  };
  const expressionIndicators=new WeakMap();
  UI.setExpressionState=(input,{expression,result,error,base,keyframed=false,onActivate,controls,expanded=false,label='Value'}={})=>{
    let entry=expressionIndicators.get(input);
    if(!expression){entry?.element.remove();expressionIndicators.delete(input);input.removeAttribute('aria-description');return;}
    const interactive=typeof onActivate==='function';
    if(!entry||interactive!==(entry.element.tagName==='BUTTON')){
      entry?.element.remove();const element=input.ownerDocument.createElement(interactive?'button':'span');element.className='ui-meta';element.style.color='var(--ui-accent)';
      entry={element,activate:onActivate};if(interactive){element.type='button';UI.adoptAction(element,{label:'fx'});element.addEventListener('click',()=>{const open=entry.activate?.();if(typeof open==='boolean')element.setAttribute('aria-expanded',String(open));});}else element.textContent='fx';
      input.after(element);expressionIndicators.set(input,entry);
    }
    entry.activate=onActivate;const indicator=entry.element;
    const description=`${keyframed?`Keyframed base ${base} → `:''}Expression: ${expression}. Returns ${result}${error?'. '+error:''}`;
    indicator.title=description;indicator.setAttribute('aria-label',interactive?`Edit expression for ${label}`:description);if(interactive){indicator.setAttribute('aria-expanded',String(Boolean(expanded)));if(controls)indicator.setAttribute('aria-controls',controls);}input.setAttribute('aria-description',description);
  };
  UI.setEventState=(action,{present=false,label='Control',sprite}={})=>{
    UI.adoptAction(action,{label:`${present?'Show events':'Add event'} for ${label}`,icon:'event',iconOnly:true,sprite});
    action.dataset.uiPropertyAction='event';action.dataset.uiEvent=String(Boolean(present));action.setAttribute('aria-pressed',String(Boolean(present)));action.title=present?'Show the event driving this control':'Create a timeline state for this control';return action;
  };
  UI.createColourValue=({label,onSet=()=>{},document=window.document}={})=>{
    const element=document.createElement('div');element.className='ui-field';
    const picker=document.createElement('input');picker.type='color';picker.setAttribute('aria-label',`Choose ${label}`);picker.style.flex='0 0 var(--ui-control-height)';picker.style.inlineSize='var(--ui-control-height)';
    const hex=document.createElement('input');hex.type='text';hex.className='ui-mono';hex.setAttribute('aria-label',`Hex colour for ${label}`);hex.spellcheck=false;hex.maxLength=7;let current='#000000';
    const sync=value=>{current=/^#[\da-f]{6}$/i.test(value)?value:'#000000';if(document.activeElement!==picker)picker.value=current;if(document.activeElement!==hex)hex.value=current;};
    const apply=raw=>{const value=/^#[\da-f]{3}$/i.test(raw)?'#'+[...raw.slice(1)].map(c=>c+c).join(''):raw;if(!/^#[\da-f]{6}$/i.test(value)){hex.setCustomValidity('Enter #RGB or #RRGGBB');hex.reportValidity();return;}hex.setCustomValidity('');const changed=value.toLowerCase()!==current;sync(value.toLowerCase());if(changed)onSet(current);};
    picker.addEventListener('change',()=>apply(picker.value));hex.addEventListener('input',()=>hex.setCustomValidity(''));hex.addEventListener('change',()=>apply(hex.value.trim()));
    hex.addEventListener('keydown',event=>{if(event.key==='Enter'){event.preventDefault();apply(hex.value.trim());hex.blur();}if(event.key==='Escape'){event.preventDefault();hex.value=current;hex.setCustomValidity('');hex.blur();}});
    element.append(picker,hex);sync(current);return {element,picker,hex,sync};
  };
  UI.createAvatar=(name,{document=window.document,size=24}={})=>{
    const element=document.createElement('span');element.className='ui-avatar ui-tag';const label=String(name||'Editor');element.textContent=Array.from(label.trim()).slice(0,2).join('').toUpperCase();element.title=label;element.setAttribute('aria-label',label);size=Math.max(20,Math.min(44,Number(size)||24));
    element.style.setProperty('--ui-tag-height',size+'px');element.style.setProperty('--ui-tag-radius','50%');element.style.setProperty('--ui-tag-padding','0');element.style.inlineSize=size+'px';element.style.blockSize=size+'px';element.style.flex='none';element.style.display='grid';element.style.placeItems='center';element.style.overflow='hidden';return element;
  };
  UI.fitMedia=(media,stage=media.parentElement,{controlsOnIntent=false}={})=>{
    const view=media.ownerDocument.defaultView,old={width:media.style.width,height:media.style.height,controls:media.controls,tabIndex:media.getAttribute('tabindex')};const removers=[];let disposed=false;
    function fit(){if(disposed)return;const style=view.getComputedStyle(stage),width=stage.clientWidth-parseFloat(style.paddingLeft||0)-parseFloat(style.paddingRight||0),height=stage.clientHeight-parseFloat(style.paddingTop||0)-parseFloat(style.paddingBottom||0),ratio=(media.videoWidth||media.naturalWidth||Number(media.getAttribute('width')))/(media.videoHeight||media.naturalHeight||Number(media.getAttribute('height')));if(!(width>0&&height>0&&ratio>0))return;const w=Math.min(width,height*ratio);media.style.width=w+'px';media.style.height=w/ratio+'px';}
    if(controlsOnIntent&&media.tagName==='VIDEO'){
      media.controls=false;media.tabIndex=0;
      const listen=(type,fn)=>{media.addEventListener(type,fn);removers.push(()=>media.removeEventListener(type,fn));};
      listen('pointermove',event=>{if(event.movementX||event.movementY)media.controls=true;});listen('pointerdown',()=>{media.controls=true;});listen('focus',()=>{media.controls=true;});listen('pointerleave',()=>{if(media.ownerDocument.activeElement!==media)media.controls=false;});
    }
    const observer=new view.ResizeObserver(fit);observer.observe(stage);media.addEventListener('loadedmetadata',fit);media.addEventListener('load',fit);fit();
    return {refresh:fit,dispose(){if(disposed)return;disposed=true;for(const remove of removers)remove();if(controlsOnIntent&&media.tagName==='VIDEO'){media.controls=old.controls;if(old.tabIndex===null)media.removeAttribute('tabindex');else media.setAttribute('tabindex',old.tabIndex);}observer.disconnect();media.removeEventListener('loadedmetadata',fit);media.removeEventListener('load',fit);media.style.width=old.width;media.style.height=old.height;}};
  };
  // Move the same secondary control between a toolbar and its native menu.
  // Native numeric property: drag while unfocused, click to type, Escape restores.
  // Shared native menus stay beside their trigger and within the current viewport.
  UI.positionMenu=menu=>{
    const panel=menu.querySelector(':scope > .ui-menu-panel'),summary=menu.querySelector(':scope > summary');
    if(!menu.open||!panel||!summary)return;
    const view=menu.ownerDocument.defaultView,scrollTop=panel.scrollTop;panel.style.translate='';panel.style.maxHeight='';
    const trigger=summary.getBoundingClientRect(),base=panel.getBoundingClientRect(),above=Math.max(0,trigger.top-8),below=Math.max(0,view.innerHeight-trigger.bottom-8),preferAbove=base.bottom<=trigger.top;
    const up=preferAbove?above>=base.height||above>below:below<base.height&&above>below;
    panel.style.maxHeight=Math.max(0,Math.min(parseFloat(view.getComputedStyle(panel).maxHeight)||Infinity,up?above:below))+'px';
    const box=panel.getBoundingClientRect(),left=Math.max(8,Math.min(box.left,view.innerWidth-box.width-8)),top=up?trigger.top-box.height:trigger.bottom;
    panel.style.translate=`${left-box.left}px ${Math.max(8,top)-box.top}px`;panel.scrollTop=scrollTop;
  };
  UI.createFunctionControl=(input,{getValue=null,canScrub=()=>true,step=()=>Number(input.step)||.01,min=()=>input.min===''?-Infinity:Number(input.min),max=()=>input.max===''?Infinity:Number(input.max)}={})=>{
    if(!['number','text'].includes(input.type))throw new TypeError('Function controls require a native numeric or expression input');
    const numeric=()=>input.type==='number'?input.valueAsNumber:input.value.trim()===''?NaN:Number(input.value);
    const doc=input.ownerDocument,view=doc.defaultView,removers=[];let gesture=null,disposed=false;
    const read=value=>typeof value==='function'?value():value;
    input.classList.add('ui-function-value');
    function listen(owner,type,fn){owner.addEventListener(type,fn);removers.push(()=>owner.removeEventListener(type,fn));}
    function emit(type){input.dispatchEvent(new view.Event(type,{bubbles:true}));}
    function finish(cancel=false){
      if(!gesture)return;const g=gesture;gesture=null;delete input.dataset.uiDragging;
      if(input.hasPointerCapture?.(g.id))input.releasePointerCapture(g.id);
      if(g.moved){if(cancel){input.value=g.before;emit('input');}emit('change');input.blur();}
      else if(!cancel){input.focus({preventScroll:true});input.select();}
    }
    listen(input,'pointerdown',event=>{
      if(!read(canScrub)||gesture||event.button!==0||event.pointerType==='touch'||input.disabled||input.readOnly||doc.activeElement===input||!Number.isFinite(numeric()))return;
      event.preventDefault();const value=getValue?Number(read(getValue)):numeric();if(!Number.isFinite(value))return;gesture={id:event.pointerId,x:event.clientX,before:String(value),value,moved:false};input.setPointerCapture(event.pointerId);
    });
    listen(input,'pointermove',event=>{
      if(!gesture||event.pointerId!==gesture.id)return;const dx=event.clientX-gesture.x;
      if(!gesture.moved&&Math.abs(dx)<3)return;
      if(!gesture.moved){gesture.moved=true;input.dataset.uiDragging='';input.focus({preventScroll:true});}
      event.preventDefault();const scale=event.altKey ? .1 : event.shiftKey ? 10 : 1;
      gesture.value=Math.max(read(min),Math.min(read(max),Number((gesture.value+dx*Math.abs(read(step)||.01)*scale).toPrecision(12))));gesture.x=event.clientX;
      if(numeric()!==gesture.value){input.value=String(gesture.value);emit('input');}
    });
    listen(input,'pointerup',event=>{if(event.pointerId===gesture?.id)finish();});
    listen(input,'pointercancel',()=>finish(true));listen(input,'lostpointercapture',()=>finish(true));
    listen(doc,'keydown',event=>{if(gesture&&event.key==='Escape'){event.preventDefault();event.stopImmediatePropagation();finish(true);}});
    listen(doc,'visibilitychange',()=>{if(doc.visibilityState==='hidden')finish(true);});
    const dispose=()=>{if(disposed)return;finish(true);disposed=true;for(const remove of removers)remove();input.classList.remove('ui-function-value');};listen(view,'pagehide',event=>{if(!event.persisted)dispose();});
    return {dispose};
  };
  UI.createAdaptiveSlot=(node,{container,target}={})=>{
    if(!container||!target||node.ownerDocument!==target.ownerDocument||!container.contains(node)||!container.contains(target))throw new TypeError('Adaptive controls need one toolbar and menu');
    const doc=node.ownerDocument,view=doc.defaultView,marker=doc.createComment('ui-secondary'),removers=[];
    node.before(marker);node.classList.add('ui-toolbar-secondary');let frame=0,disposed=false,paused=doc.visibilityState==='hidden';
    function refresh(){if(disposed||paused)return;view.cancelAnimationFrame(frame);frame=view.requestAnimationFrame(()=>{frame=0;if(node.contains(doc.activeElement))return;const collapsed=container.clientWidth<32*parseFloat(view.getComputedStyle(doc.documentElement).fontSize),parent=collapsed?target:marker.parentNode;target.hidden=!collapsed;if(node.parentNode!==parent){if(collapsed)target.append(node);else marker.after(node);UI.refreshActions(doc);}});}
    const observer=new view.ResizeObserver(refresh);
    function listen(owner,type,fn){owner.addEventListener(type,fn);removers.push(()=>owner.removeEventListener(type,fn));}
    function suspend(){paused=true;observer.disconnect();view.cancelAnimationFrame(frame);frame=0;}
    function resume(){if(disposed||doc.visibilityState==='hidden')return;paused=false;observer.observe(container);refresh();}
    function dispose(){if(disposed)return;suspend();disposed=true;for(const remove of removers)remove();marker.after(node);marker.remove();node.classList.remove('ui-toolbar-secondary');}
    listen(doc,'visibilitychange',()=>doc.visibilityState==='hidden'?suspend():resume());listen(view,'pagehide',event=>event.persisted?suspend():dispose());listen(view,'pageshow',resume);listen(doc,'ui:styles',refresh);listen(node,'focusout',refresh);resume();
    return {refresh,dispose};
  };
  UI.createColorPicker=(trigger,{value=null,onChange=()=>{},title='Card colour'}={})=>{
    const doc=trigger.ownerDocument,view=doc.defaultView,removers=[];
    const panel=doc.createElement('div');panel.className='ui-popout ui-color-picker ui-chrome';panel.popover='auto';
    panel.dataset.uiComponent='color-picker';panel.id='ui-colour-'+view.crypto.randomUUID();panel.setAttribute('role','dialog');
    const header=doc.createElement('header'),heading=doc.createElement('h2');heading.className='ui-section-title';heading.id=panel.id+'-title';heading.textContent=title;header.append(heading);panel.setAttribute('aria-labelledby',heading.id);
    const body=doc.createElement('div');body.dataset.uiPopoutBody='';body.className='ui-stack';
    const buttons=[];
    const swatches=(label,entries,captions=false)=>{
      const section=doc.createElement('section');section.className='ui-stack';
      const caption=doc.createElement('h3');caption.className='ui-meta';caption.textContent=label;
      const group=doc.createElement('div');group.className='ui-color-palette';group.setAttribute('role','group');group.setAttribute('aria-label',label);if(captions)group.dataset.uiLabels='true';
      for(const [name,color]of entries){const button=doc.createElement('button');button.type='button';button.className='ui-swatch';button.dataset.uiColorValue=color;UI.adoptAction(button,{label:name,ariaLabel:name,title:name});
        button.querySelector(':scope > .ui-label').hidden=true;const fill=UI.resolveCardColor(color);button.style.setProperty('--ui-swatch-value',`light-dark(${fill.light},${fill.dark})`);button.addEventListener('click',()=>choose(color));buttons.push(button);group.append(button);}
      section.append(caption,group);body.append(section);
    };
    swatches('Approval',[['Neutral','#ffffff'],['Changes','#c44c53'],['Review','#f3d376'],['Approved','#22c55e'],['Translucent','transparent']],true);
    swatches('Everyday',[['Light pink','#ffb3d2'],['Peach','#ffbf94'],['Lemon','#fff18a'],['Mint','#9be5bc'],['Seafoam','#8ce3d6'],['Baby blue','#99d6ff'],['Periwinkle','#b7c3ff'],['Lilac','#d6b3ff'],['Grey','#cbd1d8']]);
    const custom=doc.createElement('label');custom.className='ui-field';const caption=doc.createElement('span');caption.className='ui-label';caption.textContent='Custom colour';const input=doc.createElement('input');input.type='color';input.setAttribute('aria-label','Custom card colour');custom.append(caption,input);body.append(custom);
    const hexField=doc.createElement('div');hexField.className='ui-field';const hexLabel=doc.createElement('span');hexLabel.className='ui-label';hexLabel.textContent='Hex';const hex=doc.createElement('input');hex.type='text';hex.maxLength=7;hex.autocomplete='off';hex.spellcheck=false;hex.setAttribute('aria-label','Hex colour');hex.placeholder='#99d6ff';const apply=doc.createElement('button');apply.type='button';apply.textContent='Apply';hexField.append(hexLabel,hex,apply);body.append(hexField);
    const footer=doc.createElement('footer');footer.className='ui-actions ui-fill';const done=doc.createElement('button');done.type='button';done.textContent='Done';footer.append(done);panel.append(header,body,footer);doc.body.append(panel);
    trigger.setAttribute('aria-haspopup','dialog');trigger.setAttribute('aria-controls',panel.id);trigger.setAttribute('aria-expanded','false');
    let disposed=false;
    function listen(node,type,fn,options){node.addEventListener(type,fn,options);removers.push(()=>node.removeEventListener(type,fn,options));}
    function setValue(next,{mixed=false}={}){if(next!==null)UI.resolveCardColor(next);value=next?.toLowerCase()??null;for(const button of buttons){const pressed=String(!mixed&&button.dataset.uiColorValue===value);if(button.getAttribute('aria-pressed')!==pressed)button.setAttribute('aria-pressed',pressed);}if(doc.activeElement!==input&&input.value!==(value||'#ffffff'))input.value=value&&value!=='transparent'?value:'#ffffff';if(doc.activeElement!==hex)hex.value=value&&value!=='transparent'?value:'#ffffff';}
    function position(){if(!panel.matches(':popover-open'))return;const r=trigger.getBoundingClientRect(),p=panel.getBoundingClientRect();const right=r.right+10,left=right+p.width<=view.innerWidth-12?right:r.left-p.width-10;panel.style.left=Math.max(12,Math.min(left,view.innerWidth-p.width-12))+'px';panel.style.top=Math.max(12,Math.min(r.top,view.innerHeight-p.height-12))+'px';}
    function close(){if(panel.matches(':popover-open'))panel.hidePopover();}
    function open(){if(disposed||trigger.disabled)return;panel.showPopover();position();(buttons.find(button=>button.getAttribute('aria-pressed')==='true')||buttons[0]).focus({preventScroll:true});}
    function choose(next){setValue(next);close();onChange(next);trigger.focus({preventScroll:true});}
    listen(panel,'keydown',event=>event.stopPropagation());
    function applyHex(){const next=hex.value.trim();const valid=/^#?[0-9a-f]{6}$/i.test(next);hex.setCustomValidity(valid?'':'Enter six hex digits, such as #99d6ff.');hex.setAttribute('aria-invalid',String(!valid));if(valid)choose((next.startsWith('#')?next:'#'+next).toLowerCase());else hex.reportValidity();}
    listen(hex,'input',()=>{hex.setCustomValidity('');hex.removeAttribute('aria-invalid');});listen(hex,'keydown',event=>{if(event.key==='Enter'){event.preventDefault();applyHex();}});listen(apply,'click',applyHex);
    listen(input,'change',()=>choose(input.value));listen(done,'click',close);
    listen(panel,'toggle',event=>{const open=event.newState==='open';trigger.setAttribute('aria-expanded',String(open));if(open){position();view.addEventListener('resize',position);doc.addEventListener('scroll',position,true);}else{view.removeEventListener('resize',position);doc.removeEventListener('scroll',position,true);if(panel.contains(doc.activeElement)||doc.activeElement===doc.body)trigger.focus({preventScroll:true});}});
    setValue(value);
    return {element:panel,open,close,setValue,dispose(){if(disposed)return;disposed=true;close();view.removeEventListener('resize',position);doc.removeEventListener('scroll',position,true);for(const remove of removers)remove();panel.remove();for(const name of ['aria-haspopup','aria-controls','aria-expanded'])trigger.removeAttribute(name);}};
  };

  UI.createChoiceControl=({label='Choice',options=[],value,searchable=options.length>6,onChange=()=>{},document=window.document,sprite}={})=>{
    let element=document.createElement('div');element.className='ui-field';
    const input=document.createElement(searchable?'input':'select');input.setAttribute('aria-label',label);element.append(input);
    let current=value,items=options,combo=null,disposed=false;
    const normalized=()=>items.map(item=>typeof item==='string'?{value:item,label:item}:{value:String(item.value),label:String(item.label??item.value)});
    const show=()=>{if(document.activeElement===input)return;const chosen=normalized().find(item=>item.value===String(current));input.value=searchable?(chosen?.label??''):String(current??'');input.setCustomValidity('');};
    if(searchable){input.type='text';input.autocomplete='off';combo=UI.createCombobox(input,{options:normalized(),onSelect:item=>{current=item.value;input.setCustomValidity('');onChange(current);}});element=combo.element;element.classList.add('ui-field');element.style.display='flex';const open=document.createElement('button');open.type='button';UI.adoptAction(open,{label:'Show '+label+' choices',icon:'chevron-down',iconOnly:true,sprite});open.dataset.uiSurface='graphic';Object.assign(open.style,{display:'inline-flex',minInlineSize:'var(--ui-control-height)',minBlockSize:'calc(var(--ui-field-height) - 2px)',alignItems:'center',justifyContent:'center'});open.addEventListener('click',()=>combo.open());element.append(open);}
    else input.style.textAlignLast='start';
    const change=()=>{if(!searchable){current=input.value;onChange(current);}};
    const blur=()=>{if(searchable)show();};input.addEventListener('change',change);input.addEventListener('blur',blur);
    function sync(next,nextOptions=items){current=next;items=nextOptions;const values=normalized();if(combo)combo.setOptions(values);else{const signature=JSON.stringify(values);if(input.dataset.options!==signature){input.replaceChildren(...values.map(item=>{const node=document.createElement('option');node.value=item.value;node.textContent=item.label;return node;}));input.dataset.options=signature;}}show();}
    sync(value);return {element,input,sync,dispose(){if(disposed)return;disposed=true;combo?.dispose();input.removeEventListener('change',change);input.removeEventListener('blur',blur);}};
  };
  UI.createCombobox=(input,{options=[],onSelect=()=>{}}={})=>{
    const doc=input.ownerDocument,view=doc.defaultView;
    const wrapper=doc.createElement('span');wrapper.className='ui-combobox';input.before(wrapper);wrapper.append(input);
    const list=doc.createElement('span');list.className='ui-listbox';list.hidden=true;list.setAttribute('role','listbox');list.id=`ui-options-${view.crypto?.randomUUID?.()||Math.random().toString(36).slice(2)}`;
    const status=doc.createElement('span');status.className='ui-sr-only';status.setAttribute('role','status');wrapper.append(list,status);
    input.setAttribute('role','combobox');input.setAttribute('aria-autocomplete','list');input.setAttribute('aria-controls',list.id);input.setAttribute('aria-expanded','false');
    let values=[],matches=[],active=-1,disposed=false,composing=false;
    const removers=[];
    function on(node,type,handler){node.addEventListener(type,handler);removers.push(()=>node.removeEventListener(type,handler));}
    let pool=documents.get(doc);
    if(!pool){pool={open:new Set(),count:0,handler:event=>{for(const item of pool.open)if(!item.element.contains(event.target))item.close();}};doc.addEventListener('pointerdown',pool.handler);documents.set(doc,pool);}pool.count++;
    const control={element:wrapper,open(){input.focus();active=-1;render();},close,dispose,setOptions};
    function close(){list.hidden=true;input.setAttribute('aria-expanded','false');input.removeAttribute('aria-activedescendant');pool.open.delete(control);}
    function render(){
      if(disposed)return;
      const query=values.some(item=>item.label===input.value)?'':input.value.toLocaleLowerCase();matches=values.filter(item=>item.label.toLocaleLowerCase().includes(query)).slice(0,100);active=Math.min(active,matches.length-1);list.replaceChildren();
      for(const [index,item] of matches.entries()){const option=doc.createElement('span');option.className='ui-option';option.id=`${list.id}-${index}`;option.dataset.option=index;option.setAttribute('role','option');option.setAttribute('aria-selected',String(index===active));option.textContent=item.label;list.append(option);}
      list.hidden=!matches.length;input.setAttribute('aria-expanded',String(matches.length>0));status.textContent=matches.length?`${matches.length} choices`:'No matching choices';
      if(matches.length)pool.open.add(control);else pool.open.delete(control);
      if(active>=0){input.setAttribute('aria-activedescendant',`${list.id}-${active}`);list.children[active]?.scrollIntoView({block:'nearest'});}else input.removeAttribute('aria-activedescendant');
    }
    function commit(index){const item=matches[index];if(!item)return;input.value=item.label;close();onSelect(item);input.dispatchEvent(new view.Event('change',{bubbles:true}));input.dispatchEvent(new view.CustomEvent('ui:select',{detail:item,bubbles:true}));}
    function setOptions(next){values=next.slice(0,1000).map(item=>typeof item==='string'?{value:item,label:item}:{value:String(item.value??item.label),label:String(item.label??item.value)});if(!list.hidden)render();}
    function dispose(){if(disposed)return;disposed=true;close();for(const remove of removers)remove();pool.count--;if(!pool.count){doc.removeEventListener('pointerdown',pool.handler);documents.delete(doc);}input.removeAttribute('role');input.removeAttribute('aria-autocomplete');input.removeAttribute('aria-controls');input.removeAttribute('aria-expanded');wrapper.before(input);wrapper.remove();}
    on(input,'compositionstart',()=>{composing=true;close();});on(input,'compositionend',()=>{composing=false;active=-1;render();});
    on(input,'input',()=>{if(!composing){active=-1;render();}});on(input,'focus',()=>{active=-1;render();});
    on(input,'keydown',event=>{
      if(composing||event.isComposing)return;
      if(event.key==='ArrowDown'||event.key==='ArrowUp'){event.preventDefault();if(list.hidden){active=-1;render();}active=matches.length?(active<0?(event.key==='ArrowDown'?0:matches.length-1):(active+(event.key==='ArrowDown'?1:-1)+matches.length)%matches.length):-1;render();}
      else if(event.key==='Enter'&&!list.hidden&&active>=0){event.preventDefault();commit(active);}
      else if(event.key==='Escape'&&!list.hidden){event.preventDefault();close();}
      else if(event.key==='Tab')close();
    });
    on(list,'pointerdown',event=>event.preventDefault());on(list,'click',event=>{const item=event.target.closest('[data-option]');if(item)commit(Number(item.dataset.option));});
    on(wrapper,'focusout',event=>{if(!wrapper.contains(event.relatedTarget))close();});
    setOptions(options);return control;
  };
  UI.createTagInput=(input,{options=()=>[],excluded=()=>[],onCommit=()=>{},limit=6}={})=>{
    const doc=input.ownerDocument,list=doc.createElement('div'),slot=doc.createElement('div'),removers=[];
    slot.className='ui-tag-suggestions';slot.append(list);list.className='ui-tags';list.id=`${input.id||'ui-tags'}-suggestions`;list.setAttribute('role','listbox');list.setAttribute('aria-label','Suggested tags');
    (input.closest('.ui-field')||input.parentElement).after(slot);
    for(const [name,value] of Object.entries({role:'combobox','aria-autocomplete':'list','aria-controls':list.id,autocomplete:'off',enterkeyhint:'done'}))input.setAttribute(name,value);
    let matches=[],active=-1,disposed=false;
    function on(node,type,handler){node.addEventListener(type,handler);removers.push(()=>node.removeEventListener(type,handler));}
    function hide(){list.hidden=true;input.setAttribute('aria-expanded','false');input.removeAttribute('aria-activedescendant');}
    function draw(){
      if(disposed)return;
      const query=input.value.trim().toLocaleLowerCase(),selected=new Set(excluded().map(tag=>tag.toLocaleLowerCase()));
      matches=options().filter(tag=>!selected.has(tag.toLocaleLowerCase())&&tag.toLocaleLowerCase().startsWith(query)).slice(0,limit);active=Math.min(active,matches.length-1);list.replaceChildren();
      matches.forEach((tag,index)=>{const button=doc.createElement('button');button.type='button';button.className='ui-tag';button.textContent=tag;button.id=`${list.id}-${index}`;button.setAttribute('role','option');button.setAttribute('aria-selected',String(index===active));button.tabIndex=-1;
        button.addEventListener('pointerdown',event=>event.preventDefault());button.addEventListener('click',()=>{commit(tag);input.focus();});list.append(button);});
      list.hidden=!matches.length;input.setAttribute('aria-expanded',String(Boolean(matches.length)));
      if(matches.length&&active>=0)input.setAttribute('aria-activedescendant',`${list.id}-${active}`);else input.removeAttribute('aria-activedescendant');
    }
    function commit(value){if(!value.trim())return;input.value='';active=-1;onCommit(value);draw();}
    function handleKey(event){
      if(event.isComposing||event.shiftKey&&event.key==='Enter')return;
      if(event.key==='Escape'&&!list.hidden){event.preventDefault();event.stopPropagation();hide();return;}
      if(['ArrowDown','ArrowUp'].includes(event.key)){event.preventDefault();active=active<0?(event.key==='ArrowDown'?0:matches.length-1):(active+(event.key==='ArrowDown'?1:-1)+matches.length)%(matches.length||1);draw();}
      if(event.key==='Enter'||event.key===','){event.preventDefault();event.stopPropagation();commit(event.key==='Enter'&&!list.hidden&&active>=0?matches[active]:input.value);}
    }
    on(input,'input',()=>{active=-1;draw();});on(input,'focus',draw);on(input,'blur',hide);on(input,'keydown',handleKey);
    on(input,'paste',event=>{const value=event.clipboardData?.getData('text');if(value?.includes(',')){event.preventDefault();commit(value);}});
    hide();return {element:list,hide,draw,handleKey,flush:()=>commit(input.value),dispose(){if(disposed)return;disposed=true;for(const remove of removers)remove();slot.remove();for(const name of ['role','aria-autocomplete','aria-controls','aria-expanded','aria-activedescendant'])input.removeAttribute(name);}};
  };
  function activate(tab){const group=tab.closest('[data-ui-tabs]');if(!group)return;
    for(const item of group.querySelectorAll('[role=tab]')){const selected=item===tab;item.setAttribute('aria-selected',String(selected));item.tabIndex=selected?0:-1;const panel=document.getElementById(item.getAttribute('aria-controls'));if(panel)panel.hidden=!selected;}
  }
  document.addEventListener('click',event=>{const tab=event.target.closest?.('[data-ui-tabs] [role=tab]');if(tab)activate(tab);});
  document.addEventListener('keydown',event=>{const tab=event.target.closest?.('[data-ui-tabs] [role=tab]');if(!tab)return;const tabs=[...tab.closest('[data-ui-tabs]').querySelectorAll('[role=tab]:not(:disabled)')],index=tabs.indexOf(tab);let next;
    if(event.key==='ArrowRight'||event.key==='ArrowDown')next=tabs[(index+1)%tabs.length];else if(event.key==='ArrowLeft'||event.key==='ArrowUp')next=tabs[(index-1+tabs.length)%tabs.length];else if(event.key==='Home')next=tabs[0];else if(event.key==='End')next=tabs.at(-1);
    if(next){event.preventDefault();activate(next);next.focus();}
  });
UI.createCurveControl=({label='Response',points:initial=[1/3,0,2/3,1],defaults:initialDefaults=initial,invert=false,xLabel:horizontal='Progress',yLabel:vertical='Response',endpointLabels=['Start','End'],onChange=()=>{},onError=console.error,document=window.document}={})=>{
  const plot=([x,y])=>[30+x*240,144-y*120];
  function svgNode(name,attrs={}){const node=document.createElementNS('http://www.w3.org/2000/svg',name);for(const [key,value]of Object.entries(attrs))node.setAttribute(key,String(value));return node;}
  const clampUnit=value=>Math.max(0,Math.min(1,value)),CURVE_PRESETS={Linear:[1/3,1/3,2/3,2/3],Smooth:[1/3,0,2/3,1],Early:[.2,.65,.5,1],Late:[.5,0,.8,.35]};
  let points=[...initial],drag=null,available=true,disposed=false;const removers=[];
  function listen(node,type,handler){node.addEventListener(type,handler);removers.push(()=>node.removeEventListener(type,handler));}
  const element=document.createElement('div');element.className='ui-curve-control ui-stack';
  const graph=svgNode('svg',{viewBox:'0 0 300 176',role:'group','aria-label':`${label} curve editor`});
  const grid=svgNode('path',{class:'bezier-grid',d:'M30 24V144H270M30 84H270M150 24V144M270 24V144M30 24H270'});
  const fill=svgNode('path',{class:'bezier-fill'}),path=svgNode('path',{class:'bezier-path'});
  const lines=[0,1].map(()=>svgNode('line',{class:'bezier-tangent'}));
  const handles=[0,1].map((i)=>svgNode('circle',{r:7,tabindex:0,role:'slider',class:'bezier-handle',
    'aria-label':`${label} handle ${i+1}`,'aria-valuemin':0,'aria-valuemax':1}));
  const endpointMode=initial.length===6;
  if(endpointMode)element.dataset.endpoints='true';
  const endpointNames=endpointLabels;
  const ends=[0,1].map((i)=>svgNode('circle',{r:endpointMode?5:3,class:'bezier-end',...(endpointMode?{tabindex:0,role:'slider','aria-label':`${label} ${endpointNames[i]} endpoint`,'aria-valuemin':0,'aria-valuemax':1}:{})}));
  const controls=endpointMode?[...handles,...ends]:handles;
  const xLabel=svgNode('text',{x:150,y:168,'text-anchor':'middle'});xLabel.textContent=horizontal;
  const yLabel=svgNode('text',{x:12,y:84,transform:'rotate(-90 12 84)','text-anchor':'middle'});yLabel.textContent=vertical;
  graph.append(grid,fill,...lines,path,...ends,...handles,xLabel,yLabel);
  const fields=document.createElement('div');fields.className='ui-actions';fields.style.display='grid';fields.style.gridTemplateColumns=`repeat(${endpointMode?3:2},minmax(0,1fr))`;
  const inputs=[];
  for(let i=0;i<(endpointMode?6:4);i++){
    const field=document.createElement('label');field.className='ui-field';const caption=document.createElement('span');caption.className='ui-label';caption.textContent=i<4?`${i<2?'1':'2'} ${i%2?'Y':'X'}`:endpointNames[i-4];
    const input=document.createElement('input');input.type='number';input.min='0';input.max='1';input.step='.01';
    input.setAttribute('aria-label',i<4?`${label} handle ${Math.floor(i/2)+1} ${i%2?'Y':'X'}`:`${label} ${endpointNames[i-4]} density`);
    let dirty=false;
    listen(input,'input',()=>{dirty=true;input.dataset.draft='true';});
    const apply=()=>{if(!dirty)return;const value=Number(input.value);if(input.value.trim()===''||!Number.isFinite(value)||value<0||value>1){input.setCustomValidity('Enter a number from 0 to 1');input.reportValidity();return;}dirty=false;delete input.dataset.draft;input.setCustomValidity('');points[i]=value;send(true);};
    listen(input,'change',apply);
    listen(input,'keydown',event=>{
      if(event.key==='Enter'){event.preventDefault();apply();}
      if(event.key==='Escape'){event.preventDefault();dirty=false;delete input.dataset.draft;input.value=String(points[i]);input.setCustomValidity('');}
    });
    field.append(caption,input);fields.append(field);inputs.push(input);
  }
  const presets=document.createElement('div');presets.className='ui-actions';
  for(const [name,value]of Object.entries(CURVE_PRESETS)){
    const button=document.createElement('button');button.type='button';button.textContent=name;
    button.setAttribute('aria-label',`${label} ${name.toLowerCase()} preset`);
    listen(button,'click',()=>{points=endpointMode?[value[0],points[4]+(points[5]-points[4])*value[1],value[2],points[4]+(points[5]-points[4])*value[3],points[4],points[5]]:[...value];send(true);});presets.append(button);
  }
  const reset=document.createElement('button');reset.type='button';reset.textContent='Reset';reset.setAttribute('aria-label',`Reset ${label} curve`);
  let defaults=[...initialDefaults];listen(reset,'click',()=>{points=[...defaults];send(true);});presets.append(reset);
  const hint=document.createElement('span');hint.className='ui-meta';hint.textContent='Drag handles · arrow keys adjust · Esc cancels';
  const status=document.createElement('output');status.className='ui-meta';status.setAttribute('aria-live','polite');
  function paint(){
    const displayY=y=>invert?1-y:y;
    const p0=plot([0,displayY(points[4]??0)]),p1=plot([points[0],displayY(points[1])]),p2=plot([points[2],displayY(points[3])]),p3=plot([1,displayY(points[5]??1)]);
    const d=`M${p0} C${p1} ${p2} ${p3}`;
    path.setAttribute('d',d);fill.setAttribute('d',`${d} L270 144 L30 144 Z`);
    [p0,p3].forEach((p,i)=>{ends[i].setAttribute('cx',p[0]);ends[i].setAttribute('cy',p[1]);if(endpointMode)ends[i].setAttribute('aria-valuenow',points[i+4]);});
    [p1,p2].forEach((p,i)=>{
      lines[i].setAttribute('x1',[p0,p3][i][0]);lines[i].setAttribute('y1',[p0,p3][i][1]);lines[i].setAttribute('x2',p[0]);lines[i].setAttribute('y2',p[1]);
      handles[i].setAttribute('cx',p[0]);handles[i].setAttribute('cy',p[1]);handles[i].setAttribute('aria-valuenow',points[i*2+1]);
      handles[i].setAttribute('aria-valuetext',`X ${points[i*2].toFixed(3)}, Y ${points[i*2+1].toFixed(3)}`);
    });
    inputs.forEach((input,i)=>{if(document.activeElement!==input&&!input.dataset.draft)input.value=Number(Number(points[i]).toPrecision(6)).toString();});
  }
  function send(commit){if(!available)return;paint();try{Promise.resolve(onChange([...points],commit)).catch(onError);}catch(error){onError(error);}}
  const move=event=>{
    const rect=graph.getBoundingClientRect(),x=clampUnit(((event.clientX-rect.left)/rect.width*300-30)/240),shownY=clampUnit((144-(event.clientY-rect.top)/rect.height*176)/120);
    const i=drag.index<2?drag.index*2:drag.index+2;
    if(drag.index<2)points[i]=Math.round(x*10000)/10000;
    points[drag.index<2?i+1:i]=Math.round((invert?1-shownY:shownY)*10000)/10000;send(false);
  };
  const end=(cancel=false)=>{if(!drag)return;const old=drag;drag=null;if(cancel)points=old.points;send(true);if(controls[old.index].hasPointerCapture(old.pointerId))controls[old.index].releasePointerCapture(old.pointerId);};
  controls.forEach((handle,index)=>{
    listen(handle,'pointerdown',event=>{if(event.button!==0||!available)return;event.preventDefault();event.stopPropagation();handle.focus();drag={index,pointerId:event.pointerId,points:[...points]};handle.setPointerCapture(event.pointerId);});
    listen(handle,'pointermove',event=>{if(drag?.index===index&&event.pointerId===drag.pointerId)move(event);});
    listen(handle,'pointerup',()=>end());listen(handle,'pointercancel',()=>end(true));listen(handle,'lostpointercapture',()=>end(true));
    listen(handle,'keydown',event=>{
      if(event.key==='Escape'){event.preventDefault();end(true);return;}
      if(!['ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(event.key))return;
      event.preventDefault();event.stopPropagation();const horizontal=['ArrowLeft','ArrowRight'].includes(event.key),isX=index<2&&horizontal,i=index<2?index*2+(horizontal?0:1):index+2;
      const direction=['ArrowUp','ArrowRight'].includes(event.key)?1:-1,step=event.shiftKey?.1:event.altKey?.001:.01;
      points[i]=Number(clampUnit(points[i]+direction*step*(isX||!invert?1:-1)).toFixed(6));send(true);
    });
  });
  listen(document,'visibilitychange',()=>{if(document.hidden)end(true);});
  Object.assign(graph.style,{display:'block',inlineSize:'100%',height:'auto',aspectRatio:'300/176',touchAction:'none',border:'1px solid var(--ui-control)',borderRadius:'var(--ui-radius-small)',background:'var(--ui-surface)'});
  grid.setAttribute('fill','none');grid.setAttribute('stroke','var(--ui-line)');fill.setAttribute('fill','var(--ui-accent-soft)');path.setAttribute('fill','none');path.setAttribute('stroke','var(--ui-accent)');path.setAttribute('stroke-width','2');
  for(const line of lines){line.setAttribute('stroke','var(--ui-muted)');line.setAttribute('stroke-dasharray','3 3');}
  for(const handle of [...handles,...ends]){handle.setAttribute('fill','var(--ui-text)');handle.setAttribute('stroke','var(--ui-surface)');handle.setAttribute('stroke-width','2');handle.style.cursor='grab';}
  for(const text of [xLabel,yLabel]){text.setAttribute('fill','var(--ui-muted)');text.style.font='10px var(--ui-font)';}
  controls.forEach(handle=>{listen(handle,'focus',()=>handle.setAttribute('stroke','var(--ui-accent)'));listen(handle,'blur',()=>handle.setAttribute('stroke','var(--ui-surface)'));});
  element.append(graph,fields,presets,hint,status);paint();
  return {element,sync({points:next,defaults:reset=defaults,available:enabled=true}={}){
    available=enabled;graph.setAttribute('aria-disabled',String(!available));defaults=[...reset];if(!drag&&next){points=[...next];paint();}
  },dispose(){if(disposed)return;disposed=true;end(true);for(const remove of removers)remove();}};
}

UI.createResponseControl=({spec:initial,onSet,model,document=window.document})=>{
  const {powerCurve,curveExponent,numberStep,steppedNumber}=model;
  let spec = initial, value = Number(spec.value ?? spec.default ?? 1), dragging = false,original=value,pointerId=null;const removers=[];
  function listen(node,type,handler){node.addEventListener(type,handler);removers.push(()=>node.removeEventListener(type,handler));}
  const element = document.createElement('div'); element.className = 'ui-response-control ui-stack';
  const svg = document.createElementNS('http://www.w3.org/2000/svg','svg');
  svg.setAttribute('viewBox','0 0 220 76'); svg.setAttribute('tabindex','0'); svg.setAttribute('role','slider');
  svg.setAttribute('aria-label', `${spec.label} curve`);
  svg.innerHTML = '<path class="mini-curve-grid" d="M10 8V66H210M10 37H210M110 8V66"/><path class="mini-curve-path"/><circle r="4" class="mini-curve-handle"/>';
  Object.assign(svg.style,{display:'block',inlineSize:'100%',height:'76px',touchAction:'none',cursor:'crosshair',border:'1px solid var(--ui-control)',borderRadius:'var(--ui-radius-small)',background:'var(--ui-surface)'});
  const grid=svg.querySelector('.mini-curve-grid'),path=svg.querySelector('.mini-curve-path'),dot=svg.querySelector('circle');grid.setAttribute('fill','none');grid.setAttribute('stroke','var(--ui-line)');path.setAttribute('fill','none');path.setAttribute('stroke','var(--ui-accent)');path.setAttribute('stroke-width','2');dot.setAttribute('fill','var(--ui-text)');
  const hint = document.createElement('span');hint.className='ui-meta'; hint.textContent = 'Drag to shape · ↑ ↓ adjust · double-click to reset';
  const paint = () => {
    const points = Array.from({length:81}, (_,i) => { const x=i/80; return `${10+x*200},${66-58*powerCurve(value,x,spec.curve)}`; });
    svg.querySelector('.mini-curve-path').setAttribute('d', 'M'+points.join('L'));
    const handle=svg.querySelector('circle');handle.setAttribute('cx','110');handle.setAttribute('cy',String(66-58*powerCurve(value,.5,spec.curve)));
    svg.setAttribute('aria-valuenow', String(value));
    if (spec.inputMin !== undefined) svg.setAttribute('aria-valuemin', String(spec.inputMin));
    if (spec.inputMax !== undefined) svg.setAttribute('aria-valuemax', String(spec.inputMax));
  };
  const send = (raw,commit) => {
    const limits = { ...spec, inputMin:Math.max(0.0001,spec.inputMin ?? 0.0001) };
    value = Math.max(limits.inputMin, Math.min(spec.inputMax ?? Infinity, raw)); paint(); onSet(value,commit);
  };
  const move = event => {
    const rect=svg.getBoundingClientRect();
    const x=((event.clientX-rect.left)/rect.width*220-10)/200, y=(66-(event.clientY-rect.top)/rect.height*76)/58;
    const raw=curveExponent(x,y,spec.curve), step=numberStep(spec);
    send(Math.round(raw/step)*step,false);
  };
  listen(svg,'pointerdown',event=>{if(event.button!==0)return;event.preventDefault();svg.focus();original=value;pointerId=event.pointerId;dragging=true;svg.setPointerCapture(event.pointerId);move(event);});
  listen(svg,'pointermove',event=>{if(dragging)move(event);});
  function finish(cancel=false){if(!dragging)return;dragging=false;send(cancel?original:value,true);if(svg.hasPointerCapture(pointerId))svg.releasePointerCapture(pointerId);}
  listen(svg,'pointerup',()=>finish());listen(svg,'pointercancel',()=>finish(true));listen(svg,'lostpointercapture',()=>finish(true));listen(document,'visibilitychange',()=>{if(document.hidden)finish(true);});
  listen(svg,'keydown',event=>{if(event.key==='Escape'){event.preventDefault();finish(true);return;}if(['ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(event.key)){event.preventDefault();send(steppedNumber(value,['ArrowUp','ArrowRight'].includes(event.key)?1:-1,spec),true);}});
  listen(svg,'dblclick',()=>send(spec.default??1,true));
  element.append(svg,hint);paint();
  return {element,dispose(){finish(true);for(const remove of removers)remove();},sync(next,nextSpec){spec=nextSpec;if(!dragging){value=next;paint();}}};
}

UI.createIntervalControl=({spec:initial,onSet,onError,model,document=window.document})=>{
  const {sliderBounds,rangeEndpoint,rangeValue,typedNumber,numberStep,steppedNumber,wireNumberInput}=model;
  let spec=initial,start=0,other=0,endSpec={},dragging=false,dragBounds=null,original=null,activeHandle=null,activeFinish=null;const removers=[];
  function listen(node,type,handler){node.addEventListener(type,handler);removers.push(()=>node.removeEventListener(type,handler));}
  const element=document.createElement('div');element.className='ui-interval-control ui-stack';
  const track=document.createElement('div');track.className='ui-interval-track';Object.assign(track.style,{position:'relative',blockSize:'4px',margin:'var(--ui-control-height) 10px',background:'var(--ui-line)'});
  const fill=document.createElement('i');Object.assign(fill.style,{position:'absolute',blockSize:'100%',background:'var(--ui-accent)',pointerEvents:'none'});track.append(fill);
  const fields=document.createElement('div');fields.className='ui-actions';fields.style.flexWrap='nowrap';
  const handles=[], inputs=[];
  const paint=()=>{
    const end=rangeEndpoint(start,other,spec.rangeControl.mode), bounds=dragBounds ? {...dragBounds} : sliderBounds(spec,start);
    if (!dragBounds) { bounds.min=Math.min(bounds.min,end);bounds.max=Math.max(bounds.max,end); }
    const span=bounds.max-bounds.min||1;
    [start,end].forEach((value,index)=>{handles[index].style.left=`${(value-bounds.min)/span*100}%`;handles[index].setAttribute('aria-valuenow',String(value));if(document.activeElement!==inputs[index]&&!inputs[index].dataset.draft)inputs[index].value=Number(Number(value).toPrecision(6)).toString();});
    fill.style.left=`${(Math.min(start,end)-bounds.min)/span*100}%`;fill.style.width=`${Math.abs(end-start)/span*100}%`;
    track.classList.toggle('is-hue',spec.rangeControl.spectrum==='hue');
    if (spec.rangeControl.spectrum === 'hue') {
      const stops = Array.from({length:49},(_,i)=>`hsl(${((bounds.min+i/48*span)*360)%360} 70% 65%) ${i/48*100}%`);
      track.style.background = `linear-gradient(90deg,${stops.join(',')})`;
    } else track.style.background='var(--ui-line)';
    return bounds;
  };
  const send=(index,raw,commit=true)=>{
    try {
      const limits=index?endSpec:spec;
      const requested=index ? rangeValue(start,Number(raw),spec.rangeControl.mode) : raw;
      const next=typedNumber(commit ? requested : Math.max(limits.inputMin??-Infinity,Math.min(limits.inputMax??Infinity,Number(requested))),limits);
      if(index)other=next;else start=next;
      paint();Promise.resolve(onSet(index?spec.rangeControl.end:spec.key||spec.id,next,commit)).catch(onError);return true;
    }catch(error){onError(error);return false;}
  };
  for(let index=0;index<2;index++){
    const handle=document.createElement('button');handle.type='button';handle.className='ui-interval-handle';Object.assign(handle.style,{position:'absolute',top:'50%',transform:'translate(-50%,-50%)',inlineSize:'var(--ui-control-height)',minInlineSize:'var(--ui-control-height)',padding:'0',touchAction:'none',cursor:'ew-resize'});const mark=document.createElement('span');mark.textContent='│';mark.setAttribute('aria-hidden','true');handle.append(mark);handle.setAttribute('role','slider');handle.setAttribute('aria-label',`${spec.label} ${index?'end':'start'}`);
    const field=document.createElement('label');field.className='ui-field';field.style.flex='1 1 0';const caption=document.createElement('span');caption.className='ui-label';caption.textContent=index?'End':'Start';field.append(caption);
    const input=document.createElement('input');input.type='number';input.step='any';input.setAttribute('aria-label',`${spec.label} range ${index?'end':'start'}`);field.append(input);fields.append(field);
    handles.push(handle);inputs.push(input);track.append(handle);
    let dirty = false;
    listen(input,'input',()=>{dirty=true;input.dataset.draft='true';});
    const commitInput = () => {if(dirty&&send(index,input.value)){dirty=false;delete input.dataset.draft;}};
    listen(input,'change',commitInput);
    listen(input,'keydown',event=>{
      if(event.key==='Enter'){event.preventDefault();commitInput();input.blur();}
      if(event.key==='Escape'){event.preventDefault();dirty=false;delete input.dataset.draft;input.value=String(index?rangeEndpoint(start,other,spec.rangeControl.mode):start);input.blur();}
    });
    wireNumberInput(input,()=>index?{step:endSpec.step}:spec,value=>{dirty=false;delete input.dataset.draft;send(index,value);});
    let bounds=null;
    const move=event=>{const rect=track.getBoundingClientRect(),x=Math.max(0,Math.min(1,(event.clientX-rect.left)/rect.width)),step=numberStep(index?endSpec:spec);send(index,Number((Math.round((bounds.min+x*(bounds.max-bounds.min))/step)*step).toPrecision(12)),false);};
    listen(handle,'pointerdown',event=>{if(event.button!==0||dragging)return;event.preventDefault();handle.focus();activeHandle=handle;activeFinish=finish;bounds=paint();dragBounds=bounds;original={start,other,pointerId:event.pointerId};dragging=true;handle.setPointerCapture(event.pointerId);});
    listen(handle,'pointermove',event=>{if(dragging&&handle.hasPointerCapture(event.pointerId))move(event);});
    const finish=(cancel=false)=>{if(!dragging||activeHandle!==handle)return;dragging=false;activeHandle=null;activeFinish=null;dragBounds=null;if(cancel){start=original.start;other=original.other;}send(index,index?rangeEndpoint(start,other,spec.rangeControl.mode):start,true);if(handle.hasPointerCapture(original.pointerId))handle.releasePointerCapture(original.pointerId);};
    listen(handle,'pointerup',()=>finish());listen(handle,'pointercancel',()=>finish(true));listen(handle,'lostpointercapture',()=>finish(true));listen(document,'visibilitychange',()=>{if(document.hidden)finish(true);});
    listen(handle,'keydown',event=>{if(event.key==='Escape'){event.preventDefault();finish(true);return;}if(['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(event.key)){event.preventDefault();const delta=['ArrowRight','ArrowUp'].includes(event.key)?1:-1;send(index,steppedNumber(index?rangeEndpoint(start,other,spec.rangeControl.mode):start,delta,index?{step:endSpec.step}:spec));}});
  }
  element.append(track,fields);
  return {element,dispose(){activeFinish?.(true);for(const remove of removers)remove();},sync(next,nextSpec,parameters){spec=nextSpec;endSpec=parameters.find(item=>(item.key||item.id)===spec.rangeControl.end);element.hidden=!endSpec;if(!endSpec)return;if(!dragging){start=next;other=Number(endSpec.value??endSpec.default??0);paint();}}};
}

})();

/* Fit registered native groups on size changes, without rebuilding app controls. */
(() => {
  'use strict';
  if(typeof window==='undefined'||!window.SharedUI)return;
  const UI=window.SharedUI,pools=new WeakMap();
  const actionSelector='.ui-action',overflowSelector='details.ui-overflow';
  const fixedLabel='[data-ui-label=hidden],[data-ui-label=always],.ui-item';
  const number=value=>parseFloat(value)||0;
  function poolFor(doc){
    if(pools.has(doc))return pools.get(doc);
    const view=doc.defaultView,groups=new Map(),pending=new Set(),targets=new Map(),removers=[];
    if(!view?.ResizeObserver)return null;
    const context=doc.createElement('canvas').getContext('2d');
    let frame=0,paused=doc.visibilityState==='hidden',disposed=false;
    function style(node){return view.getComputedStyle(node);}
    function shown(node){return !node.hidden&&style(node).display!=='none';}
    function children(node){return [...node.children].filter(shown);}
    function sides(css){return number(css.paddingLeft)+number(css.paddingRight)+number(css.borderLeftWidth)+number(css.borderRightWidth);}
    function margins(css){return number(css.marginLeft)+number(css.marginRight);}
    function outer(node){const css=style(node);return (node.getBoundingClientRect().width||number(css.width))+margins(css);}
    function caption(node){const css=style(node);if(!context)return node.scrollWidth;context.font=css.font;const group=node.querySelector(':scope > .ui-dynamic'),texts=[node.textContent.trim(),...[...group?.querySelectorAll(':scope > [data-ui-text]')||[]].map(item=>item.getAttribute('data-ui-text'))];return Math.max(...texts.map(text=>context.measureText(text).width+Math.max(0,text.length-1)*number(css.letterSpacing)));}
    function actionWidth(node,compact=false){
      const css=style(node),label=node.querySelector(':scope > .ui-label'),icon=node.querySelector(':scope > svg.ui-icon');
      if(!label||!icon)return outer(node);
      const hidden=compact||node.dataset.uiLabel==='hidden';
      const glyph=number(style(icon).width)||18;
      const toggle=node.matches('.ui-toggle')?node.querySelector(':scope > input'):null;
      const extra=(node.tagName==='SUMMARY'&&!node.parentElement.matches(overflowSelector)?14:0)+(toggle?outer(toggle)+number(css.columnGap):0);
      const inset=number(css.getPropertyValue?.('--ui-control-inset'))||number(css.paddingLeft);
      const padding=hidden?Math.max(0,(number(css.minWidth)-glyph-2)/2):inset;
      return Math.max(number(css.minWidth),glyph+(hidden?0:caption(label)+number(css.columnGap))+extra+padding*2+2)+margins(css);
    }
    function isAction(node){return node.matches(actionSelector);}
    function eligible(node){return !node.matches(fixedLabel)&&node.querySelector(':scope > .ui-label')&&(node.matches('.ui-field')||isAction(node)&&node.querySelector(':scope > svg.ui-icon')&&(style(node.querySelector(':scope > svg.ui-icon')).display!=='none'||node.getAttribute('aria-busy')==='true'));}
    function fieldWidth(node,compact){
      const css=style(node),gap=number(css.columnGap);
      const parts=[...node.children].filter(child=>!child.hidden&&(child.matches('.ui-label')||shown(child))&&(!compact||!child.matches('.ui-label'))).map(child=>{
        if(child.matches('.ui-label'))return caption(child);
        if(child.tagName==='SELECT'){const text=child.selectedOptions?.[0]?.label||child.value;const fieldCSS=style(child);if(context)context.font=fieldCSS.font;return (context?context.measureText(text||'').width:outer(child))+24;}
        if(child.tagName==='INPUT'){if(child.type==='checkbox'||child.type==='radio')return outer(child);if(child.type==='range')return number(css.getPropertyValue?.('--ui-range-width'))||128;return Math.max(number(style(child).minWidth),72);}
        return isAction(child)?actionWidth(child,compact&&eligible(child)):outer(child);
      });
      return parts.reduce((sum,value)=>sum+value,0)+gap*Math.max(0,parts.length-1)+sides(css)+margins(css);
    }
    function contents(node){return node.matches(overflowSelector)?children(node).flatMap(child=>child.tagName==='SUMMARY'?[]:child.matches('.ui-actions')?children(child):[child]):children(node);}
    function width(node,compact,collapsed){
      if(node.matches(overflowSelector)){
        if(collapsed.has(node))return actionWidth(node.querySelector(':scope > summary'),true);
        return rowWidth(contents(node),style(node.querySelector(':scope > .ui-actions')||node),compact,collapsed);
      }
      if(isAction(node))return actionWidth(node,compact&&eligible(node));
      if(node.matches('.ui-field'))return fieldWidth(node,compact&&eligible(node));
      if(node.tagName==='DETAILS'){const summary=node.querySelector(':scope > summary');if(summary&&isAction(summary))return actionWidth(summary,compact&&eligible(summary));}
      if(node.matches('.ui-actions.ui-inline,[data-ui-layout=inline]')||style(node).display==='contents')return rowWidth(children(node),style(node),compact,collapsed,node.matches('.ui-fill'));
      const css=style(node),basis=number(css.flexBasis);if(number(css.flexGrow)>0)return Math.max(number(css.minWidth),basis||caption(node)+sides(css))+margins(css);
      // The header identity's auto margin is leftover space, not caption width.
      if(node.parentElement?.matches('.ui-header')&&node===children(node.parentElement)[0]&&!node.matches('.ui-actions,.ui-action,.ui-field,button,details'))return node.getBoundingClientRect().width;
      return outer(node);
    }
    function rowWidth(nodes,css,compact,collapsed,equal=false){const widths=nodes.map(node=>width(node,compact,collapsed));return (equal?Math.max(0,...widths)*nodes.length:widths.reduce((sum,value)=>sum+value,0))+number(css.columnGap)*Math.max(0,nodes.length-1);}
    function descendants(nodes){return nodes.flatMap(node=>node.matches(overflowSelector)?descendants(contents(node)):node.matches('.ui-actions.ui-inline,[data-ui-layout=inline]')?descendants(children(node)):node.tagName==='DETAILS'?[node.querySelector(':scope > summary')].filter(Boolean):[node]);}
    function priorities(nodes){return nodes.flatMap(node=>node.matches(overflowSelector)?[node]:node.matches('.ui-actions.ui-inline,[data-ui-layout=inline]')?priorities(children(node)):[]);}
    function setCompact(node,value){if(value){if(!node.hasAttribute('data-ui-compact'))node.setAttribute('data-ui-compact','');}else if(node.hasAttribute('data-ui-compact'))node.removeAttribute('data-ui-compact');}
    function untrack(group){const item=groups.get(group);if(!item)return;groups.delete(group);pending.delete(group);const count=targets.get(item.target)-1;if(count)targets.set(item.target,count);else{targets.delete(item.target);observer.unobserve(item.target);}}
    function queue(group){if(disposed||paused)return;pending.add(group);if(!frame)frame=view.requestAnimationFrame(flush);}
    function fit(group,item){
      if(!group.isConnected){untrack(group);return;}
      // Overflow contents are governed by their outer group, including while closed.
      if(group.closest(overflowSelector))return;
      const css=style(group),nodes=children(group).filter(node=>!['absolute','fixed'].includes(style(node).position)),actions=descendants(nodes).filter(eligible);
      const overflows=priorities(nodes);
      const vertical=group.dataset.uiLayout==='vertical'||css.flexDirection==='column';
      const targetCSS=style(item.target),box=item.target.getBoundingClientRect();
      if(!box.width)return;
      let available=item.target.clientWidth-number(targetCSS.paddingLeft)-number(targetCSS.paddingRight);
      if(item.target!==group){
        // Intrinsic groups beside identity/metadata use only the remaining row space.
        if(targetCSS.display.includes('flex')&&targetCSS.flexDirection!=='column'){
          const siblings=children(item.target).filter(node=>node!==group&&!['absolute','fixed'].includes(style(node).position));
          available-=siblings.reduce((sum,node)=>sum+width(node,false,new Set()),0)+number(targetCSS.columnGap)*siblings.length;
        }else available=Math.min(available,group.clientWidth||available);
        available-=margins(css)+sides(css);
      }
      const collapsed=new Set(),limit=Math.max(0,available-2);
      const required=mode=>rowWidth(nodes,css,mode,collapsed,group.matches('.ui-fill'));
      const compact=!vertical&&required(false)>limit;
      for(const node of actions)setCompact(node,compact);
      const equal=nodes.length>1&&!vertical&&!group.matches('.ui-fill,.ui-inline,[data-ui-layout=inline]')&&nodes.every(node=>node.matches('.ui-action,button'))&&(group.matches('.ui-tabs')?compact:limit<480);
      const slot=(limit-number(css.columnGap)*(nodes.length-1))/nodes.length;
      if(equal&&nodes.every(node=>width(node,compact,collapsed)<=slot))group.setAttribute('data-ui-equal','');else group.removeAttribute('data-ui-equal');
      if(!vertical){
        // Higher numeric priority stays visible longer. Collapse entire authored groups.
        for(const node of [...overflows].sort((a,b)=>number(a.dataset.uiPriority)-number(b.dataset.uiPriority))){
          if(required(compact)<=limit)break;
          collapsed.add(node);
        }
      }
      for(const node of overflows){
        if(node.dataset.uiOverflow==='collapsed'&&node.querySelector(':scope > summary')===doc.activeElement)collapsed.add(node);
        const mode=collapsed.has(node)?'collapsed':'expanded';
        if(mode==='collapsed')for(const action of descendants(contents(node)).filter(eligible))setCompact(action,false);
        if(node.dataset.uiOverflow!==mode){
          const activeInside=node.contains(doc.activeElement)&&doc.activeElement!==node.querySelector(':scope > summary');
          node.dataset.uiOverflow=mode;
          // Keep focused inputs/actions reachable; never close a user's expanded tile during resize.
          if(mode==='expanded')node.open=true;else if(!activeInside)node.open=false;
        }
      }
      const after=item.target.getBoundingClientRect();item.width=after.width;item.height=after.height;
    }
    function flush(){frame=0;const work=[...pending];pending.clear();for(const group of work){const item=groups.get(group);if(item)fit(group,item);}for(const group of groups.keys())if(!group.isConnected)untrack(group);}
    const observer=new view.ResizeObserver(entries=>{
      for(const entry of entries)for(const [group,item]of groups)if(item.target===entry.target){const box=entry.target.getBoundingClientRect();if(box.width!==item.width||box.height!==item.height)queue(group);}
    });
    function register(group){
      if(!group||disposed||group.closest(overflowSelector))return;
      // A horizontal row owns its intrinsic subgroups. Registering both lets a
      // child's later fit undo the parent's caption mode and creates outliers.
      const parent=group.parentElement;
      if(group.matches('.ui-inline,[data-ui-layout=inline]')&&parent?.matches('.ui-actions,.ui-toolbar')&&parent.dataset.uiLayout!=='vertical'&&style(parent).flexDirection!=='column'){register(parent);return;}
      let item=groups.get(group);
      if(!item){const target=group.matches('.ui-inline,[data-ui-layout=inline]')?group.parentElement:group;if(!target)return;item={target,width:-1,height:-1};groups.set(group,item);targets.set(target,(targets.get(target)||0)+1);if(!paused)observer.observe(target);}
      queue(group);
    }
    function refresh(){for(const group of groups.keys())queue(group);}
    function suspend(){paused=true;observer.disconnect();view.cancelAnimationFrame(frame);frame=0;pending.clear();}
    function resume(){if(disposed||doc.visibilityState==='hidden')return;paused=false;for(const group of groups.keys())if(!group.isConnected)untrack(group);for(const target of targets.keys())observer.observe(target);refresh();}
    function on(target,type,handler,capture=false){target.addEventListener(type,handler,capture);removers.push(()=>target.removeEventListener(type,handler,capture));}
    function dispose(){if(disposed)return;disposed=true;suspend();for(const remove of removers)remove();groups.clear();targets.clear();pools.delete(doc);}
    on(doc,'visibilitychange',()=>doc.visibilityState==='hidden'?suspend():resume());
    on(view,'pagehide',event=>event.persisted?suspend():dispose());on(view,'pageshow',resume);
    on(doc,'keydown',event=>{if(event.key!=='Escape')return;const tile=event.target.closest?.(overflowSelector);if(tile?.open&&tile.dataset.uiOverflow==='collapsed'){event.preventDefault();tile.open=false;tile.querySelector(':scope > summary')?.focus();}});
    on(doc,'ui:styles',refresh);on(doc,'focusout',event=>{const group=event.target.closest?.('.ui-actions,.ui-toolbar');if(group)queue(group);});
    on(doc,'toggle',event=>{const group=event.target.parentElement?.closest('.ui-actions,.ui-toolbar');if(group)register(group);},true);
    const fonts=doc.fonts;if(fonts){on(fonts,'loadingdone',refresh);fonts.ready.then(()=>{if(!disposed)refresh();});}
    const pool={register,refresh,dispose,release:root=>{for(const group of groups.keys())if(group===root||root.contains(group))untrack(group);}};pools.set(doc,pool);return pool;
  }
  UI.observeActions=group=>{const pool=poolFor(group.ownerDocument);pool?.register(group);return {refresh:()=>pool?.register(group)};};
  UI.releaseActions=root=>pools.get(root.ownerDocument)?.release(root);
  UI.refreshActions=(doc=document)=>pools.get(doc)?.refresh();
  UI.disposeActions=(doc=document)=>pools.get(doc)?.dispose();
  UI.mountActions=(doc=document)=>{if(!doc.documentElement?.dataset.ui)return;const pool=poolFor(doc);if(pool)for(const group of doc.querySelectorAll('.ui-actions,.ui-toolbar'))pool.register(group);};
  UI.createOverflow=(actions,{label='More actions',priority=0,sprite='./shared-ui/icons.svg'}={})=>{
    const nodes=[...actions];if(!nodes.length)return null;
    if(!nodes[0].parentElement||nodes.some(node=>node.ownerDocument!==nodes[0].ownerDocument||node.parentElement!==nodes[0].parentElement))throw new TypeError('Priority controls must share one native parent');
    const doc=nodes[0].ownerDocument,details=doc.createElement('details'),summary=doc.createElement('summary'),body=doc.createElement('div');
    details.className='ui-disclosure ui-overflow';details.dataset.uiPriority=String(priority);body.className='ui-actions ui-disclosure-body';
    UI.adoptAction(summary,{icon:'more',label,iconOnly:true,sprite});summary.classList.add('ui-icon-button');nodes[0].before(details);body.append(...nodes);details.append(summary,body);
    const group=details.parentElement?.closest('.ui-actions,.ui-toolbar');if(group)UI.observeActions(group);return details;
  };
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>UI.mountActions(document),{once:true});else UI.mountActions(document);
UI.createCurveControl=({label='Response',points:initial=[1/3,0,2/3,1],defaults:initialDefaults=initial,invert=false,xLabel:horizontal='Progress',yLabel:vertical='Response',endpointLabels=['Start','End'],onChange=()=>{},onError=console.error,document=window.document}={})=>{
  const plot=([x,y])=>[30+x*240,144-y*120];
  function svgNode(name,attrs={}){const node=document.createElementNS('http://www.w3.org/2000/svg',name);for(const [key,value]of Object.entries(attrs))node.setAttribute(key,String(value));return node;}
  const clampUnit=value=>Math.max(0,Math.min(1,value)),CURVE_PRESETS={Linear:[1/3,1/3,2/3,2/3],Smooth:[1/3,0,2/3,1],Early:[.2,.65,.5,1],Late:[.5,0,.8,.35]};
  let points=[...initial],drag=null,available=true,disposed=false;const removers=[];
  function listen(node,type,handler){node.addEventListener(type,handler);removers.push(()=>node.removeEventListener(type,handler));}
  const element=document.createElement('div');element.className='ui-curve-control ui-stack';
  const graph=svgNode('svg',{viewBox:'0 0 300 176',role:'group','aria-label':`${label} curve editor`});
  const grid=svgNode('path',{class:'bezier-grid',d:'M30 24V144H270M30 84H270M150 24V144M270 24V144M30 24H270'});
  const fill=svgNode('path',{class:'bezier-fill'}),path=svgNode('path',{class:'bezier-path'});
  const lines=[0,1].map(()=>svgNode('line',{class:'bezier-tangent'}));
  const handles=[0,1].map((i)=>svgNode('circle',{r:7,tabindex:0,role:'slider',class:'bezier-handle',
    'aria-label':`${label} handle ${i+1}`,'aria-valuemin':0,'aria-valuemax':1}));
  const endpointMode=initial.length===6;
  if(endpointMode)element.dataset.endpoints='true';
  const endpointNames=endpointLabels;
  const ends=[0,1].map((i)=>svgNode('circle',{r:endpointMode?5:3,class:'bezier-end',...(endpointMode?{tabindex:0,role:'slider','aria-label':`${label} ${endpointNames[i]} endpoint`,'aria-valuemin':0,'aria-valuemax':1}:{})}));
  const controls=endpointMode?[...handles,...ends]:handles;
  const xLabel=svgNode('text',{x:150,y:168,'text-anchor':'middle'});xLabel.textContent=horizontal;
  const yLabel=svgNode('text',{x:12,y:84,transform:'rotate(-90 12 84)','text-anchor':'middle'});yLabel.textContent=vertical;
  graph.append(grid,fill,...lines,path,...ends,...handles,xLabel,yLabel);
  const fields=document.createElement('div');fields.className='ui-actions';fields.style.display='grid';fields.style.gridTemplateColumns=`repeat(${endpointMode?3:2},minmax(0,1fr))`;
  const inputs=[];
  for(let i=0;i<(endpointMode?6:4);i++){
    const field=document.createElement('label');field.className='ui-field';const caption=document.createElement('span');caption.className='ui-label';caption.textContent=i<4?`${i<2?'1':'2'} ${i%2?'Y':'X'}`:endpointNames[i-4];
    const input=document.createElement('input');input.type='number';input.min='0';input.max='1';input.step='.01';
    input.setAttribute('aria-label',i<4?`${label} handle ${Math.floor(i/2)+1} ${i%2?'Y':'X'}`:`${label} ${endpointNames[i-4]} density`);
    let dirty=false;
    listen(input,'input',()=>{dirty=true;input.dataset.draft='true';});
    const apply=()=>{if(!dirty)return;const value=Number(input.value);if(input.value.trim()===''||!Number.isFinite(value)||value<0||value>1){input.setCustomValidity('Enter a number from 0 to 1');input.reportValidity();return;}dirty=false;delete input.dataset.draft;input.setCustomValidity('');points[i]=value;send(true);};
    listen(input,'change',apply);
    listen(input,'keydown',event=>{
      if(event.key==='Enter'){event.preventDefault();apply();}
      if(event.key==='Escape'){event.preventDefault();dirty=false;delete input.dataset.draft;input.value=String(points[i]);input.setCustomValidity('');}
    });
    field.append(caption,input);fields.append(field);inputs.push(input);
  }
  const presets=document.createElement('div');presets.className='ui-actions';
  for(const [name,value]of Object.entries(CURVE_PRESETS)){
    const button=document.createElement('button');button.type='button';button.textContent=name;
    button.setAttribute('aria-label',`${label} ${name.toLowerCase()} preset`);
    listen(button,'click',()=>{points=endpointMode?[value[0],points[4]+(points[5]-points[4])*value[1],value[2],points[4]+(points[5]-points[4])*value[3],points[4],points[5]]:[...value];send(true);});presets.append(button);
  }
  const reset=document.createElement('button');reset.type='button';reset.textContent='Reset';reset.setAttribute('aria-label',`Reset ${label} curve`);
  let defaults=[...initialDefaults];listen(reset,'click',()=>{points=[...defaults];send(true);});presets.append(reset);
  const hint=document.createElement('span');hint.className='ui-meta';hint.textContent='Drag handles · arrow keys adjust · Esc cancels';
  const status=document.createElement('output');status.className='ui-meta';status.setAttribute('aria-live','polite');
  function paint(){
    const displayY=y=>invert?1-y:y;
    const p0=plot([0,displayY(points[4]??0)]),p1=plot([points[0],displayY(points[1])]),p2=plot([points[2],displayY(points[3])]),p3=plot([1,displayY(points[5]??1)]);
    const d=`M${p0} C${p1} ${p2} ${p3}`;
    path.setAttribute('d',d);fill.setAttribute('d',`${d} L270 144 L30 144 Z`);
    [p0,p3].forEach((p,i)=>{ends[i].setAttribute('cx',p[0]);ends[i].setAttribute('cy',p[1]);if(endpointMode)ends[i].setAttribute('aria-valuenow',points[i+4]);});
    [p1,p2].forEach((p,i)=>{
      lines[i].setAttribute('x1',[p0,p3][i][0]);lines[i].setAttribute('y1',[p0,p3][i][1]);lines[i].setAttribute('x2',p[0]);lines[i].setAttribute('y2',p[1]);
      handles[i].setAttribute('cx',p[0]);handles[i].setAttribute('cy',p[1]);handles[i].setAttribute('aria-valuenow',points[i*2+1]);
      handles[i].setAttribute('aria-valuetext',`X ${points[i*2].toFixed(3)}, Y ${points[i*2+1].toFixed(3)}`);
    });
    inputs.forEach((input,i)=>{if(document.activeElement!==input&&!input.dataset.draft)input.value=Number(Number(points[i]).toPrecision(6)).toString();});
  }
  function send(commit){if(!available)return;paint();try{Promise.resolve(onChange([...points],commit)).catch(onError);}catch(error){onError(error);}}
  const move=event=>{
    const rect=graph.getBoundingClientRect(),x=clampUnit(((event.clientX-rect.left)/rect.width*300-30)/240),shownY=clampUnit((144-(event.clientY-rect.top)/rect.height*176)/120);
    const i=drag.index<2?drag.index*2:drag.index+2;
    if(drag.index<2)points[i]=Math.round(x*10000)/10000;
    points[drag.index<2?i+1:i]=Math.round((invert?1-shownY:shownY)*10000)/10000;send(false);
  };
  const end=(cancel=false)=>{if(!drag)return;const old=drag;drag=null;if(cancel)points=old.points;send(true);if(controls[old.index].hasPointerCapture(old.pointerId))controls[old.index].releasePointerCapture(old.pointerId);};
  controls.forEach((handle,index)=>{
    listen(handle,'pointerdown',event=>{if(event.button!==0||!available)return;event.preventDefault();event.stopPropagation();handle.focus();drag={index,pointerId:event.pointerId,points:[...points]};handle.setPointerCapture(event.pointerId);});
    listen(handle,'pointermove',event=>{if(drag?.index===index&&event.pointerId===drag.pointerId)move(event);});
    listen(handle,'pointerup',()=>end());listen(handle,'pointercancel',()=>end(true));listen(handle,'lostpointercapture',()=>end(true));
    listen(handle,'keydown',event=>{
      if(event.key==='Escape'){event.preventDefault();end(true);return;}
      if(!['ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(event.key))return;
      event.preventDefault();event.stopPropagation();const horizontal=['ArrowLeft','ArrowRight'].includes(event.key),isX=index<2&&horizontal,i=index<2?index*2+(horizontal?0:1):index+2;
      const direction=['ArrowUp','ArrowRight'].includes(event.key)?1:-1,step=event.shiftKey?.1:event.altKey?.001:.01;
      points[i]=Number(clampUnit(points[i]+direction*step*(isX||!invert?1:-1)).toFixed(6));send(true);
    });
  });
  listen(document,'visibilitychange',()=>{if(document.hidden)end(true);});
  Object.assign(graph.style,{display:'block',inlineSize:'100%',height:'auto',aspectRatio:'300/176',touchAction:'none',border:'1px solid var(--ui-control)',borderRadius:'var(--ui-radius-small)',background:'var(--ui-surface)'});
  grid.setAttribute('fill','none');grid.setAttribute('stroke','var(--ui-line)');fill.setAttribute('fill','var(--ui-accent-soft)');path.setAttribute('fill','none');path.setAttribute('stroke','var(--ui-accent)');path.setAttribute('stroke-width','2');
  for(const line of lines){line.setAttribute('stroke','var(--ui-muted)');line.setAttribute('stroke-dasharray','3 3');}
  for(const handle of [...handles,...ends]){handle.setAttribute('fill','var(--ui-text)');handle.setAttribute('stroke','var(--ui-surface)');handle.setAttribute('stroke-width','2');handle.style.cursor='grab';}
  for(const text of [xLabel,yLabel]){text.setAttribute('fill','var(--ui-muted)');text.style.font='10px var(--ui-font)';}
  controls.forEach(handle=>{listen(handle,'focus',()=>handle.setAttribute('stroke','var(--ui-accent)'));listen(handle,'blur',()=>handle.setAttribute('stroke','var(--ui-surface)'));});
  element.append(graph,fields,presets,hint,status);paint();
  return {element,sync({points:next,defaults:reset=defaults,available:enabled=true}={}){
    available=enabled;graph.setAttribute('aria-disabled',String(!available));defaults=[...reset];if(!drag&&next){points=[...next];paint();}
  },dispose(){if(disposed)return;disposed=true;end(true);for(const remove of removers)remove();}};
}

UI.createResponseControl=({spec:initial,onSet,model,document=window.document})=>{
  const {powerCurve,curveExponent,numberStep,steppedNumber}=model;
  let spec = initial, value = Number(spec.value ?? spec.default ?? 1), dragging = false,original=value,pointerId=null;const removers=[];
  function listen(node,type,handler){node.addEventListener(type,handler);removers.push(()=>node.removeEventListener(type,handler));}
  const element = document.createElement('div'); element.className = 'ui-response-control ui-stack';
  const svg = document.createElementNS('http://www.w3.org/2000/svg','svg');
  svg.setAttribute('viewBox','0 0 220 76'); svg.setAttribute('tabindex','0'); svg.setAttribute('role','slider');
  svg.setAttribute('aria-label', `${spec.label} curve`);
  svg.innerHTML = '<path class="mini-curve-grid" d="M10 8V66H210M10 37H210M110 8V66"/><path class="mini-curve-path"/><circle r="4" class="mini-curve-handle"/>';
  Object.assign(svg.style,{display:'block',inlineSize:'100%',height:'76px',touchAction:'none',cursor:'crosshair',border:'1px solid var(--ui-control)',borderRadius:'var(--ui-radius-small)',background:'var(--ui-surface)'});
  const grid=svg.querySelector('.mini-curve-grid'),path=svg.querySelector('.mini-curve-path'),dot=svg.querySelector('circle');grid.setAttribute('fill','none');grid.setAttribute('stroke','var(--ui-line)');path.setAttribute('fill','none');path.setAttribute('stroke','var(--ui-accent)');path.setAttribute('stroke-width','2');dot.setAttribute('fill','var(--ui-text)');
  const hint = document.createElement('span');hint.className='ui-meta'; hint.textContent = 'Drag to shape · ↑ ↓ adjust · double-click to reset';
  const paint = () => {
    const points = Array.from({length:81}, (_,i) => { const x=i/80; return `${10+x*200},${66-58*powerCurve(value,x,spec.curve)}`; });
    svg.querySelector('.mini-curve-path').setAttribute('d', 'M'+points.join('L'));
    const handle=svg.querySelector('circle');handle.setAttribute('cx','110');handle.setAttribute('cy',String(66-58*powerCurve(value,.5,spec.curve)));
    svg.setAttribute('aria-valuenow', String(value));
    if (spec.inputMin !== undefined) svg.setAttribute('aria-valuemin', String(spec.inputMin));
    if (spec.inputMax !== undefined) svg.setAttribute('aria-valuemax', String(spec.inputMax));
  };
  const send = (raw,commit) => {
    const limits = { ...spec, inputMin:Math.max(0.0001,spec.inputMin ?? 0.0001) };
    value = Math.max(limits.inputMin, Math.min(spec.inputMax ?? Infinity, raw)); paint(); onSet(value,commit);
  };
  const move = event => {
    const rect=svg.getBoundingClientRect();
    const x=((event.clientX-rect.left)/rect.width*220-10)/200, y=(66-(event.clientY-rect.top)/rect.height*76)/58;
    const raw=curveExponent(x,y,spec.curve), step=numberStep(spec);
    send(Math.round(raw/step)*step,false);
  };
  listen(svg,'pointerdown',event=>{if(event.button!==0)return;event.preventDefault();svg.focus();original=value;pointerId=event.pointerId;dragging=true;svg.setPointerCapture(event.pointerId);move(event);});
  listen(svg,'pointermove',event=>{if(dragging)move(event);});
  function finish(cancel=false){if(!dragging)return;dragging=false;send(cancel?original:value,true);if(svg.hasPointerCapture(pointerId))svg.releasePointerCapture(pointerId);}
  listen(svg,'pointerup',()=>finish());listen(svg,'pointercancel',()=>finish(true));listen(svg,'lostpointercapture',()=>finish(true));listen(document,'visibilitychange',()=>{if(document.hidden)finish(true);});
  listen(svg,'keydown',event=>{if(event.key==='Escape'){event.preventDefault();finish(true);return;}if(['ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(event.key)){event.preventDefault();send(steppedNumber(value,['ArrowUp','ArrowRight'].includes(event.key)?1:-1,spec),true);}});
  listen(svg,'dblclick',()=>send(spec.default??1,true));
  element.append(svg,hint);paint();
  return {element,dispose(){finish(true);for(const remove of removers)remove();},sync(next,nextSpec){spec=nextSpec;if(!dragging){value=next;paint();}}};
}

UI.createIntervalControl=({spec:initial,onSet,onError,model,document=window.document})=>{
  const {sliderBounds,rangeEndpoint,rangeValue,typedNumber,numberStep,steppedNumber,wireNumberInput}=model;
  let spec=initial,start=0,other=0,endSpec={},dragging=false,dragBounds=null,original=null,activeHandle=null,activeFinish=null;const removers=[];
  function listen(node,type,handler){node.addEventListener(type,handler);removers.push(()=>node.removeEventListener(type,handler));}
  const element=document.createElement('div');element.className='ui-interval-control ui-stack';
  const track=document.createElement('div');track.className='ui-interval-track';Object.assign(track.style,{position:'relative',blockSize:'4px',margin:'var(--ui-control-height) 10px',background:'var(--ui-line)'});
  const fill=document.createElement('i');Object.assign(fill.style,{position:'absolute',blockSize:'100%',background:'var(--ui-accent)',pointerEvents:'none'});track.append(fill);
  const fields=document.createElement('div');fields.className='ui-actions';fields.style.flexWrap='nowrap';
  const handles=[], inputs=[];
  const paint=()=>{
    const end=rangeEndpoint(start,other,spec.rangeControl.mode), bounds=dragBounds ? {...dragBounds} : sliderBounds(spec,start);
    if (!dragBounds) { bounds.min=Math.min(bounds.min,end);bounds.max=Math.max(bounds.max,end); }
    const span=bounds.max-bounds.min||1;
    [start,end].forEach((value,index)=>{handles[index].style.left=`${(value-bounds.min)/span*100}%`;handles[index].setAttribute('aria-valuenow',String(value));if(document.activeElement!==inputs[index]&&!inputs[index].dataset.draft)inputs[index].value=Number(Number(value).toPrecision(6)).toString();});
    fill.style.left=`${(Math.min(start,end)-bounds.min)/span*100}%`;fill.style.width=`${Math.abs(end-start)/span*100}%`;
    track.classList.toggle('is-hue',spec.rangeControl.spectrum==='hue');
    if (spec.rangeControl.spectrum === 'hue') {
      const stops = Array.from({length:49},(_,i)=>`hsl(${((bounds.min+i/48*span)*360)%360} 70% 65%) ${i/48*100}%`);
      track.style.background = `linear-gradient(90deg,${stops.join(',')})`;
    } else track.style.background='var(--ui-line)';
    return bounds;
  };
  const send=(index,raw,commit=true)=>{
    try {
      const limits=index?endSpec:spec;
      const requested=index ? rangeValue(start,Number(raw),spec.rangeControl.mode) : raw;
      const next=typedNumber(commit ? requested : Math.max(limits.inputMin??-Infinity,Math.min(limits.inputMax??Infinity,Number(requested))),limits);
      if(index)other=next;else start=next;
      paint();Promise.resolve(onSet(index?spec.rangeControl.end:spec.key||spec.id,next,commit)).catch(onError);return true;
    }catch(error){onError(error);return false;}
  };
  for(let index=0;index<2;index++){
    const handle=document.createElement('button');handle.type='button';handle.className='ui-interval-handle';Object.assign(handle.style,{position:'absolute',top:'50%',transform:'translate(-50%,-50%)',inlineSize:'var(--ui-control-height)',minInlineSize:'var(--ui-control-height)',padding:'0',touchAction:'none',cursor:'ew-resize'});const mark=document.createElement('span');mark.textContent='│';mark.setAttribute('aria-hidden','true');handle.append(mark);handle.setAttribute('role','slider');handle.setAttribute('aria-label',`${spec.label} ${index?'end':'start'}`);
    const field=document.createElement('label');field.className='ui-field';field.style.flex='1 1 0';const caption=document.createElement('span');caption.className='ui-label';caption.textContent=index?'End':'Start';field.append(caption);
    const input=document.createElement('input');input.type='number';input.step='any';input.setAttribute('aria-label',`${spec.label} range ${index?'end':'start'}`);field.append(input);fields.append(field);
    handles.push(handle);inputs.push(input);track.append(handle);
    let dirty = false;
    listen(input,'input',()=>{dirty=true;input.dataset.draft='true';});
    const commitInput = () => {if(dirty&&send(index,input.value)){dirty=false;delete input.dataset.draft;}};
    listen(input,'change',commitInput);
    listen(input,'keydown',event=>{
      if(event.key==='Enter'){event.preventDefault();commitInput();input.blur();}
      if(event.key==='Escape'){event.preventDefault();dirty=false;delete input.dataset.draft;input.value=String(index?rangeEndpoint(start,other,spec.rangeControl.mode):start);input.blur();}
    });
    wireNumberInput(input,()=>index?{step:endSpec.step}:spec,value=>{dirty=false;delete input.dataset.draft;send(index,value);});
    let bounds=null;
    const move=event=>{const rect=track.getBoundingClientRect(),x=Math.max(0,Math.min(1,(event.clientX-rect.left)/rect.width)),step=numberStep(index?endSpec:spec);send(index,Number((Math.round((bounds.min+x*(bounds.max-bounds.min))/step)*step).toPrecision(12)),false);};
    listen(handle,'pointerdown',event=>{if(event.button!==0||dragging)return;event.preventDefault();handle.focus();activeHandle=handle;activeFinish=finish;bounds=paint();dragBounds=bounds;original={start,other,pointerId:event.pointerId};dragging=true;handle.setPointerCapture(event.pointerId);});
    listen(handle,'pointermove',event=>{if(dragging&&handle.hasPointerCapture(event.pointerId))move(event);});
    const finish=(cancel=false)=>{if(!dragging||activeHandle!==handle)return;dragging=false;activeHandle=null;activeFinish=null;dragBounds=null;if(cancel){start=original.start;other=original.other;}send(index,index?rangeEndpoint(start,other,spec.rangeControl.mode):start,true);if(handle.hasPointerCapture(original.pointerId))handle.releasePointerCapture(original.pointerId);};
    listen(handle,'pointerup',()=>finish());listen(handle,'pointercancel',()=>finish(true));listen(handle,'lostpointercapture',()=>finish(true));listen(document,'visibilitychange',()=>{if(document.hidden)finish(true);});
    listen(handle,'keydown',event=>{if(event.key==='Escape'){event.preventDefault();finish(true);return;}if(['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(event.key)){event.preventDefault();const delta=['ArrowRight','ArrowUp'].includes(event.key)?1:-1;send(index,steppedNumber(index?rangeEndpoint(start,other,spec.rangeControl.mode):start,delta,index?{step:endSpec.step}:spec));}});
  }
  element.append(track,fields);
  return {element,dispose(){activeFinish?.(true);for(const remove of removers)remove();},sync(next,nextSpec,parameters){spec=nextSpec;endSpec=parameters.find(item=>(item.key||item.id)===spec.rangeControl.end);element.hidden=!endSpec;if(!endSpec)return;if(!dragging){start=next;other=Number(endSpec.value??endSpec.default??0);paint();}}};
}

})();
