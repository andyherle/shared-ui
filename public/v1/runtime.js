/* Shared UI v1: native interactions and background CSS updates. No app state. */
(() => {
  'use strict';
  const DEFAULT_SOURCE='https://andyherle.github.io/shared-ui/v1/manifest.json';
  const PERIOD=5*60*1000, TIMEOUT=10000;
  function release(value,source=DEFAULT_SOURCE){
    if(!value||typeof value!=='object'||Array.isArray(value)||value.protocol!==1
      ||!/^1\.[0-9]+\.[0-9]+$/.test(value.version||'')||!/^([a-f0-9]{64})$/.test(value.revision||'')
      ||value.stylesheet!==`styles.${value.revision}.css`||!/^sha384-[A-Za-z0-9+/]{64}$/.test(value.integrity||''))throw new Error('Unsupported UI release');
    const base=new URL(source),url=new URL(value.stylesheet,base);
    if(!(base.protocol==='https:'||(base.protocol==='http:'&&['127.0.0.1','localhost','[::1]'].includes(base.hostname)))||url.origin!==base.origin||url.pathname!==base.pathname.replace(/[^/]*$/,'')+value.stylesheet)throw new Error('Invalid UI asset');
    return {protocol:1,version:value.version,revision:value.revision,stylesheet:value.stylesheet,integrity:value.integrity,url:url.href};
  }
  function mount(doc,options={}){
    const root=doc.documentElement,view=doc.defaultView;
    if(!root?.dataset.ui||!view)return {dispose(){},refresh:async()=>false};
    const source=options.source||(root.dataset.uiSource?new URL(root.dataset.uiSource,doc.baseURI).href:DEFAULT_SOURCE);
    const sourceURL=new URL(source),pageURL=new URL(doc.baseURI);if(source!==DEFAULT_SOURCE&&sourceURL.origin!==pageURL.origin&&!options.testSource)throw new Error('Unknown UI source');
    const localTheme=root.dataset.uiThemeScope==='view';
    const storage=(()=>{try{return view.localStorage;}catch{return null;}})();
    const key=`shared-ui:v1:${source}`,leaseKey=key+':lease',preference=root.dataset.ui==='personal'?'portal-theme':'postvisual-ui-mode';
    const id=view.crypto?.randomUUID?.()||`${Date.now()}-${Math.random()}`;
    const request=options.request||view.fetch.bind(view),now=options.now||Date.now;
    let stopped=false,timer=null,pending=null,pendingLink=null,activeLink=null,channel=null,cancelStyle=null,requestController=null;
    const removers=[],openedMenus=new Set();
    function on(target,type,handler,capture=false){target.addEventListener(type,handler,capture);removers.push(()=>target.removeEventListener(type,handler,capture));}
    function read(name){try{return JSON.parse(storage?.getItem(name)||'null');}catch{return null;}}
    function write(name,value){try{storage?.setItem(name,JSON.stringify(value));return Boolean(storage);}catch{return false;}}
    function removeLease(){const current=read(leaseKey);if(current?.id===id){try{storage.removeItem(leaseKey);}catch{}}}
    function setMode(mode,{persist=true}={}){
      if(!['dark','light','system'].includes(mode))return;
      if(mode==='system')delete root.dataset.theme;else root.dataset.theme=mode;
      if(persist&&!localTheme){try{if(mode==='system')storage?.removeItem(preference);else storage?.setItem(preference,mode);}catch{}}
    }
    if(root.dataset.ui==='postvisual'&&!localTheme){
      let saved;try{saved=storage?.getItem(preference);}catch{}
      if(saved==='dark'||saved==='light')setMode(saved,{persist:false});
    }
    function schedule(delay=PERIOD){view.clearTimeout(timer);if(!stopped&&doc.visibilityState!=='hidden')timer=view.setTimeout(tick,delay);}
    async function apply(value){
      const item=release(value,source);
      const bundled=api.version.split('.').map(Number),declared=(/^1\.\d+\.\d+$/.test(root.dataset.uiVersion||'')?root.dataset.uiVersion:api.version).split('.').map(Number);
      const candidate=item.version.split('.').map(Number),floor=declared[1]>bundled[1]||declared[1]===bundled[1]&&declared[2]>bundled[2]?declared:bundled;
      if(candidate[1]<floor[1]||(candidate[1]===floor[1]&&candidate[2]<floor[2]))return false;
      if(stopped||root.dataset.uiRevision===item.revision||pendingLink?.dataset.uiRevision===item.revision)return false;
      cancelStyle?.();
      const link=doc.createElement('link');
      link.rel='stylesheet';link.href=item.url;link.integrity=item.integrity;link.crossOrigin='anonymous';link.referrerPolicy='no-referrer';link.media='not all';link.dataset.uiRevision=item.revision;
      pendingLink=link;
      return new Promise(resolve=>{
        let done=false;
        const timeout=view.setTimeout(()=>finish(false),TIMEOUT);
        function finish(ok){
          if(done)return;done=true;view.clearTimeout(timeout);link.onload=null;link.onerror=null;
          if(pendingLink!==link||stopped)ok=false;
          if(ok){link.media='all';for(const baseline of doc.querySelectorAll('link[data-ui-baseline],style[data-ui-baseline]'))baseline.remove();const previous=activeLink;activeLink=link;root.dataset.uiRevision=item.revision;previous?.remove();doc.dispatchEvent(new view.CustomEvent('ui:styles',{detail:{revision:item.revision}}));}
          else link.remove();
          if(pendingLink===link){pendingLink=null;cancelStyle=null;}
          resolve(ok);
        }
        cancelStyle=()=>finish(false);link.onload=()=>finish(true);link.onerror=()=>finish(false);doc.head.append(link);
      });
    }
    async function acceptRelease(value){const item=release(value,source);if(stopped)return false;write(key,{at:now(),release:item});channel?.postMessage(item);return apply(item);}
    async function refresh(){
      if(stopped)return false;if(pending)return pending;
      pending=(async()=>{
        try{
          const controller=new view.AbortController();requestController=controller;const timeout=view.setTimeout(()=>controller.abort(),TIMEOUT);
          let response,text;
          try{response=await request(source,{cache:'no-cache',credentials:'omit',referrerPolicy:'no-referrer',redirect:'error',signal:controller.signal});
            if(!response.ok)throw new Error('UI release unavailable');text=await response.text();if(text.length>8192)throw new Error('UI manifest too large');
          }finally{view.clearTimeout(timeout);requestController=null;}
          return await acceptRelease(JSON.parse(text));
        }catch{return false;}finally{pending=null;}
      })();return pending;
    }
    async function tick(){
      if(stopped||doc.visibilityState==='hidden')return;
      const cached=read(key);if(cached?.release){try{await apply(cached.release);}catch{}}
      const current=read(leaseKey),time=now();
      if(!current||typeof current.until!=='number'||current.until<=time||current.until>time+PERIOD+TIMEOUT||current.id===id){
        write(leaseKey,{id,until:time+PERIOD+TIMEOUT});
        if(!storage||read(leaseKey)?.id===id)await refresh();
      }
      schedule();
    }
    try{if(view.BroadcastChannel){channel=new view.BroadcastChannel(key);channel.onmessage=event=>{void apply(event.data).catch(()=>{});};}}catch{}
    on(doc,'visibilitychange',()=>{if(doc.visibilityState==='hidden'){view.clearTimeout(timer);removeLease();}else schedule(50);});
    on(view,'storage',event=>{
      if(event.key===key){const cached=read(key);if(cached?.release)void apply(cached.release).catch(()=>{});}
      else if(event.key===leaseKey&&!event.newValue)schedule(100);
      else if(event.key===preference&&root.dataset.ui==='postvisual'&&!localTheme)setMode(event.newValue||'system',{persist:false});
    });
    on(doc,'click',event=>{const control=event.target.closest?.('[aria-disabled=true]');if(control?.matches?.('button,a,summary')){event.preventDefault();event.stopImmediatePropagation();}},true);
    const menuResize=view.ResizeObserver?new view.ResizeObserver(()=>positionMenus()):null;
    function closeMenu(menu,{focus=false}={}){if(!menu.open)return;menu.open=false;openedMenus.delete(menu);if(focus)menu.querySelector(':scope>summary')?.focus();}
    on(doc,'visibilitychange',()=>{if(doc.hidden)for(const [node,animation]of panelAnimations)if(node.ownerDocument===doc)animation.cancel();});
    on(doc,'toggle',event=>{const node=event.target;if(event.newState==='closed'||node.matches?.('details')&&!node.open){panelAnimations.get(node)?.cancel();for(const child of node.children||[])panelAnimations.get(child)?.cancel();}if(event.newState==='open'||node.open){if(node.matches?.('details')){for(const body of node.children||[])if(body.tagName!=='SUMMARY')animatePanel(body,{translate:false});}else if(node.matches?.('dialog,[popover]'))animatePanel(node);}},true);
    on(doc,'toggle',event=>{const menu=event.target;if(menu.matches?.('details.ui-menu')){if(menu.open){openedMenus.add(menu);api.positionMenu?.(menu);const panel=menu.querySelector(':scope > .ui-menu-panel');if(panel)menuResize?.observe(panel);}else{openedMenus.delete(menu);const panel=menu.querySelector(':scope > .ui-menu-panel');if(panel)menuResize?.unobserve(panel);}}},true);
    on(doc,'click',event=>{for(const menu of openedMenus)if(!menu.contains(event.target)&&!event.composedPath?.().includes(menu))closeMenu(menu);});
    on(doc,'keydown',event=>{if(event.key!=='Escape')return;const menu=event.target.closest?.('details.ui-menu')||[...(doc.querySelectorAll?.('details.ui-menu[open]')||[])].at(-1);if(menu?.open){event.preventDefault();closeMenu(menu,{focus:true});}});
    const positionMenus=()=>{if(doc.visibilityState!=='hidden')for(const menu of openedMenus)api.positionMenu?.(menu);};
    on(view,'resize',positionMenus);on(doc,'scroll',event=>{if(!event.target.closest?.('.ui-menu-panel'))positionMenus();},true);on(doc,'ui:styles',positionMenus);
    function dispose(){if(stopped)return;stopped=true;view.clearTimeout(timer);cancelStyle?.();requestController?.abort();channel?.close();removeLease();for(const remove of removers)remove();menuResize?.disconnect();openedMenus.clear();api.disposeActions?.(doc);}
    on(view,'pagehide',event=>{if(!event.persisted)dispose();else{view.clearTimeout(timer);removeLease();}});
    on(view,'pageshow',event=>{if(event.persisted)schedule(50);});
    schedule(100);
    return {dispose,refresh,setMode,applyRelease:apply,acceptRelease};
  }
  function reserveText(element,states){
    if(!element?.ownerDocument||element.matches?.('button,a,summary,input,select,textarea'))throw new TypeError('Reserve text on a label or text container');
    if(!Array.isArray(states)||!states.length||states.length>64||states.some(text=>typeof text!=='string'))throw new TypeError('Text states must be a nonempty list of strings (at most 64)');
    const values=[...new Set(states)],doc=element.ownerDocument;
    let group=element.querySelector(':scope > .ui-dynamic'),changed=!group;
    if(!group){group=doc.createElement('span');group.className='ui-dynamic';const current=doc.createElement('span');current.setAttribute('data-ui-current','');current.append(...element.childNodes);group.append(current);element.append(group);}
    const old=[...group.querySelectorAll(':scope > [data-ui-text]')];
    if(old.length!==values.length||old.some((node,index)=>node.getAttribute('data-ui-text')!==values[index])){
      changed=true;
      for(const node of old)node.remove();
      for(const value of values){const reserve=doc.createElement('span');reserve.setAttribute('aria-hidden','true');reserve.setAttribute('data-ui-text',value);group.append(reserve);}
    }
    if(changed){const row=element.closest?.('.ui-actions,.ui-toolbar');if(row)api.observeActions?.(row);}
    return element;
  }
  function setText(element,value){
    const current=element.querySelector(':scope > .ui-dynamic')?.querySelector(':scope > [data-ui-current]')||element;
    if(current.textContent!==String(value))current.textContent=String(value);
    return element;
  }
  function adoptNumberedAction(element,{number,...options}={}){
    if(!Number.isSafeInteger(number)||number<1)throw new TypeError('A positive document number is required');
    const action=adoptAction(element,{...options,icon:undefined}),doc=element.ownerDocument;
    let glyph=element.querySelector(':scope > svg');
    if(glyph?.getAttribute('data-ui-number')===String(number))return action;
    if(!glyph){glyph=doc.createElementNS('http://www.w3.org/2000/svg','svg');element.prepend(glyph);}
    for(const [name,value]of Object.entries({class:'ui-icon',viewBox:'0 0 24 24',fill:'none',stroke:'currentColor','aria-hidden':'true',focusable:'false','data-ui-number':String(number)}))glyph.setAttribute(name,value);
    const square=doc.createElementNS('http://www.w3.org/2000/svg','rect');
    for(const [name,value]of Object.entries({x:2,y:2,width:20,height:20,rx:3}))square.setAttribute(name,String(value));
    const text=doc.createElementNS('http://www.w3.org/2000/svg','text'),digits=String(number).length;
    for(const [name,value]of Object.entries({x:12,y:12,'dominant-baseline':'central','text-anchor':'middle',fill:'currentColor',stroke:'none','font-family':'var(--ui-font)','font-weight':'var(--ui-control-weight)','font-size':String(Math.min(14,26/digits))}))text.setAttribute(name,value);
    text.textContent=String(number);glyph.replaceChildren(square,text);
    const group=element.closest?.('.ui-actions,.ui-toolbar');if(group)api.observeActions?.(group);
    return action;
  }
  const actionStates=new WeakMap();
  function setActionLayout(root,layout='beside'){
    const values={beside:['row','0px','var(--ui-control-icon,min(18px, calc(var(--ui-control-height) - 2px)))','inline'],icons:['row','48px','26px','none'],above:['column','80px','32px','inline']}[layout];
    if(!values)throw new TypeError('Action layout must be beside, icons or above');
    ['flow','size','icon','caption'].forEach((name,i)=>root.style.setProperty('--ui-action-'+name,values[i]));
    root.dataset.uiActionLayout=layout;for(const row of root.querySelectorAll?.('.ui-header,.ui-menu-panel,.ui-field,.ui-item,.ui-graphic-action')||[])setActionLayout(row,'beside');api.refreshActions?.(root.ownerDocument||root);
    return root;
  }
  function createAdaptiveDensity(root,{container=root}={}){
    const doc=root.ownerDocument,view=doc.defaultView,previous=root.getAttribute('data-ui-density');let disposed=false;
    const refresh=()=>{if(disposed||doc.hidden)return;const width=container.getBoundingClientRect().width;root.dataset.uiDensity=width<360?'dense':width<760?'compact':width>1600?'comfortable':'default';api.refreshActions?.(doc);};
    const observer=new view.ResizeObserver(refresh),visibility=()=>doc.hidden?observer.disconnect():(observer.observe(container),refresh());
    const dispose=()=>{if(disposed)return;disposed=true;observer.disconnect();doc.removeEventListener('visibilitychange',visibility);view.removeEventListener('pagehide',hide);view.removeEventListener('pageshow',visibility);previous===null?root.removeAttribute('data-ui-density'):root.setAttribute('data-ui-density',previous);};
    const hide=event=>event.persisted?observer.disconnect():dispose();doc.addEventListener('visibilitychange',visibility);view.addEventListener('pagehide',hide);view.addEventListener('pageshow',visibility);visibility();return {refresh,dispose};
  }
  function createControlScale(root,{fontSize,scale}={}){
    const doc=root.ownerDocument,view=doc.defaultView,style=root.style,coarse=view.matchMedia('(pointer:coarse)');
    const defaults={'control-height':30,'field-height':30,'tag-height':26,gap:6,'control-inset':8,'control-padding':'4px 8px','field-padding':'4px 8px','range-thumb':12,'range-width':128,'switch-width':36,'switch-height':22,'switch-thumb':16,'switch-inset':2,'control-icon':18};
    const names=[...Object.keys(defaults),'control-size','action-icon'].map(name=>'--ui-'+name);
    const previous=new Map(names.map(name=>[name,[style.getPropertyValue(name),style.getPropertyPriority(name)]]));
    let size,scaleRatio,disposed=false;
    if(fontSize!==undefined&&scale!==undefined)throw new TypeError('Use either fontSize or scale, not both');
    const rawScale=root.getAttribute?.('data-ui-control-scale')??root.closest?.('[data-ui-control-scale]')?.getAttribute('data-ui-control-scale');
    const initialScale=fontSize===undefined&&scale===undefined&&rawScale!=null?Number(rawScale):scale;
    function restore(){for(const [name,[value,priority]]of previous)value?style.setProperty(name,value,priority):style.removeProperty(name);}
    function refresh(){
      if(disposed||doc.hidden)return;
      restore();
      const css=view.getComputedStyle(root),base=parseFloat(css.getPropertyValue('--ui-control-size'))||12;
      const requested=scaleRatio===undefined?size:base*scaleRatio;
      const round=value=>Number(value.toFixed(6));
      const effective=round(coarse.matches?Math.max(16,requested):requested),ratio=effective/base;
      // Read the baseline before writing: computed styles are live; scaling must never compound.
      const values=Object.entries(defaults).map(([name,fallback])=>[name,css.getPropertyValue('--ui-'+name).trim()||(name==='control-icon'&&css.getPropertyValue('--ui-action-icon').trim())||(typeof fallback==='number'?fallback+'px':fallback)]);
      for(const [name,value]of values){
        let scaled=value.replace(/(-?\d*\.?\d+)px\b/g,(_,n)=>round(Number(n)*ratio)+'px');
        if(coarse.matches&&['control-height','field-height','tag-height'].includes(name))scaled=`max(44px, ${scaled})`;
        style.setProperty('--ui-'+name,scaled);
      }
      style.setProperty('--ui-control-size',effective+'px');
      style.setProperty('--ui-action-icon','var(--ui-control-icon)');
      api.refreshActions?.(doc);
    }
    function setFontSize(value){if(typeof value!=='number'||!Number.isFinite(value)||value<=0)throw new TypeError('Control font size must be a positive finite number');size=value;scaleRatio=undefined;refresh();return size;}
    function setScale(value){if(typeof value!=='number'||!Number.isFinite(value)||value<=0)throw new TypeError('Control scale must be a positive finite number');scaleRatio=value;size=undefined;refresh();return scaleRatio;}
    function hide(event){if(!event.persisted)dispose();}
    function dispose(){if(disposed)return;disposed=true;restore();coarse.removeEventListener('change',refresh);doc.removeEventListener('ui:styles',refresh);doc.removeEventListener('visibilitychange',refresh);view.removeEventListener('pageshow',refresh);view.removeEventListener('pagehide',hide);api.refreshActions?.(doc);}
    if(fontSize!==undefined)setFontSize(fontSize);else if(initialScale!==undefined)setScale(initialScale);else setFontSize(12);
    coarse.addEventListener('change',refresh);doc.addEventListener('ui:styles',refresh);doc.addEventListener('visibilitychange',refresh);view.addEventListener('pageshow',refresh);view.addEventListener('pagehide',hide);
    return {setFontSize,setScale,refresh,dispose};
  }
  function adoptAction(element,{icon,label,labelStates,ariaLabel,iconOnly,title,sprite='./shared-ui/icons.svg'}={}){
    if(!element?.matches?.('button,a,summary'))throw new TypeError('A native button, link or summary is required');
    const feedback=actionStates.get(element);if(feedback&&feedback.state!=='idle'&&icon!==undefined){if(!feedback.applying)feedback.icon=icon;icon=feedback.icon||(feedback.state==='success'?'check':feedback.state==='error'?'warning':'refresh');}
    const doc=element.ownerDocument,base=new URL(doc.baseURI),asset=new URL(sprite,base);
    let changed=false;
    const attr=(node,name,value)=>{value=String(value);if(node.getAttribute(name)!==value){node.setAttribute(name,value);changed=true;}};
    const add=(node,name)=>{if(!node.classList.contains(name)){node.classList.add(name);changed=true;}};
    if(asset.origin!==base.origin||asset.protocol!==base.protocol)throw new TypeError('Icons must be served by the app');
    if(icon!==undefined&&!/^[a-z][a-z0-9-]{0,47}$/.test(icon))throw new TypeError('Invalid icon');
    let text=element.querySelector(':scope > .ui-label');
    const name=String(label??element.getAttribute('aria-label')??text?.textContent??element.textContent??element.getAttribute('title')??'').trim();
    if(!name)throw new TypeError('An action needs an accessible label');
    let glyph=element.querySelector(':scope > svg');
    if(!glyph&&icon){glyph=doc.createElementNS('http://www.w3.org/2000/svg','svg');glyph.setAttribute('viewBox','0 0 24 24');glyph.setAttribute('fill','none');glyph.setAttribute('stroke','currentColor');const use=doc.createElementNS('http://www.w3.org/2000/svg','use');attr(use,'href',asset.href+'#ui-'+icon);glyph.append(use);element.prepend(glyph);}
    if(glyph){
      if(icon){let use=glyph.querySelector('use');if(!use){use=doc.createElementNS('http://www.w3.org/2000/svg','use');glyph.replaceChildren(use);}attr(use,'href',asset.href+'#ui-'+icon);}
      attr(glyph,'viewBox','0 0 24 24');attr(glyph,'fill','none');attr(glyph,'stroke','currentColor');add(glyph,'ui-icon');attr(glyph,'aria-hidden','true');attr(glyph,'focusable','false');
    }
    if(!text){changed=true;text=doc.createElement('span');text.className='ui-label';for(const child of [...element.childNodes])if(child!==glyph)text.append(child);element.append(text);}
    if(labelStates)reserveText(text,labelStates);
    if(label!==undefined&&text.textContent!==String(label)){setText(text,label);changed=true;}
    add(element,'ui-action');
    // Decisions keep their words; callers can still explicitly request a symbol.
    if(element.dataset.uiVariant==='primary'&&iconOnly!==true&&!element.dataset.uiLabel){element.dataset.uiLabel='always';changed=true;}
    if(element.matches?.('.ui-item,.ui-graphic-action')||element.closest?.('.ui-header,.ui-menu-panel,.ui-field'))setActionLayout(element,'beside');
    if(ariaLabel!==undefined)attr(element,'aria-label',ariaLabel);else if(!element.hasAttribute('aria-label'))attr(element,'aria-label',name);
    if(title!==undefined)attr(element,'title',title);else if(!element.hasAttribute('title'))attr(element,'title',name);
    if(iconOnly===true&&element.dataset.uiLabel!=='hidden')element.dataset.uiLabel='hidden';else if(iconOnly===false&&element.dataset.uiLabel==='hidden')delete element.dataset.uiLabel;
    if(changed){const group=element.closest?.('details.ui-overflow')?.parentElement?.closest('.ui-actions,.ui-toolbar')||element.closest?.('.ui-actions,.ui-toolbar');if(group)api.observeActions?.(group);}
    return element;
  }
  function setActionState(button,{state='idle',message='',label,sprite='./shared-ui/icons.svg'}={}){
    if(!button?.matches?.('button')||!['idle','pending','success','error'].includes(state))throw new TypeError('A native button and idle/pending/success/error state are required');
    let entry=actionStates.get(button);
    if(!entry){const use=button.querySelector(':scope > svg')?.querySelector('use'),href=use?.getAttribute('href')||'';entry={state:'idle',icon:href.split('#ui-')[1],primary:button.classList.contains('primary'),uiPrimary:button.classList.contains('ui-primary'),variant:button.getAttribute('data-ui-variant'),name:button.getAttribute('aria-label')||button.textContent.trim()};actionStates.set(button,entry);}
    entry.state=state;button.dataset.uiActionState=state;button.setAttribute('aria-busy',String(state==='pending'));
    for(const name of ['ui-success','ui-error','ui-warning'])button.classList.remove(name);
    if(state!=='idle'){button.classList.remove('primary','ui-primary');button.removeAttribute('data-ui-variant');button.classList.add(state==='success'?'ui-success':state==='error'?'ui-error':'ui-warning');}
    else{if(entry.primary)button.classList.add('primary');if(entry.uiPrimary)button.classList.add('ui-primary');if(entry.variant!==null)button.setAttribute('data-ui-variant',entry.variant);}
    entry.applying=true;if(state==='idle'&&!entry.icon)button.querySelector(':scope > svg')?.remove();
    adoptAction(button,{...(entry.icon?{icon:entry.icon}:state==='idle'?{}:{icon:state==='success'?'check':state==='error'?'warning':'refresh'}),...(label===undefined?{}:{label}),ariaLabel:state==='idle'?entry.name:message?entry.name+': '+message:entry.name,title:state==='idle'?entry.name:message||entry.name,sprite});entry.applying=false;
    let live=button.querySelector('[data-ui-feedback]');if(!live){live=button.ownerDocument.createElement('span');live.className='ui-sr-only';live.dataset.uiFeedback='action';live.setAttribute('role','status');live.setAttribute('aria-live','polite');button.append(live);}if(live.textContent!==message)live.textContent=message;return button;
  }
  // Native form readiness without replacing fields or shifting action slots.
  function createSubmitGuard(form,{buttons=[...form.querySelectorAll('[data-ui-submit]')],canSubmit=()=>true}={}) {
    const view=form.ownerDocument.defaultView,initial=buttons.map(button=>button.disabled);let disposed=false;
    function refresh(){
      if(disposed)return false;
      const ready=canSubmit()&&form.getAttribute('aria-busy')!=='true'&&[...form.elements].every(field=>field.disabled||field.validity?.valid!==false);
      buttons.forEach((button,index)=>{button.disabled=initial[index]||!ready;});return ready;
    }
    function submit(event){if(!refresh()){event.preventDefault();event.stopImmediatePropagation();}}
    function reset(){queueMicrotask(refresh);}
    function pagehide(event){if(!event.persisted)dispose();}
    function dispose(){if(disposed)return;disposed=true;form.removeEventListener('input',refresh);form.removeEventListener('change',refresh);form.removeEventListener('reset',reset);form.removeEventListener('submit',submit,true);view.removeEventListener('pagehide',pagehide);buttons.forEach((button,index)=>{button.disabled=initial[index];});}
    form.addEventListener('input',refresh);form.addEventListener('change',refresh);form.addEventListener('reset',reset);form.addEventListener('submit',submit,true);view.addEventListener('pagehide',pagehide);refresh();return {refresh,dispose};
  }
  async function runAction(button,operation,{pending='Working…',success='Done',successState='success',sprite}={}){if(!['idle','success'].includes(successState))throw new TypeError('Unknown success state');setActionState(button,{state:'pending',message:pending,sprite});try{const result=await operation();setActionState(button,{state:successState,message:success,sprite});return result;}catch(error){setActionState(button,{state:'error',message:error.message||'Action failed',sprite});throw error;}}
  const cardColorCache=new Map();
  function resolveCardColor(color){
    if(color==='#ffffff')return Object.freeze({light:'var(--ui-surface)',dark:'var(--ui-surface)',lightInk:'var(--ui-text)',darkInk:'var(--ui-text)'});
    if(color==='transparent')return Object.freeze({light:'transparent',dark:'transparent',lightInk:'#000000',darkInk:'#ffffff'});
    if(typeof color!=='string'||!/^#[0-9a-f]{6}$/i.test(color))throw new TypeError('A six-digit card color or transparent is required');
    color=color.toLowerCase();if(cardColorCache.has(color))return cardColorCache.get(color);
    const light=color==='#ff3b30'?'#c44c53':color==='#ffff00'?'#f3d376':color;
    const channels=[1,3,5].map(i=>parseInt(light.slice(i,i+2),16));
    const hex=values=>'#'+values.map(value=>value.toString(16).padStart(2,'0')).join('');
    const dark=Math.max(...channels)-Math.min(...channels)<18&&channels[0]>230?'#24262b':light;
    const ink=fill=>{const rgb=[1,3,5].map(i=>parseInt(fill.slice(i,i+2),16)/255).map(c=>c<=.04045?c/12.92:((c+.055)/1.055)**2.4);return rgb[0]*.2126+rgb[1]*.7152+rgb[2]*.0722>.179?'#000000':'#ffffff';};
    const result=Object.freeze({light,dark,lightInk:ink(light),darkInk:ink(dark)});
    if(cardColorCache.size>=128)cardColorCache.delete(cardColorCache.keys().next().value);cardColorCache.set(color,result);return result;
  }
  function setCardColor(card,color){
    if(color==null){delete card.dataset.uiColor;card.style.removeProperty('--ui-card-fill');card.style.removeProperty('--ui-card-ink');return;}
    const value=resolveCardColor(color);card.dataset.uiColor=color.toLowerCase();
    if(color==='transparent'||color.toLowerCase()==='#ffffff'){card.style.removeProperty('--ui-card-fill');card.style.removeProperty('--ui-card-ink');return;}
    card.style.setProperty('--ui-card-fill',`light-dark(${value.light},${value.dark})`);
    card.style.setProperty('--ui-card-ink',`light-dark(${value.lightInk},${value.darkInk})`);
  }
  // Canvas/SVG output needs resolved CSS colours, never var() or light-dark() strings.
  // One hidden native card per renderer; only distinct colours require style resolution.
  function createCardColorResolver(root){
    const doc=root.ownerDocument,view=doc.defaultView,probe=doc.createElement('article'),cache=new Map();
    const scheme=view.matchMedia('(prefers-color-scheme: dark)');
    let theme,disposed=false;
    probe.className='ui-card';probe.hidden=true;probe.setAttribute('aria-hidden','true');root.append(probe);
    function resolve(color=null){
      if(disposed)throw new Error('Card colour resolver is disposed');
      const key=[root.dataset.ui,root.dataset.theme,root.dataset.uiRevision,scheme.matches].join('/');
      if(key!==theme){cache.clear();theme=key;}
      if(cache.has(color))return cache.get(color);
      setCardColor(probe,color);
      const css=view.getComputedStyle(probe),paint=Object.freeze({fill:css.backgroundColor,ink:css.color,line:css.borderTopColor,font:css.fontFamily});
      if(cache.size>=128)cache.delete(cache.keys().next().value);cache.set(color,paint);return paint;
    }
    return {resolve,invalidate(){theme=undefined;cache.clear();},dispose(){if(disposed)return;disposed=true;cache.clear();probe.remove();}};
  }
  function setSelection(element,selected) {
    element.classList.add('ui-selectable');
    element.dataset.uiSelected=selected==='mixed'?'mixed':String(Boolean(selected));
  }
  function setSortDirection(element,direction,options={}) {
    if(!['asc','desc'].includes(direction))throw new TypeError('Sort direction must be asc or desc');
    const label=direction==='asc'?'Ascending':'Descending';
    element.dataset.uiDirection=direction;
    return adoptAction(element,{...options,icon:direction==='asc'?'arrow-up':'arrow-down',label,ariaLabel:`${label}; reverse sort direction`,title:`${label}; reverse sort direction`,iconOnly:true});
  }
  function setAppColor(element,color) {
    if(color==null||color===''){element.style.removeProperty('--ui-app-color');return;}
    if(!/^#[0-9a-f]{6}$/i.test(color))throw new TypeError('A six-digit icon color is required');
    element.style.setProperty('--ui-app-color',color);
  }
  function createBackToTop(button,{scrollTarget,focusTarget,threshold=240,sprite='./shared-ui/icons.svg'}={}) {
    const doc=button.ownerDocument,view=doc.defaultView,target=scrollTarget||view;
    let disposed=false,listening=false;
    adoptAction(button,{icon:'arrow-up',label:'Back to top',sprite});button.classList.add('ui-back-to-top');
    function update(){button.hidden=doc.visibilityState==='hidden'||(target===view?view.scrollY:target.scrollTop)<threshold;}
    function listen(){if(disposed||listening||doc.visibilityState==='hidden')return;target.addEventListener('scroll',update,{passive:true});listening=true;update();}
    function pause(){target.removeEventListener('scroll',update);listening=false;}
    function visibility(){if(doc.visibilityState==='hidden')pause();else listen();update();}
    function scrollToStart(){
      const focus=typeof focusTarget==='function'?focusTarget():focusTarget;
      if(focus){if(!focus.matches('a,button,input,select,textarea,[tabindex]'))focus.tabIndex=-1;focus.focus({preventScroll:true});}
      target.scrollTo({top:0,behavior:view.matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth'});
    }
    button.addEventListener('click',scrollToStart);doc.addEventListener('visibilitychange',visibility);view.addEventListener('pagehide',pause);view.addEventListener('pageshow',listen);listen();
    return {update,dispose(){if(disposed)return;disposed=true;pause();button.removeEventListener('click',scrollToStart);doc.removeEventListener('visibilitychange',visibility);view.removeEventListener('pagehide',pause);view.removeEventListener('pageshow',listen);}};
  }
  // Shared native-editor/IME guards based on StaticRef PR33; apps own zoom geometry.
  function installZoomShortcuts(doc,{canZoom=()=>true,onZoom}={}){
    if(typeof onZoom!=='function')throw new TypeError('Zoom requires an app callback');
    let composing=false,disposed=false;
    const editor=node=>Boolean(node?.isContentEditable||node?.closest?.('input,textarea,select,[contenteditable],[role="textbox"],[role="searchbox"],[role="combobox"]'));
    const start=()=>{composing=true;},finish=()=>{composing=false;};
    const press=event=>{
      if(disposed||!event.metaKey||event.ctrlKey||event.altKey||event.defaultPrevented||event.isComposing||event.keyCode===229||composing||event.getModifierState?.('AltGraph')||editor(event.target)||editor(doc.activeElement)||event.composedPath?.().some(editor))return;
      const direction=['ArrowUp','ArrowRight','+','='].includes(event.key)||['Equal','NumpadAdd'].includes(event.code)?1:['ArrowDown','ArrowLeft','-','_'].includes(event.key)||['Minus','NumpadSubtract'].includes(event.code)?-1:0;
      if(!direction||!canZoom())return;
      event.preventDefault();onZoom(direction);
    };
    function dispose(){if(disposed)return;disposed=true;doc.removeEventListener('keydown',press,true);doc.removeEventListener('compositionstart',start,true);doc.removeEventListener('compositionend',finish,true);doc.defaultView?.removeEventListener('blur',finish);doc.defaultView?.removeEventListener('pagehide',dispose);}
    doc.addEventListener('compositionstart',start,true);doc.addEventListener('compositionend',finish,true);doc.addEventListener('keydown',press,true);doc.defaultView?.addEventListener('blur',finish);doc.defaultView?.addEventListener('pagehide',dispose);
    return {dispose};
  }
  function createValueTransition({value,onChange,duration=110,view=globalThis.window}={}){
    if(!Number.isFinite(value)||!Number.isFinite(duration)||duration<=0||typeof onChange!=='function')throw new TypeError('A finite value and frame callback are required');
    let current=value,target=value,frame=null,start=null,from=value,disposed=false;
    function cancel(){if(frame!==null)view.cancelAnimationFrame(frame);frame=null;start=null;target=current;}
    function tick(now){if(disposed)return;if(start===null)start=now;const progress=Math.min(1,(now-start)/duration),ease=1-(1-progress)**3;current=progress===1?target:from+(target-from)*ease;onChange(current,{final:progress===1});if(progress<1)frame=view.requestAnimationFrame(tick);else{frame=null;start=null;}}
    function to(next,{animate=true}={}){if(!Number.isFinite(next))throw new TypeError('A finite target is required');if(disposed)return;cancel();from=current;target=next;if(!animate||!view?.requestAnimationFrame||view.matchMedia?.('(prefers-reduced-motion:reduce)').matches){current=target;onChange(current,{final:true});return;}frame=view.requestAnimationFrame(tick);}
    const hide=()=>{if(view.document?.hidden&&frame!==null){const next=target;cancel();current=target=next;onChange(current,{final:true});}};
    function dispose(){cancel();disposed=true;view?.document?.removeEventListener('visibilitychange',hide);view?.removeEventListener('pagehide',dispose);}
    view?.document?.addEventListener('visibilitychange',hide);view?.addEventListener('pagehide',dispose);
    return {get value(){return current;},get target(){return target;},get active(){return frame!==null;},to,cancel,dispose};
  }
  function createZoomSteps({now=()=>performance.now(),interval=240}={}){
    let last=-Infinity,previous=0,burst=0;
    return {next(direction){if(!direction){last=-Infinity;previous=burst=0;return 1;}const time=now();burst=direction===previous&&time-last<=interval?Math.min(2,burst+1):0;last=time;previous=direction;const factor=1+[.1,.15,.2][burst];return direction>0?factor:1/factor;}};
  }
  const zoomDocks=new WeakMap();
  // Size only: application content and placement retain their existing owners.
  function createResizablePanel(panel,{container=panel.parentElement,side='right',min=240,max=640,minMain=280,value=352,property='--ui-aside',onChange=()=>{}}={}){
    if(!['left','right'].includes(side)||!/^--ui-[a-z-]+$/.test(property)||![min,max,minMain,value].every(Number.isFinite)||min<=0||max<min||minMain<0)throw new TypeError('Panel resize needs bounded dimensions and a shared sizing property');
    const doc=panel.ownerDocument,view=doc.defaultView,handle=doc.createElement('div'),off=[];
    const previous=container.style.getPropertyValue(property),previousLayout=container.getAttribute('data-ui-resize-layout');let size=value,preferred=value,drag=null,disposed=false;
    handle.className='ui-panel-resize';handle.tabIndex=0;handle.setAttribute('role','separator');handle.setAttribute('aria-orientation','vertical');handle.setAttribute('aria-label','Resize panel');
    Object.assign(handle.style,{position:'absolute',top:'0',bottom:'0',[side==='right'?'left':'right']:'-6px',width:'13px',padding:'0 6px',zIndex:'25',touchAction:'none',cursor:'col-resize'});container.append(handle);
    const bounds=()=>{const style=view.getComputedStyle?.(container),width=container.getBoundingClientRect().width-(parseFloat(style?.paddingLeft)||0)-(parseFloat(style?.paddingRight)||0);return {upper:Math.max(min,Math.min(max,width-minMain)),enabled:width>=min+minMain};};
    const set=(next,final=false,remember=true)=>{const b=bounds();if(remember)preferred=Math.max(min,Math.min(max,next));size=Math.round(Math.max(min,Math.min(b.upper,next)));container.setAttribute('data-ui-resize-layout',b.enabled?'side':'stack');container.style.setProperty(property,size+'px');handle.hidden=!b.enabled||panel.hidden;const area=container.getBoundingClientRect(),rect=panel.getBoundingClientRect();handle.style.top=Math.max(0,(rect.top||0)-(area.top||0))+'px';handle.style.bottom=Math.max(0,(area.bottom||0)-(rect.bottom||0))+'px';handle.style.left=((side==='right'?rect.left:rect.right)-(area.left||0)-6)+'px';for(const [key,n]of Object.entries({'aria-valuemin':min,'aria-valuemax':b.upper,'aria-valuenow':size}))handle.setAttribute(key,String(n));onChange(size,{final});};
    const listen=(node,type,fn)=>{node.addEventListener(type,fn);off.push(()=>node.removeEventListener(type,fn));};
    function finish(cancel=false){if(!drag)return;const start=drag;drag=null;if(cancel)set(start.width,true);else set(size,true);if(handle.hasPointerCapture?.(start.id))handle.releasePointerCapture(start.id);}
    listen(handle,'pointerdown',event=>{if(event.button!==0||event.isPrimary===false||!bounds().enabled)return;event.preventDefault();event.stopPropagation();drag={id:event.pointerId,x:event.clientX,width:size};handle.setPointerCapture(event.pointerId);handle.focus({preventScroll:true});});
    listen(handle,'pointermove',event=>{if(!drag||event.pointerId!==drag.id)return;event.preventDefault();set(drag.width+(event.clientX-drag.x)*(side==='right'?-1:1));});
    listen(handle,'pointerup',()=>finish());listen(handle,'pointercancel',()=>finish(true));listen(handle,'lostpointercapture',()=>finish(true));
    listen(handle,'keydown',event=>{if(event.key==='Escape'){finish(true);return;}if(!['ArrowLeft','ArrowRight','Home','End'].includes(event.key))return;event.preventDefault();const next=event.key==='Home'?min:event.key==='End'?bounds().upper:size+(event.key==='ArrowRight'?1:-1)*(side==='right'?-1:1)*(event.shiftKey?40:10);set(next,true);});
    listen(doc,'visibilitychange',()=>{if(doc.hidden)finish(true);});listen(view,'blur',()=>finish(true));
    const refresh=()=>{if(!disposed&&!drag)set(preferred,false,false);};const observer=view.ResizeObserver?new view.ResizeObserver(refresh):null;observer?.observe(container);observer?.observe(panel);listen(view,'resize',refresh);
    const api={element:handle,get value(){return size;},setValue:next=>set(next,true),refresh,dispose(){if(disposed)return;finish(true);disposed=true;observer?.disconnect();for(const remove of off)remove();handle.remove();previous?container.style.setProperty(property,previous):container.style.removeProperty(property);previousLayout===null?container.removeAttribute('data-ui-resize-layout'):container.setAttribute('data-ui-resize-layout',previousLayout);}};
    listen(view,'pagehide',api.dispose);set(value);return api;
  }
  // Authored native popover content; apps retain requests, drafts and persistence.
  function createAnchoredPopover(trigger,{element,onClose=()=>{},bindTrigger=true}={}){
    if(!element||trigger.ownerDocument!==element.ownerDocument||typeof element.showPopover!=='function')throw new TypeError('Use native popover content and a trigger in one document');
    const doc=trigger.ownerDocument,view=doc.defaultView,off=[],original={parent:element.parentNode,next:element.nextSibling,style:element.getAttribute('style'),popover:element.getAttribute('popover')};let anchor=trigger,anchorAttrs,disposed=false,shown=false,pressedOpen=false;
    const attrs=['aria-haspopup','aria-controls','aria-expanded'],savedId=element.getAttribute('id');if(!element.id)element.id='ui-popover-'+view.crypto.randomUUID();element.popover='auto';
    Object.assign(element.style,{position:'fixed',inset:'auto',margin:'0',blockSize:'fit-content',minBlockSize:'0',maxInlineSize:'calc(100vw - 24px)',maxBlockSize:'min(var(--ui-popout-height,760px),calc(100dvh - 24px))'});
    const listen=(node,type,fn,options)=>{node.addEventListener(type,fn,options);off.push(()=>node.removeEventListener(type,fn,options));};
    function attach(next){anchor=next;anchorAttrs=attrs.map(name=>anchor.getAttribute(name));anchor.setAttribute('aria-haspopup','dialog');anchor.setAttribute('aria-controls',element.id);anchor.setAttribute('aria-expanded',String(shown));anchor.addEventListener('pointerdown',pointer);if(bindTrigger)anchor.addEventListener('click',toggle);}
    function detach(){anchor.removeEventListener('pointerdown',pointer);anchor.removeEventListener('click',toggle);attrs.forEach((name,i)=>anchorAttrs[i]===null?anchor.removeAttribute(name):anchor.setAttribute(name,anchorAttrs[i]));}
    function refresh(){if(disposed||!element.matches(':popover-open'))return;const r=anchor.getBoundingClientRect(),safe=Math.max(12,parseFloat(view.getComputedStyle(element).getPropertyValue('--ui-safe-inset'))||0),below=view.innerHeight-r.bottom-safe-6,above=r.top-safe-6;Object.assign(element.style,{maxInlineSize:Math.max(0,view.innerWidth-2*safe)+'px',maxBlockSize:'min(var(--ui-popout-height,760px),'+Math.max(0,Math.max(below,above))+'px)'});const p=element.getBoundingClientRect(),top=below>=p.height||below>=above?r.bottom+6:r.top-p.height-6;element.style.left=Math.max(safe,Math.min(r.left,view.innerWidth-p.width-safe))+'px';element.style.top=Math.max(safe,Math.min(top,view.innerHeight-p.height-safe))+'px';}
    function closed(){if(!shown)return;shown=false;anchor.setAttribute('aria-expanded','false');onClose();if(anchor.isConnected&&(element.contains(doc.activeElement)||doc.activeElement===doc.body))anchor.focus({preventScroll:true});}
    function close(){panelAnimations.get(element)?.cancel();if(element.matches(':popover-open'))element.hidePopover();closed();}
    function open(){if(disposed||anchor.disabled)return;const owner=anchor.closest('dialog')||doc.body;if(element.parentNode!==owner)owner.append(element);element.showPopover();shown=true;anchor.setAttribute('aria-expanded','true');refresh();animatePanel(element);}
    function pointer(){pressedOpen=element.matches(':popover-open');}
    function toggle(){if(pressedOpen||element.matches(':popover-open'))close();else open();pressedOpen=false;}
    listen(element,'toggle',event=>{if(event.newState==='closed')closed();else refresh();});
    listen(element,'keydown',event=>{event.stopPropagation();if(event.key==='Escape'&&!event.isComposing){event.preventDefault();close();anchor.focus({preventScroll:true});}});
    listen(view,'resize',refresh);listen(doc,'scroll',event=>{if(!element.contains(event.target))refresh();},true);listen(doc,'visibilitychange',()=>{if(doc.hidden)close();});
    const observer=view.ResizeObserver?new view.ResizeObserver(refresh):null;observer?.observe(element);attach(anchor);
    const control={element,open,close,toggle,refresh,setTrigger(next){if(next.ownerDocument!==doc)throw new TypeError('Popover trigger must share its document');detach();attach(next);if(shown){const owner=anchor.closest('dialog')||doc.body;if(element.parentNode!==owner)owner.append(element);refresh();}},dispose(){if(disposed)return;close();disposed=true;observer?.disconnect();detach();for(const remove of off)remove();original.style===null?element.removeAttribute('style'):element.setAttribute('style',original.style);original.popover===null?element.removeAttribute('popover'):element.setAttribute('popover',original.popover);if(savedId===null)element.removeAttribute('id');if(original.parent)original.parent.insertBefore(element,original.next?.parentNode===original.parent?original.next:null);else element.remove();}};
    listen(view,'pagehide',event=>{if(!event.persisted)control.dispose();});return control;
  }
  // One live native search field, with explicit form ownership while outside it.
  function createResponsiveSlot(node,{primary,fallback,minWidth=240}={}){
    if(!primary||!fallback||node.ownerDocument!==primary.ownerDocument||node.ownerDocument!==fallback.ownerDocument||!Number.isFinite(minWidth)||minWidth<0)throw new TypeError('A responsive slot needs two native hosts in one document');
    const doc=node.ownerDocument,view=doc.defaultView,original={parent:node.parentNode,next:node.nextSibling,slot:node.getAttribute('data-ui-slot'),fallbackHidden:fallback.hidden},fields=[...(node.matches('input,select,textarea,button')?[node]:[]),...node.querySelectorAll('input,select,textarea,button')],forms=fields.map(field=>({field,value:field.getAttribute('form'),owner:field.form})),off=[];let composing=false,disposed=false;
    for(const {field,owner}of forms)if(owner?.id)field.setAttribute('form',owner.id);
    function refresh(){if(disposed||composing)return;const host=primary.getBoundingClientRect().width>=minWidth?primary:fallback;fallback.hidden=host!==fallback;node.setAttribute('data-ui-slot',host===primary?'primary':'fallback');if(node.parentNode===host)return;const active=node.contains(doc.activeElement)?doc.activeElement:null;if(active&&host===fallback){for(let parent=fallback;parent;parent=parent.parentElement)if(parent.matches('details'))parent.open=true;}const selection=active&&typeof active.selectionStart==='number'?[active.selectionStart,active.selectionEnd,active.selectionDirection]:null;if(host.moveBefore&&node.isConnected)host.moveBefore(node,null);else{host.append(node);if(active){active.focus({preventScroll:true});if(selection)active.setSelectionRange(...selection);}}}
    const listen=(target,type,fn)=>{target.addEventListener(type,fn);off.push(()=>target.removeEventListener(type,fn));};listen(node,'compositionstart',()=>{composing=true;});listen(node,'compositionend',()=>{composing=false;refresh();});listen(view,'resize',refresh);
    const observer=view.ResizeObserver?new view.ResizeObserver(refresh):null;observer?.observe(primary);
    const control={refresh,dispose(){if(disposed)return;disposed=true;observer?.disconnect();for(const remove of off)remove();if(original.parent)original.parent.insertBefore(node,original.next?.parentNode===original.parent?original.next:null);fallback.hidden=original.fallbackHidden;for(const {field,value}of forms)value===null?field.removeAttribute('form'):field.setAttribute('form',value);original.slot===null?node.removeAttribute('data-ui-slot'):node.setAttribute('data-ui-slot',original.slot);}};listen(view,'pagehide',event=>{if(!event.persisted)control.dispose();});refresh();return control;
  }
  const panelAnimations=new Map();
  function animatePanel(element,{translate=true}={}){const view=element.ownerDocument.defaultView;panelAnimations.get(element)?.cancel();if(element.ownerDocument.hidden||view.matchMedia?.('(prefers-reduced-motion:reduce)').matches||typeof element.animate!=='function')return;const animation=element.animate(translate?[{opacity:.92,transform:'translateY(2px)'},{opacity:1,transform:'translateY(0)'}]:[{opacity:.92},{opacity:1}],{duration:90,easing:'ease-out'});panelAnimations.set(element,animation);animation.onfinish=animation.oncancel=()=>{if(panelAnimations.get(element)===animation)panelAnimations.delete(element);};return animation;}

  // Declared native review slots; domains retain commands, values and persistence.
  function createReviewControls(root,{rating=root.querySelector('[data-ui-review-slot=rating]'),actions=root.querySelector('[data-ui-review-slot=actions]'),tags=root.querySelector('[data-ui-review-slot=tags]'),navigation=null,layout='stacked',iconOnly=false,sprite='./shared-ui/icons.svg'}={}){
    if(!['stacked','bar','rows'].includes(layout))throw new TypeError('Unknown review control layout');
    const slots=[rating,actions,tags,navigation].filter(Boolean);
    if(!actions||new Set(slots).size!==slots.length||slots.some(node=>!root.contains(node)))throw new TypeError('Review controls require unique native slots inside their root');
    const attributes=['style','class','data-ui-layout','data-ui-align'],records=[root,...slots].map(node=>({node,values:attributes.map(name=>node.getAttribute(name))}));let disposed=false;
    let commandRow=null;const placements=[];
    root.classList.add('ui-review-controls');
    if(navigation&&layout!=='stacked')navigation.classList.remove('ui-fill');
    Object.assign(root.style,{display:'grid',gridTemplateColumns:'minmax(0,1fr)',justifyItems:'center',gap:'calc(2 * var(--ui-gap))',inlineSize:'100%',maxInlineSize:'52rem',minInlineSize:'0',marginInline:'auto',paddingBlock:'var(--ui-gap) calc(2 * var(--ui-gap))'});
    for(const row of [rating,actions].filter(Boolean)){
      row.classList.add('ui-actions','ui-inline');row.dataset.uiLayout='bar';row.dataset.uiAlign='center';
      Object.assign(row.style,{inlineSize:'max-content',maxInlineSize:'100%',minInlineSize:'0',margin:'0'});
    }
    if(tags)Object.assign(tags.style,{inlineSize:'100%',maxInlineSize:'42rem',minInlineSize:'0',margin:'0'});
    if(layout==='bar'){
      Object.assign(root.style,{display:'flex',flexWrap:'wrap',alignItems:'center',justifyContent:'center',maxInlineSize:'var(--ui-dock-width,64rem)',paddingBlock:'0'});
      if(rating)rating.style.flex='0 0 auto';actions.dataset.uiLayout='wrap';Object.assign(actions.style,{flex:'0 1 auto',flexWrap:'wrap',overflow:'visible'});
      if(tags)Object.assign(tags.style,{flex:'1 1 20rem',inlineSize:'auto',minInlineSize:'min(100%,16rem)',maxInlineSize:'32rem'});
      if(navigation){navigation.classList.add('ui-actions','ui-inline');navigation.dataset.uiLayout='wrap';Object.assign(navigation.style,{flex:'0 0 auto',inlineSize:'max-content',maxInlineSize:'100%',margin:'0'});}
    }
    if(layout==='rows'){
      const doc=root.ownerDocument,dock=root.parentElement?.matches('.ui-review-dock')?root.parentElement:null;if(dock){records.push({node:dock,values:attributes.map(name=>dock.getAttribute(name))});Object.assign(dock.style,{inlineSize:'100%',maxInlineSize:'100%',maxHeight:'none',overflow:'visible'});}commandRow=doc.createElement('div');commandRow.className='ui-actions';commandRow.dataset.uiAlign='center';commandRow.setAttribute('aria-label','Review commands');
      Object.assign(root.style,{inlineSize:'clamp(min(100%,40rem),var(--ui-dock-width,70%),100%)',maxInlineSize:'min(100%,var(--ui-dock-max-width,64rem))',gap:'var(--ui-gap)',paddingBlock:'0'});
      Object.assign(commandRow.style,{justifyContent:'center',alignItems:'center',minInlineSize:'0',maxInlineSize:'100%'});
      for(const slot of [rating,actions,navigation].filter(Boolean)){placements.push({node:slot,parent:slot.parentNode,next:slot.nextSibling});commandRow.append(slot);slot.classList.add('ui-actions','ui-inline');slot.dataset.uiLayout='wrap';Object.assign(slot.style,{flex:'0 1 auto',flexWrap:'wrap',maxInlineSize:'100%',minInlineSize:'0'});}
      if(tags){placements.push({node:tags,parent:tags.parentNode,next:tags.nextSibling});root.prepend(tags);Object.assign(tags.style,{inlineSize:'100%',maxInlineSize:'100%'});}root.append(commandRow);
    }
    function adopt(action,compact=iconOnly){api.adoptAction(action,{sprite,...(action.dataset.uiIcon?{icon:action.dataset.uiIcon}:{}),...(compact?{iconOnly:true}:{})});}
    function refresh(){if(disposed)return;if(commandRow)api.observeActions?.(commandRow);for(const action of actions.querySelectorAll('button,a,summary')){if(layout==='rows'&&!iconOnly)api.adoptAction(action,{sprite,...(action.dataset.uiIcon?{icon:action.dataset.uiIcon}:{}),iconOnly:false});else adopt(action);}api.observeActions?.(actions);if(rating){for(const action of rating.querySelectorAll('button,a,summary'))adopt(action,false);api.observeActions?.(rating);}if(navigation){for(const action of navigation.querySelectorAll('button,a,summary')){if(layout==='rows'&&!iconOnly)api.adoptAction(action,{sprite,...(action.dataset.uiIcon?{icon:action.dataset.uiIcon}:{}),iconOnly:false});else adopt(action);}api.observeActions?.(navigation);}}
    refresh();return {element:root,slots:{rating,actions,tags,navigation},refresh,addAction(action){if(disposed)throw new Error('Review controls disposed');adopt(action);actions.append(action);refresh();return action;},dispose(){if(disposed)return;disposed=true;api.releaseActions?.(root);for(const {node,parent,next}of placements.slice().reverse())parent.insertBefore(node,next?.parentNode===parent?next:null);commandRow?.remove();for(const {node,values}of records)attributes.forEach((name,index)=>values[index]===null?node.removeAttribute(name):node.setAttribute(name,values[index]));}};
  }
  // A container owns the coordinate space; the existing native controls stay intact.
  function createContextToolbar(toolbar,{container=toolbar.ownerDocument.body,zoom=null,status=null}={}){
    const doc=toolbar.ownerDocument,view=doc.defaultView,host=doc.createElement('div');
    const original={parent:toolbar.parentNode,next:toolbar.nextSibling,style:toolbar.getAttribute('style')};
    const previousStatus=status&&{parent:status.parentNode,next:status.nextSibling,style:status.getAttribute('style')};
    const previousZoom=zoom&&{parent:zoom.parentNode,next:zoom.nextSibling,style:zoom.getAttribute('style')};
    host.className='ui-context-dock';host.dataset.uiPosition=container===doc.body?'viewport':'container';
    host.style.cssText='position:'+ (container===doc.body?'fixed':'absolute')+';inset:auto max(var(--ui-safe-inset,16px), env(safe-area-inset-right)) max(var(--ui-safe-inset,24px), env(safe-area-inset-bottom)) max(var(--ui-safe-inset,16px), env(safe-area-inset-left));display:grid;grid-template-columns:minmax(0,1fr) auto minmax(0,1fr);align-items:end;gap:6px;z-index:130;pointer-events:none';
    // Floating context overflow uses an anchored native menu, never an in-flow disclosure.
    const menus=[...toolbar.querySelectorAll?.('details.ui-overflow')||[]].map(node=>{const body=node.querySelector(':scope > .ui-actions'),saved={node,body,classes:node.getAttribute('class'),bodyClasses:body?.getAttribute('class'),bodyStyle:body?.getAttribute('style'),layout:body?.getAttribute('data-ui-layout'),mode:node.getAttribute('data-ui-overflow'),open:node.open};node.classList.remove('ui-overflow','ui-disclosure');node.classList.add('ui-menu');node.removeAttribute('data-ui-overflow');node.open=false;if(body){body.classList.remove('ui-inline','ui-disclosure-body');body.classList.add('ui-menu-panel');body.dataset.uiLayout='vertical';view.SharedUI?.observeActions?.(body);}saved.click=event=>{const action=event.target.closest?.('button,a');if(action&&!action.hasAttribute('aria-pressed'))node.open=false;};node.addEventListener('click',saved.click);return saved;});
    toolbar.classList.add('ui-toolbar','ui-actions','ui-inline');toolbar.dataset.uiLayout='bar';
    Object.assign(toolbar.style,{position:'static',inset:'auto',translate:'none',gridColumn:'2',minWidth:'0',width:'max-content',justifySelf:'center',margin:'0',pointerEvents:'auto',overflow:'visible',zIndex:'1'});
    host.append(toolbar);if(zoom){Object.assign(zoom.style,{position:'static',inset:'auto',translate:'none',width:'max-content',maxWidth:'none',gridColumn:'3',justifySelf:'end',margin:'0',pointerEvents:'auto'});host.append(zoom);}
    if(status){const box=doc.createElement('div');box.className='ui-toolbar ui-inline';box.dataset.uiContextStatus='';Object.assign(box.style,{gridColumn:'1 / -1',gridRow:'1',justifySelf:'center',whiteSpace:'nowrap',maxWidth:'100%',pointerEvents:'auto'});box.append(status);host.append(box);}
    container.append(host);
    let disposed=false,zoomWidth=0;
    const refresh=()=>{
      if(disposed||doc.hidden)return;
      // Overlay-driven visibility must not donate the zoom slot to captions.
      if(zoom&&!zoom.hidden)zoomWidth=zoom.getBoundingClientRect().width||zoomWidth;
      const width=host.getBoundingClientRect().width,side=zoom?zoomWidth+6:0;
      const stacked=side>0&&width-2*side<Math.min(240,toolbar.scrollWidth||240);
      const row=status&&!status.hidden&&!toolbar.hidden?2:1;
      if(status)status.parentNode.hidden=toolbar.hidden||status.hidden;
      toolbar.style.gridColumn=stacked?'1 / -1':'2';toolbar.style.gridRow=String(row+(stacked?1:0));
      toolbar.style.maxWidth=Math.max(0,Math.min(1200,stacked?width:width-2*side))+'px';
      if(zoom){zoom.style.maxWidth=width+'px';zoom.style.gridColumn=stacked?'1 / -1':'3';zoom.style.gridRow=String(row);zoom.style.justifySelf=stacked?'center':'end';}
      view.SharedUI?.observeActions?.(toolbar);
    };
    const observer=view.ResizeObserver?new view.ResizeObserver(refresh):null;
    observer?.observe(container);observer?.observe(host);observer?.observe(toolbar);if(zoom)observer?.observe(zoom);
    view.addEventListener('resize',refresh);doc.addEventListener('visibilitychange',refresh);
    const restore=(node,record)=>{if(!node||!record)return;record.style===null?node.removeAttribute('style'):node.setAttribute('style',record.style);if(record.parent)record.parent.insertBefore(node,record.next?.parentNode===record.parent?record.next:null);else node.remove();};
    const api={element:host,refresh,dispose(){if(disposed)return;disposed=true;observer?.disconnect();view.removeEventListener('resize',refresh);doc.removeEventListener('visibilitychange',refresh);view.removeEventListener('pagehide',pagehide);view.removeEventListener('pageshow',refresh);for(const m of menus){m.node.removeEventListener('click',m.click);m.node.setAttribute('class',m.classes);if(m.body){m.body.setAttribute('class',m.bodyClasses);m.bodyStyle===null?m.body.removeAttribute('style'):m.body.setAttribute('style',m.bodyStyle);m.layout===null?m.body.removeAttribute('data-ui-layout'):m.body.setAttribute('data-ui-layout',m.layout);}m.mode===null?m.node.removeAttribute('data-ui-overflow'):m.node.setAttribute('data-ui-overflow',m.mode);m.node.open=m.open;}restore(toolbar,original);restore(zoom,previousZoom);restore(status,previousStatus);host.remove();}};
    function pagehide(event){if(!event.persisted)api.dispose();}
    view.addEventListener('pagehide',pagehide);view.addEventListener('pageshow',refresh);refresh();return api;
  }
  function blocksViewportTools(overlay){
    return overlay.getClientRects().length>0&&!overlay.closest('[hidden],details:not([open]) > :not(summary)')&&!overlay.matches('details.ui-overflow[data-ui-overflow=expanded]');
  }
  function createZoomFeedback(doc,{sprite='./shared-ui/icons.svg'}={}){
    if(zoomDocks.has(doc))return zoomDocks.get(doc);
    const view=doc.defaultView,node=doc.createElement('div');node.className='ui-zoom-feedback ui-toolbar ui-actions ui-inline';node.setAttribute('role','group');node.setAttribute('aria-label','Content zoom');
    let visible=true,lastValue=null,activityTimer=0,disposed=false;
    function rest(){view.clearTimeout(activityTimer);activityTimer=0;delete node.dataset.uiZoomActive;node.style.setProperty('--ui-idle-opacity','0');}
    function active(){if(disposed||doc.hidden||node.hidden)return;rest();node.dataset.uiZoomActive='';node.style.setProperty('--ui-idle-opacity','1');activityTimer=view.setTimeout(rest,1200);}
    const buttons=[];
    for(const [direction,icon,label] of [[-1,'minus','Zoom out'],[0,'maximize','Reset zoom'],[1,'plus','Zoom in']]){
      const button=doc.createElement('button');button.type='button';button.dataset.uiZoom=direction<0?'out':direction>0?'in':'value';
      adoptAction(button,{...(direction?{icon}:{}),label:direction?label:'100%',ariaLabel:label,labelStates:direction?undefined:['10%','100%','300%','800%'],iconOnly:direction!==0,sprite});
      if(direction===0){button.dataset.uiLabel='always';button.setAttribute('aria-live','polite');setText(button.querySelector('.ui-label'),'100%');}
      button.addEventListener('click',()=>{active();doc.dispatchEvent(new view.CustomEvent('ui:zoom',{detail:{direction}}));});buttons.push(button);node.append(button);
    }
    doc.body.append(node);
    const sync=()=>{node.hidden=doc.hidden||!visible||[...doc.querySelectorAll('dialog[open],details.ui-menu[open],details.ui-disclosure[open],[popover]:popover-open')].some(blocksViewportTools);if(node.hidden)rest();};
    doc.addEventListener('toggle',sync,true);doc.addEventListener('close',sync,true);doc.addEventListener('visibilitychange',sync);
    const api={element:node,show(value,{min=0,max=Infinity}={}){if(disposed||!Number.isFinite(value))return;if(lastValue!==null&&value!==lastValue)active();lastValue=value;setText(buttons[1].querySelector('.ui-label'),Math.round(value)+'%');buttons[0].disabled=value<=min;buttons[2].disabled=value>=max;},setVisible(value){visible=Boolean(value);sync();},dispose(){if(disposed)return;disposed=true;rest();node.remove();zoomDocks.delete(doc);doc.removeEventListener('toggle',sync,true);doc.removeEventListener('close',sync,true);doc.removeEventListener('visibilitychange',sync);view.removeEventListener('pagehide',pagehide);view.removeEventListener('pageshow',sync);}};
    function pagehide(event){rest();if(!event.persisted)api.dispose();}
    view.addEventListener('pagehide',pagehide);view.addEventListener('pageshow',sync);zoomDocks.set(doc,api);rest();sync();return api;
  }
  function createZoom(group,{min=50,max=200,step=10,value=100,onChange=()=>{},format=String,outLabel='Zoom out',inLabel='Zoom in',sprite='./shared-ui/icons.svg'}={}) {
    if(![min,max,step,value].every(Number.isFinite)||max<min||step<=0)throw new TypeError('Zoom requires finite bounds, a positive step and a finite value');
    const out=group.querySelector('[data-ui-zoom=out]'),into=group.querySelector('[data-ui-zoom=in]'),output=group.querySelector('[data-ui-zoom=value]');
    if(!out?.matches('button')||!into?.matches('button'))throw new TypeError('Zoom requires native minus and plus buttons');
    const view=group.ownerDocument.defaultView;
    let current,disposed=false;
    group.classList.add('ui-actions');group.classList.add('ui-inline');group.setAttribute('role','group');
    for(const [button,icon,label] of [[out,'minus',outLabel],[into,'plus',inLabel]]){
      button.type='button';button.classList.add('ui-icon-button');adoptAction(button,{icon,label,ariaLabel:label,iconOnly:true,sprite});
    }
    function setValue(next){
      if(!Number.isFinite(next))throw new TypeError('Zoom requires a finite value');
      if(disposed)return current;
      current=Math.min(max,Math.max(min,next));out.disabled=current<=min;into.disabled=current>=max;
      if(output)output.textContent=format(current);
      return current;
    }
    function change(direction){if(disposed||direction<0&&out.disabled||direction>0&&into.disabled)return;const before=current;setValue(Number((current+direction*step).toPrecision(12)));if(current!==before)onChange(current);}
    const decrease=()=>change(-1),increase=()=>change(1);
    function pagehide(event){if(!event.persisted)dispose();}
    function dispose(){if(disposed)return;disposed=true;out.removeEventListener('click',decrease);into.removeEventListener('click',increase);view?.removeEventListener('pagehide',pagehide);}
    setValue(value);out.addEventListener('click',decrease);into.addEventListener('click',increase);view?.addEventListener('pagehide',pagehide);
    return {get value(){return current;},setValue,dispose};
  }
  // Sort existing native rows, or expose controlled sorting for a paginated app.
  function createTableSort(table,{column='',direction='asc',defaultColumn=column,defaultDirection=direction,cycle:initialCycle=0,manual=false,onChange=()=>{},getValue,sprite='./shared-ui/icons.svg'}={}){
    const header=table?.tHead?.rows?.[0],doc=table?.ownerDocument,view=doc?.defaultView;
    if(!header||!view||!table.tBodies?.length)throw new TypeError('Sorting requires a native table with a header and body');
    const heads=[...header.cells],off=[],saved=[];let active=column,order=direction,disposed=false,cycle=initialCycle,baseline;
    if(!['asc','desc'].includes(order)||!['asc','desc'].includes(defaultDirection)||![0,1,2].includes(initialCycle))throw new TypeError('Sort direction must be asc or desc and cycle must be 0, 1 or 2');
    const ids=heads.map((head,i)=>head.dataset.column||'column-'+i);
    if(new Set(ids).size!==ids.length)throw new TypeError('Sort columns must have unique IDs');
    const buttons=new Map(),labels=new Map();
    function value(row,head){
      const cell=row.cells[[...header.cells].indexOf(head)];
      const raw=getValue?getValue(row,head,cell):cell?.dataset.sortValue??cell?.textContent??'';
      if(raw==null||String(raw).trim()===''||['—','Unknown','Undated'].includes(String(raw).trim()))return null;
      if(head.dataset.uiSortType==='number'){
        const number=Number(String(raw).replace(/−/g,'-').replace(/,/g,'').replace(/\s+[A-Z]{3}$/, '').trim());
        return Number.isFinite(number)?number:null;
      }
      return String(raw).trim();
    }
    function draw(){
      heads.forEach((head,i)=>{
        if(!buttons.has(ids[i]))return;
        const selected=ids[i]===active,label=labels.get(ids[i]);
        head.setAttribute('aria-sort',selected?(order==='asc'?'ascending':'descending'):'none');
        adoptAction(buttons.get(ids[i]),{label,ariaLabel:'Sort by '+label+(selected?'; '+(order==='asc'?'ascending':'descending'):'')+'; click to '+(selected&&cycle===2?'restore default order':selected&&cycle===1?'sort descending':'sort ascending'),icon:selected?(order==='asc'?'arrow-up':'arrow-down'):'list',sprite});
      });
    }
    function apply(){
      const head=heads[ids.indexOf(active)];if(!head)return;
      draw();if(manual)return;
      for(const body of table.tBodies){
        const rows=[...body.rows],positions=new Map(rows.map((row,i)=>[row,i]));
        rows.sort((a,b)=>{
          const x=value(a,head),y=value(b,head);
          if(x===null||y===null)return x===y?positions.get(a)-positions.get(b):x===null?1:-1;
          const compared=typeof x==='number'&&typeof y==='number'?x-y:String(x).localeCompare(String(y),undefined,{numeric:true,sensitivity:'base'});
          return (order==='asc'?compared:-compared)||positions.get(a)-positions.get(b);
        });
        body.append(...rows);
      }
    }
    function sort(id,next){
      if(disposed)return;
      if(!buttons.has(id)||!['asc','desc'].includes(next))throw new TypeError('Unknown sort column or direction');
      active=id;order=next;apply();onChange({column:active,direction:order});
    }
    heads.forEach((head,i)=>{
      if(head.dataset.uiSortDisabled!==undefined)return;
      const nodes=[...head.childNodes],label=head.textContent.trim(),button=doc.createElement('button');
      if(!label)return;
      saved.push({head,nodes,aria:head.getAttribute('aria-sort'),tab:head.getAttribute('tabindex')});
      button.type='button';button.dataset.uiTableSort='';button.dataset.uiVariant='quiet';button.dataset.uiLabel='always';
      head.removeAttribute('tabindex');head.replaceChildren(button);buttons.set(ids[i],button);labels.set(ids[i],label);
      const click=()=>{const next=active===ids[i]?cycle+1:1;if(next===3){cycle=0;sort(baseline.column,baseline.direction);}else{cycle=next;sort(ids[i],next===2?'desc':'asc');}};button.addEventListener('click',click);off.push(()=>button.removeEventListener('click',click));
    });
    if(active&&!buttons.has(active))throw new TypeError('Unknown initial sort column');
    active ||= buttons.keys().next().value||'';baseline={column:defaultColumn||buttons.keys().next().value||'',direction:defaultDirection};
    apply();draw();
    function dispose(){if(disposed)return;disposed=true;for(const remove of off)remove();for(const item of saved){item.head.replaceChildren(...item.nodes);for(const [key,val]of [['aria-sort',item.aria],['tabindex',item.tab]])if(val===null)item.head.removeAttribute(key);else item.head.setAttribute(key,val);}view.removeEventListener('pagehide',pagehide);}
    function pagehide(event){if(!event.persisted)dispose();}view.addEventListener('pagehide',pagehide);
    return {get state(){return {column:active,direction:order};},get cycle(){return cycle;},sort,reset(){cycle=0;sort(baseline.column,baseline.direction);},refresh:apply,dispose};
  }
  function createColumnDrag(table,{order=[],pinFirst=false,onBeforeChange=()=>{},onChange=()=>{}}={}){
    const header=table?.tHead?.rows?.[0],doc=table?.ownerDocument,view=doc?.defaultView;
    if(!header||!view)throw new TypeError('A native table with one header row is required');
    const heads=[...header.cells],ids=heads.map(cell=>cell.dataset.column);
    if(!ids.length||ids.some(id=>!id||!/^[a-z][a-z0-9-]*$/.test(id))||new Set(ids).size!==ids.length)throw new TypeError('Each column needs a unique data-column ID');
    const rows=[header,...[...table.tBodies].flatMap(section=>[...section.rows]),...(table.tFoot?[...table.tFoot.rows]:[])];
    if(rows.some(row=>row.cells.length!==ids.length||[...row.cells].some(cell=>cell.colSpan>1||cell.rowSpan>1)))throw new TypeError('Column dragging requires one cell per column in every row');
    const cells=rows.map(row=>new Map(ids.map((id,index)=>[id,row.cells[index]]))),original=[...ids];
    const saved=Array.isArray(order)?order:[];
    let current=[...new Set(saved.filter(id=>ids.includes(id))),...ids.filter(id=>!saved.includes(id))],drag=null,disposed=false;
    if(pinFirst)current=[ids[0],...current.filter(id=>id!==ids[0])];
    const prior=heads.map(head=>({tabindex:head.getAttribute('tabindex'),title:head.getAttribute('title'),keys:head.getAttribute('aria-keyshortcuts'),touch:head.style.touchAction}));
    const removers=[];
    function on(node,type,handler){node.addEventListener(type,handler);removers.push(()=>node.removeEventListener(type,handler));}
    function apply(){for(const [index,row] of rows.entries())row.append(...current.map(id=>cells[index].get(id)));}
    function change(next,id){
      if(next.every((value,index)=>value===current[index]))return;
      onBeforeChange();current=next;apply();onChange({order:[...current]});
      if(id)cells[0].get(id).focus?.({preventScroll:true});
    }
    function reorder(id,slot){
      const next=current.filter(value=>value!==id);slot=Math.max(pinFirst?1:0,Math.min(next.length,slot));next.splice(slot,0,id);change(next,id);
    }
    function slotAt(x,id){
      const rtl=view.getComputedStyle(table).direction==='rtl',rest=current.filter(value=>value!==id);
      let slot=0;
      for(const value of rest){const rect=cells[0].get(value).getBoundingClientRect(),middle=rect.left+rect.width/2;if(rtl?x<middle:x>middle)slot++;}
      return Math.max(pinFirst?1:0,slot);
    }
    function clearMarker(){for(const head of heads)delete head.dataset.uiColumnDrop;}
    function mark(slot,id){
      clearMarker();const rest=current.filter(value=>value!==id),target=rest[Math.min(slot,rest.length-1)];
      if(target)cells[0].get(target).dataset.uiColumnDrop=slot===rest.length?'after':'before';
    }
    function finish(cancel){
      if(!drag)return;const active=drag;drag=null;
      try{active.head.releasePointerCapture?.(active.pointerId);}catch(_){}
      delete active.head.dataset.uiColumnDragging;delete table.dataset.uiColumnDragging;clearMarker();
      if(!cancel&&active.moving)reorder(active.id,active.slot);
    }
    function down(event){
      const head=event.currentTarget,id=head.dataset.column;
      if(disposed||event.button!==0||pinFirst&&id===ids[0]||event.target.closest?.('button,a,input,select,textarea,[role=separator]'))return;
      finish(true);drag={head,id,pointerId:event.pointerId,x:event.clientX,y:event.clientY,slot:current.indexOf(id),moving:false};
      head.setPointerCapture?.(event.pointerId);
    }
    function move(event){
      if(!drag||event.pointerId!==drag.pointerId)return;
      if(!drag.moving&&Math.hypot(event.clientX-drag.x,event.clientY-drag.y)<6)return;
      drag.moving=true;drag.head.dataset.uiColumnDragging='';table.dataset.uiColumnDragging='true';event.preventDefault?.();
      const port=table.closest?.('.ui-table-scroll');
      if(port&&port.scrollWidth>port.clientWidth){const rect=port.getBoundingClientRect();if(event.clientX<rect.left+24)port.scrollLeft-=18;else if(event.clientX>rect.right-24)port.scrollLeft+=18;}
      drag.slot=slotAt(event.clientX,drag.id);mark(drag.slot,drag.id);
    }
    function key(event){
      const head=event.currentTarget,id=head.dataset.column;
      if(disposed||event.target!==head||!event.altKey||event.ctrlKey||event.metaKey||!['ArrowLeft','ArrowRight'].includes(event.key))return;
      event.preventDefault();event.stopPropagation();
      const rtl=view.getComputedStyle(table).direction==='rtl',step=(event.key==='ArrowRight'?1:-1)*(rtl?-1:1),index=current.indexOf(id),other=index+step;
      if(index<(pinFirst?1:0)||other<(pinFirst?1:0)||other>=current.length)return;
      const next=[...current];[next[index],next[other]]=[next[other],next[index]];change(next,id);
    }
    apply();
    for(const [index,head] of heads.entries()){
      if(pinFirst&&index===0)continue;
      head.dataset.uiColumnDrag='';head.style.touchAction='none';
      if(!head.hasAttribute('tabindex'))head.setAttribute('tabindex','0');
      head.setAttribute('aria-keyshortcuts','Alt+ArrowLeft Alt+ArrowRight');
      head.title=(prior[index].title?prior[index].title+' · ':'')+'Drag to reorder · Option + Left/Right to move';
      on(head,'pointerdown',down);on(head,'keydown',key);
    }
    on(doc,'pointermove',move);on(doc,'pointerup',event=>{if(drag?.pointerId===event.pointerId)finish(false);});
    on(doc,'pointercancel',event=>{if(drag?.pointerId===event.pointerId)finish(true);});
    on(doc,'visibilitychange',()=>{if(doc.visibilityState==='hidden')finish(true);});
    on(view,'pagehide',event=>{finish(true);if(!event.persisted)dispose();});
    function dispose(){
      if(disposed)return;finish(true);disposed=true;for(const remove of removers)remove();
      for(const [index,head] of heads.entries()){
        delete head.dataset.uiColumnDrag;delete head.dataset.uiColumnDrop;delete head.dataset.uiColumnDragging;head.style.touchAction=prior[index].touch;
        for(const [name,value] of [['tabindex',prior[index].tabindex],['title',prior[index].title],['aria-keyshortcuts',prior[index].keys]])if(value===null)head.removeAttribute(name);else head.setAttribute(name,value);
      }
      for(const [index,row] of rows.entries())row.append(...original.map(id=>cells[index].get(id)));
    }
    return {get state(){return {order:[...current]};},reset(){if(!disposed)change([...original],null);},dispose};
  }
  function createColumnManager(table,container,{order=[],hidden=[],pinFirst=false,renderControls=true,onBeforeChange=()=>{},onChange=()=>{}}={}){
    const header=table?.tHead?.rows?.[0],doc=table?.ownerDocument;
    if(!header||!container)throw new TypeError('A native table and column controls container are required');
    const heads=[...header.cells],ids=heads.map(head=>head.dataset.column),rows=[header,...[...table.tBodies].flatMap(body=>[...body.rows])];
    const cells=rows.map(row=>new Map(ids.map((id,index)=>[id,row.cells[index]]))),prior=cells.map(row=>new Map([...row].map(([id,cell])=>[id,cell.hidden])));
    const omitted=new Set((Array.isArray(hidden)?hidden:[]).filter(id=>ids.includes(id)&&(!pinFirst||id!==ids[0])));
    if(omitted.size===ids.length)omitted.delete(ids[0]);
    const controls=[],removers=[];let disposed=false,resetting=false;
    const state=()=>({...drag.state,hidden:[...omitted]});
    const apply=()=>{for(const row of cells)for(const [id,cell] of row)cell.hidden=omitted.has(id);for(const {id,input} of controls){input.checked=!omitted.has(id);input.disabled=(pinFirst&&id===ids[0])||(!omitted.has(id)&&omitted.size===ids.length-1);}};
    const drag=createColumnDrag(table,{order,pinFirst,onBeforeChange:()=>{if(!resetting)onBeforeChange();},onChange:()=>{apply();if(!resetting)onChange(state());}});
    for(const head of (renderControls?heads:[])){
      const id=head.dataset.column,label=doc.createElement('label'),input=doc.createElement('input'),text=doc.createElement('span');
      label.className='ui-check';input.type='checkbox';input.setAttribute('aria-label','Show '+(head.querySelector?.('.ui-label')?.textContent||head.textContent));text.className='ui-label';text.textContent=head.querySelector?.('.ui-label')?.textContent||head.textContent;
      const change=()=>{onBeforeChange();if(input.checked)omitted.delete(id);else omitted.add(id);apply();onChange(state());};
      input.addEventListener('change',change);removers.push(()=>input.removeEventListener('change',change));label.append(input,text);container.append(label);controls.push({id,input,label});
    }
    apply();
    function dispose(){if(disposed)return;disposed=true;for(const remove of removers)remove();for(const {label} of controls)label.remove();drag.dispose();for(const [index,row] of cells.entries())for(const [id,cell] of row)cell.hidden=prior[index].get(id);}
    return {get state(){return state();},setVisible(id,visible){if(disposed)return;if(!ids.includes(id))throw new TypeError('Unknown column');if(!visible&&(pinFirst&&id===ids[0]||omitted.size===ids.length-1&&!omitted.has(id)))return;onBeforeChange();if(visible)omitted.delete(id);else omitted.add(id);apply();onChange(state());},reset(){if(disposed)return;onBeforeChange();omitted.clear();resetting=true;try{drag.reset();}finally{resetting=false;}apply();onChange(state());},dispose};
  }
  function createTableToolbar(table,container,{sprite='./shared-ui/icons.svg',search=true,sorting=true,onChange=()=>{}}={}){
    const doc=table.ownerDocument,view=doc.defaultView,heads=[...table.tHead.rows[0].cells],original=new Map(),off=[],toggles=[];
    let resize,disposed=false;
    const bar=doc.createElement('div');bar.className='ui-toolbar ui-actions';bar.dataset.uiDensity='dense';bar.setAttribute('aria-label','Table controls');
    const field=doc.createElement('label');field.className='ui-field ui-search';
    const caption=doc.createElement('span');caption.className='ui-label';caption.textContent='Search';
    const input=doc.createElement('input');input.type='search';input.setAttribute('aria-label','Search rows');input.placeholder='Search rows…';field.append(caption,input);
    const count=doc.createElement('output');count.className='ui-meta';count.setAttribute('role','status');count.setAttribute('aria-live','polite');
    const columns=doc.createElement('div');columns.className='ui-actions ui-inline';columns.setAttribute('role','group');columns.setAttribute('aria-label','Visible columns');
    const empty=doc.createElement('p');empty.className='ui-meta';empty.textContent='No matching rows.';empty.hidden=true;
    const sort=sorting?createTableSort(table,{sprite}):null;
    function filter(){let shown=0,total=0;const query=input.value.trim().toLocaleLowerCase();for(const body of table.tBodies)for(const row of body.rows){if(!original.has(row))original.set(row,row.hidden);if(original.get(row))continue;total++;row.hidden=!row.textContent.toLocaleLowerCase().includes(query);if(!row.hidden)shown++;}count.textContent=shown+' of '+total+' rows';empty.hidden=shown!==0;}
    function drawColumns(){const hidden=new Set(manager.state.hidden);for(const {id,button,label}of toggles){const visible=!hidden.has(id);button.setAttribute('aria-pressed',String(visible));button.disabled=visible&&hidden.size===heads.length-1;adoptAction(button,{label,icon:visible?'check':'plus',ariaLabel:(visible?'Hide ':'Show ')+label+' column',sprite});}onChange(manager.state);}
    const manager=createColumnManager(table,columns,{renderControls:false,onBeforeChange:()=>resize?.dispose(),onChange:()=>{resize=createColumnResize(table);drawColumns();}});
    for(const head of heads){const id=head.dataset.column,label=head.querySelector('.ui-label')?.textContent||head.textContent.trim(),button=doc.createElement('button');button.type='button';button.dataset.uiLabel='always';const click=()=>manager.setVisible(id,manager.state.hidden.includes(id));button.addEventListener('click',click);off.push(()=>button.removeEventListener('click',click));columns.append(button);toggles.push({id,button,label});}
    const reset=doc.createElement('button');reset.type='button';adoptAction(reset,{label:'Reset view',icon:'refresh',sprite});
    const restore=()=>{input.value='';manager.reset();sort?.reset();resize?.reset();filter();};reset.addEventListener('click',restore);input.addEventListener('input',filter);
    const menu=doc.createElement('details');menu.className='ui-menu';
    const trigger=doc.createElement('summary');trigger.className='ui-action';trigger.dataset.uiVariant='quiet';trigger.dataset.uiLabel='hidden';adoptAction(trigger,{label:'Table options',ariaLabel:'Table options',icon:'settings',iconOnly:true,sprite});
    const panel=doc.createElement('div');panel.className='ui-menu-panel ui-stack';const title=doc.createElement('strong');title.className='ui-section-title';title.textContent='Visible columns';panel.append(title,columns,reset);menu.append(trigger,panel);
    if(search)bar.append(field);bar.append(count,menu);container.append(bar,empty);resize=createColumnResize(table);drawColumns();filter();
    function dispose(){if(disposed)return;disposed=true;input.removeEventListener('input',filter);reset.removeEventListener('click',restore);for(const remove of off)remove();resize?.dispose();manager.dispose();sort?.dispose();for(const [row,hidden]of original)row.hidden=hidden;bar.remove();empty.remove();view.removeEventListener('pagehide',pagehide);}
    function pagehide(event){if(!event.persisted)dispose();}view.addEventListener('pagehide',pagehide);
    return {element:bar,input,columns,sort,manager,refresh(){sort?.refresh();filter();},dispose};
  }
  function createColumnResize(table,{min=72,max=1200,widths=[],onChange=()=>{}}={}){
    if(!Number.isFinite(min)||!Number.isFinite(max)||min<24||max<min)throw new TypeError('Column resizing requires finite positive bounds');
    const doc=table.ownerDocument,view=doc.defaultView,heads=[...table.tHead.rows[0].cells].filter(cell=>!cell.hidden);
    if(!heads.length||heads.some(cell=>cell.colSpan>1)||table.querySelector('colgroup'))throw new TypeError('Use a simple table with one header per column and no colgroup');
    const previous={width:table.style.width,minWidth:table.style.minWidth,layout:table.style.tableLayout},group=doc.createElement('colgroup'),handles=[],removers=[];
    const initial=heads.map(cell=>Math.round(cell.getBoundingClientRect().width)),padding=heads.map(cell=>cell.style.paddingInlineEnd),position=heads.map(cell=>cell.style.position);
    let values=initial.map((value,i)=>clamp(Number(widths[i])||value)),drag=null,disposed=false;
    function clamp(value){return Math.min(max,Math.max(min,value));}
    function on(node,type,handler){node.addEventListener(type,handler);removers.push(()=>node.removeEventListener(type,handler));}
    function measured(){return heads.map(cell=>cell.getBoundingClientRect().width);}
    function adjust(index,next,before=values){const pair=before[index]+before[index+1],lo=Math.max(min,pair-max),hi=Math.min(max,pair-min);values=[...before];values[index]=Math.max(lo,Math.min(hi,next));values[index+1]=pair-values[index];draw();}
    for(const [index,head] of heads.entries()){
      group.append(doc.createElement('col'));if(index===heads.length-1)continue;
      const handle=doc.createElement('button');handle.type='button';handle.className='ui-resize-handle ui-column-resize';
      Object.assign(handle.style,{position:'absolute',insetInlineEnd:'0',insetBlock:'0',height:'100%',cursor:'col-resize'});
      if(view.getComputedStyle(head).position==='static')head.style.position='relative';head.style.paddingInlineEnd='var(--ui-control-height)';handle.setAttribute('role','separator');handle.setAttribute('aria-orientation','vertical');
      handle.setAttribute('aria-label',`Resize ${head.textContent.trim()} column`);handle.title='Drag divider · Arrow keys to adjust · Double-click to reset';
      handle.setAttribute('aria-valuemin',String(min));head.append(handle);handles.push(handle);
      on(handle,'pointerdown',event=>{if(event.button!==0)return;event.preventDefault();finish(false);handle.focus({preventScroll:true});values=measured();drag={index,x:event.clientX,id:event.pointerId,handle,before:[...values]};handle.setPointerCapture?.(event.pointerId);table.dataset.uiResizing='true';});
      on(handle,'keydown',event=>{
        if(event.key==='Escape'&&drag){event.preventDefault();event.stopPropagation();finish(true);return;}
        if(!['ArrowLeft','ArrowRight','Home','End'].includes(event.key))return;
        event.preventDefault();event.stopPropagation();values=measured();const step=event.shiftKey?1:10,direction=view.getComputedStyle(table).direction==='rtl'?-1:1;
        adjust(index,event.key==='Home'?min:event.key==='End'?max:values[index]+(event.key==='ArrowLeft'?-step:step)*direction);onChange([...values]);
      });
      on(handle,'dblclick',()=>{values=measured();adjust(index,initial[index]);onChange([...values]);});
    }
    table.prepend(group);table.dataset.uiResizable='true';table.style.tableLayout='fixed';table.style.width='100%';
    // A narrow scrollport must not squeeze every saved column to its minimum.
    // Keep the chosen pixel budget as the table's floor; percentages still let
    // the same columns fill a wider desktop container.
    table.style.minWidth=values.reduce((sum,value)=>sum+value,0)+'px';
    function draw(){const total=values.reduce((sum,value)=>sum+value,0);for(const [i,col] of [...group.children].entries()){col.style.width=values[i]/total*100+'%';if(handles[i]){handles[i].setAttribute('aria-valuemax',String(Math.min(max,values[i]+values[i+1]-min)));handles[i].setAttribute('aria-valuenow',String(Math.round(values[i])));handles[i].setAttribute('aria-valuetext',Math.round(values[i])+' pixels');}}}
    function finish(cancel){if(!drag)return;const active=drag;drag=null;if(cancel)values=active.before;try{active.handle.releasePointerCapture?.(active.id);}catch(_){}delete table.dataset.uiResizing;draw();if(!cancel)onChange([...values]);}
    on(doc,'pointermove',event=>{if(!drag||event.pointerId!==drag.id)return;const direction=view.getComputedStyle(table).direction==='rtl'?-1:1;adjust(drag.index,drag.before[drag.index]+(event.clientX-drag.x)*direction,drag.before);});
    on(doc,'pointerup',event=>{if(drag?.id===event.pointerId)finish(false);});on(doc,'pointercancel',event=>{if(drag?.id===event.pointerId)finish(true);});
    on(doc,'visibilitychange',()=>{if(doc.visibilityState==='hidden')finish(true);});
    on(view,'pagehide',event=>{finish(true);if(!event.persisted)dispose();});
    function dispose(){if(disposed)return;finish(true);disposed=true;for(const remove of removers)remove();for(const [i,handle] of handles.entries()){handle.remove();heads[i].style.paddingInlineEnd=padding[i];heads[i].style.position=position[i];}group.remove();delete table.dataset.uiResizable;table.style.width=previous.width;table.style.minWidth=previous.minWidth;table.style.tableLayout=previous.layout;}
    draw();return {get widths(){return [...values];},reset(){if(disposed)return;values=initial.map(clamp);draw();onChange([...values]);},dispose};
  }
  function createLightbox(dialog,{onNavigate=()=>{},onClose=()=>{}}={}){
    if(dialog.tagName!=='DIALOG')throw new TypeError('Use a native dialog');
    const doc=dialog.ownerDocument,view=doc.defaultView;let disposed=false,opener=null;
    dialog.classList.add('ui-popout');
    const body=dialog.querySelector('[data-ui-lightbox-body]');if(body)body.dataset.uiPopoutBody='';
    function key(event){if(event.defaultPrevented||event.altKey||event.ctrlKey||event.metaKey||event.shiftKey||event.target.closest('input,textarea,select,[contenteditable=true],[role=slider],[role=separator]')||view.getSelection()?.toString())return;if(event.key==='ArrowLeft'||event.key==='ArrowRight'){event.preventDefault();onNavigate(event.key==='ArrowLeft'?-1:1);}}
    function click(event){if(event.target.closest('[data-ui-lightbox-close]'))close();else if(event.target===dialog){const rect=dialog.getBoundingClientRect();if(event.clientX<rect.left||event.clientX>rect.right||event.clientY<rect.top||event.clientY>rect.bottom)close();}}
    function closed(){onClose();if(opener?.isConnected)opener.focus({preventScroll:true});}
    function close(){if(dialog.open)dialog.close();}
    function pagehide(event){if(!event.persisted)dispose();}
    function dispose(){if(disposed)return;disposed=true;dialog.removeEventListener('keydown',key);dialog.removeEventListener('click',click);dialog.removeEventListener('close',closed);view.removeEventListener('pagehide',pagehide);}
    dialog.addEventListener('keydown',key);dialog.addEventListener('click',click);dialog.addEventListener('close',closed);view.addEventListener('pagehide',pagehide);
    return {open(trigger=doc.activeElement){if(disposed)return;if(!dialog.open){opener=trigger;dialog.showModal();}},close,dispose};
  }
  // A nonmodal, event-driven coachmark. The consumer owns lessons and persistence.
  function createGuide({root=globalThis.document.body,sprite='/shared-ui/icons.svg',onBack=()=>{},onSkip=()=>{},onRestart=()=>{},onNext=()=>{}}={}){
    const doc=root.ownerDocument,view=doc.defaultView;
    if(typeof doc.createElement('aside').showPopover!=='function')throw new Error('Native popovers are required for guided lessons');
    const make=(tag,text='',cls='')=>{const node=doc.createElement(tag);node.textContent=text;node.className=cls;return node;};
    const panel=make('aside','','ui-popout ui-chrome'),header=make('header'),title=make('h3','','ui-section-title'),count=make('p','','ui-meta');
    panel.popover='manual';panel.setAttribute('role','region');panel.setAttribute('aria-label','Guided lesson');panel.setAttribute('aria-live','polite');
    Object.assign(panel.style,{position:'fixed',inset:'auto',margin:'0',width:'min(28rem,calc(100vw - 24px))',maxHeight:'min(24rem,42dvh)'});
    const body=make('div','','ui-stack'),caption=make('p'),status=make('p','','ui-status'),footer=make('footer','','ui-actions ui-fill');body.dataset.uiPopoutBody='';status.setAttribute('role','status');status.setAttribute('aria-live','polite');
    header.append(title,count);body.append(caption,status);panel.append(header,body,footer);
    const marker=make('span','','ui-selectable');marker.popover='manual';marker.dataset.uiSelected='true';marker.setAttribute('aria-hidden','true');
    Object.assign(marker.style,{position:'fixed',inset:'auto',margin:'0',padding:'0',border:'0',background:'none',pointerEvents:'none',minWidth:'0',minHeight:'0',maxWidth:'none',maxHeight:'none'});
    let disposed=false,opened=false,frame=null,model={},target=null,opener=null,observedTarget=null;
    const action=(label,icon,fn)=>{const button=make('button');button.type='button';api.adoptAction(button,{label,icon,sprite});button.addEventListener('click',fn);footer.append(button);return button;};
    const back=action('Back','arrow-left',onBack),restart=action('Restart','refresh',onRestart),skip=action('Skip','close',onSkip);
    const focus=action('Focus control','search',()=>{if(!target)return;target.scrollIntoView?.({block:'nearest',inline:'nearest',behavior:'instant'});target.focus({preventScroll:true});queue();});
    const next=action('Next','arrow-right',onNext);next.dataset.uiLabel='always';
    function hide(node){if(node.matches(':popover-open'))node.hidePopover();}
    function resolve(){try{return typeof model.target==='function'?model.target():model.target;}catch{return null;}}
    function layout(){
      frame=null;if(disposed||!opened||doc.hidden)return;
      const found=resolve();target=found?.isConnected&&found.getClientRects().length?found:null;
      const modal=doc.activeElement?.closest('dialog:modal')||panel.closest('dialog:modal')||[...doc.querySelectorAll('dialog:modal')].at(-1);
      if(modal&&!modal.contains(target))target=null;
      const host=target?.closest('[popover]:popover-open')||modal||target?.closest('dialog[open]')||root;
      if(panel.parentNode!==host){hide(panel);hide(marker);host.append(marker,panel);}
      if(!panel.matches(':popover-open'))panel.showPopover();
      observer?.observe(panel);if(observedTarget!==target){if(observedTarget)observer?.unobserve(observedTarget);observedTarget=target;if(target)observer?.observe(target);}
      const w=view.innerWidth,h=view.innerHeight,edge=12,r=target?.getBoundingClientRect(),box=panel.getBoundingClientRect();
      const left=Math.max(edge,Math.min(w-box.width-edge,r?(r.left+r.right-box.width)/2:edge));
      const above=r?r.top-edge-box.height:-1,below=r?r.bottom+edge:h-box.height-edge;
      const top=r&&above>=edge?above:below+box.height<=h-edge?below:r&&r.top>h/2?edge:h-box.height-edge;
      panel.style.left=left+'px';panel.style.top=Math.max(edge,Math.min(h-box.height-edge,top))+'px';
      focus.disabled=!target;focus.hidden=!model.target;
      if(r&&r.bottom>0&&r.top<h&&r.right>0&&r.left<w){
        Object.assign(marker.style,{left:Math.max(1,r.left-2)+'px',top:Math.max(1,r.top-2)+'px',width:Math.max(0,Math.min(w-1,r.right+2)-Math.max(1,r.left-2))+'px',height:Math.max(0,Math.min(h-1,r.bottom+2)-Math.max(1,r.top-2))+'px'});
        if(!marker.matches(':popover-open'))marker.showPopover();
      }else hide(marker);
      api.refreshActions?.(panel);
    }
    function queue(){if(!disposed&&opened&&!doc.hidden&&frame===null)frame=view.requestAnimationFrame(layout);}
    const observer=view.ResizeObserver?new view.ResizeObserver(queue):null;
    function update(value){model={...value};title.textContent=value.title||'Guided lesson';caption.textContent=value.text||'';count.textContent=value.total?`${value.position||1} of ${value.total}`:'';status.textContent=value.status||'';back.disabled=!(value.position>1);next.hidden=!value.canNext;const label=value.nextLabel||'Next';api.setActionLabel(next,label,{ariaLabel:label});queue();}
    function open(value){if(disposed)return;opener=doc.activeElement;opened=true;root.append(marker,panel);update(value);layout();skip.focus({preventScroll:true});}
    function close(){opened=false;if(frame!==null)view.cancelAnimationFrame(frame);frame=null;observer?.disconnect();observedTarget=null;hide(panel);hide(marker);if(panel.contains(doc.activeElement)&&opener?.isConnected)opener.focus({preventScroll:true});}
    function visibility(){if(doc.hidden){if(frame!==null)view.cancelAnimationFrame(frame);frame=null;observer?.disconnect();observedTarget=null;}else queue();}
    function key(event){if(opened&&event.key==='Escape'&&!event.isComposing&&event.keyCode!==229)onSkip();}
    function pagehide(event){if(!event.persisted)dispose();else visibility();}
    function dispose(){if(disposed)return;close();disposed=true;observer?.disconnect();doc.removeEventListener('scroll',queue,true);doc.removeEventListener('visibilitychange',visibility);doc.removeEventListener('keydown',key);view.removeEventListener('resize',queue);view.removeEventListener('pagehide',pagehide);view.removeEventListener('pageshow',queue);api.releaseActions?.(panel);panel.remove();marker.remove();}
    doc.addEventListener('scroll',queue,true);doc.addEventListener('visibilitychange',visibility);doc.addEventListener('keydown',key);view.addEventListener('resize',queue);view.addEventListener('pagehide',pagehide);view.addEventListener('pageshow',queue);
    return {element:panel,open,update,close,dispose,refresh:queue};
  }

  const api={version:'1.20.0',createSubmitGuard,setActionLayout,createAdaptiveDensity,createControlScale,animatePanel,createAnchoredPopover,createResponsiveSlot,mount,release,adoptAction,adoptNumberedAction,setActionState,runAction,reserveText,setText,setCardColor,resolveCardColor,createCardColorResolver,setSelection,setSortDirection,setAppColor,createBackToTop,createZoom,installZoomShortcuts,createZoomFeedback,createReviewControls,createContextToolbar,createResizablePanel,createValueTransition,createZoomSteps,createTableSort,createTableToolbar,createColumnDrag,createColumnManager,createColumnResize,createLightbox,createGuide,setActionLabel:(element,label,options={})=>adoptAction(element,{...options,label}),source:DEFAULT_SOURCE};
  if(typeof module==='object'&&module.exports)module.exports=api;
  if(typeof window!=='undefined'&&typeof document!=='undefined'){
    window.SharedUI=api;api.setMode=mode=>{if(!api.instance)api.instance=mount(document);api.instance.setMode?.(mode);};
    function start(){if(!api.instance)api.instance=mount(document);}
    if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
  }
})();

/* Optional native DOM helpers; no application state or rendering loop. */
(() => {
  'use strict';
  if(typeof window==='undefined'||!window.SharedUI)return;
  const UI=window.SharedUI,documents=new WeakMap();
  // A stationary touch/pen press; hosts retain selection, geometry and capture.
  UI.createPressHold=(root,{onHold,delay=450,tolerance=10,accept=()=>true}={})=>{
    const doc=root.ownerDocument||root,view=doc.defaultView,removers=[];
    let press=null,timer=null,consumed=null,heldPointer=null,expiry=null,disposed=false;
    const listen=(target,type,handler,capture=false)=>{target.addEventListener(type,handler,capture);removers.push(()=>target.removeEventListener(type,handler,capture));};
    function cancel(){if(timer!==null)view.clearTimeout(timer);timer=null;press=null;}
    function forget(){consumed=null;heldPointer=null;if(expiry!==null)view.clearTimeout(expiry);expiry=null;}
    listen(doc,'pointerdown',event=>{if(press&&press.pointerId!==event.pointerId)cancel();},true);
    listen(root,'pointerdown',event=>{
      if(disposed||!['touch','pen'].includes(event.pointerType)||event.button!==0||event.isPrimary===false||!accept(event))return;
      cancel();forget();press=event;
      timer=view.setTimeout(()=>{
        timer=null;const initial=press;if(!initial||doc.hidden||!root.isConnected)return;
        if(onHold?.(initial)!==false){consumed=initial.target;heldPointer=initial.pointerId;}
        press=null;
      },delay);
    });
    listen(doc,'pointermove',event=>{if(press&&event.pointerId===press.pointerId&&Math.hypot(event.clientX-press.clientX,event.clientY-press.clientY)>tolerance)cancel();},true);
    listen(doc,'pointerup',event=>{if(event.pointerId===heldPointer){heldPointer=null;expiry=view.setTimeout(forget,800);}cancel();},true);
    for(const type of ['pointercancel','lostpointercapture'])listen(doc,type,event=>{if(event.pointerId===heldPointer)forget();cancel();},true);
    listen(view,'click',event=>{if(consumed&&event.detail!==0&&(event.target===consumed||consumed.contains?.(event.target))){event.preventDefault();event.stopImmediatePropagation();forget();}},true);
    listen(root,'contextmenu',event=>{if(press||consumed)event.preventDefault();});
    listen(doc,'visibilitychange',()=>{if(doc.hidden){cancel();forget();}});
    listen(view,'blur',()=>{cancel();forget();});
    function dispose(){if(disposed)return;disposed=true;cancel();forget();removers.splice(0).forEach(remove=>remove());}
    listen(view,'pagehide',event=>{if(!event.persisted)dispose();});
    return {cancel,dispose};
  };
  // Native preview density controls. Hosts resize their catalogue and images.
  UI.createPreviewSizeControl=({root,value=160,min=96,max=320,step=16,sprite,onChange=()=>{}}={})=>{
    if(!root?.ownerDocument)throw new TypeError('Preview size control needs a root element');
    if(![min,max,step].every(Number.isFinite)||min<=0||max<min||step<=0||!Number.isFinite((max-min)/step))throw new TypeError('Use positive bounded preview sizes and step');
    if(typeof onChange!=='function')throw new TypeError('Preview size change handler must be a function');
    const doc=root.ownerDocument,group=doc.createElement('div'),input=doc.createElement('input'),smaller=doc.createElement('button'),larger=doc.createElement('button');
    group.className='ui-inline';group.setAttribute('role','group');group.setAttribute('aria-label','Preview size');
    Object.assign(group.style,{display:'flex',alignItems:'center',gap:'var(--ui-gap,6px)',inlineSize:'100%',minInlineSize:'0'});
    input.type='range';input.className='ui-range';input.min=String(min);input.max=String(max);input.step=String(step);input.setAttribute('aria-label','Preview size');
    Object.assign(input.style,{flex:'1 1 0',width:'auto',minWidth:'0'});
    smaller.type=larger.type='button';
    UI.adoptAction(smaller,{label:'Smaller previews',icon:'minus',iconOnly:true,sprite});
    UI.adoptAction(larger,{label:'Larger previews',icon:'plus',iconOnly:true,sprite});
    smaller.style.flex=larger.style.flex='0 0 auto';
    const lastStep=Math.floor((max-min)/step+1e-9),normalize=raw=>{
      if((typeof raw!=='number'&&typeof raw!=='string')||typeof raw==='string'&&!raw.trim()||!Number.isFinite(Number(raw)))throw new TypeError('Preview size must be a finite number');
      const at=Math.max(0,Math.min(lastStep,Math.round((Number(raw)-min)/step)));
      return Number((min+at*step).toPrecision(15));
    };
    let current=normalize(value),disposed=false;
    function sync(){input.value=String(current);input.setAttribute('aria-valuetext',`${current} pixels`);smaller.disabled=current<=min;larger.disabled=current>=normalize(max);}
    function setValue(next,{notify=false}={}){if(disposed)return current;const normalized=normalize(next),changed=normalized!==current;current=normalized;sync();if(changed&&notify)onChange(current);return current;}
    const decrease=()=>setValue(current-step,{notify:true}),increase=()=>setValue(current+step,{notify:true}),inputChange=()=>setValue(input.value,{notify:true});
    smaller.addEventListener('click',decrease);larger.addEventListener('click',increase);input.addEventListener('input',inputChange);input.addEventListener('change',inputChange);
    group.append(smaller,input,larger);root.append(group);UI.observeActions?.(group);sync();
    return {setValue,get value(){return current;},dispose(){if(disposed)return;disposed=true;smaller.removeEventListener('click',decrease);larger.removeEventListener('click',increase);input.removeEventListener('input',inputChange);input.removeEventListener('change',inputChange);UI.releaseActions?.(group);group.remove();}};
  };
  // Host-owned content, one shared native preview/selection pattern.
  UI.createPreviewCatalogue=({root,onSelect=()=>{},onManage,sprite,minColumnWidth,aspectRatio='16 / 9',actionIcon='scenes'}={})=>{
    const columnWidth=value=>{const width=String(value);if(!/^(?:\d+(?:\.\d+)?|\.\d+)(?:px|rem|em)$/.test(width)||!Number.isFinite(parseFloat(width))||parseFloat(width)<=0)throw new TypeError('Preview column width must use positive px, rem or em');return width;};
    if(minColumnWidth!==undefined)columnWidth(minColumnWidth);
    const doc=root.ownerDocument,original=root.className,originalColumns=root.style.gridTemplateColumns,cards=new Map();root.classList.add('ui-grid');root.dataset.uiGrid='fill';
    let disposed=false;
    function setMinColumnWidth(value){if(disposed)return;const width=columnWidth(value);root.style.gridTemplateColumns=`repeat(auto-fill,minmax(min(100%,${width}),1fr))`;return width;}
    if(minColumnWidth!==undefined)setMinColumnWidth(minColumnWidth);
    function update(items,selectedId){
      if(disposed)return;
      const keep=new Set(items.map(item=>String(item.id)));
      for(const [id,card]of cards)if(!keep.has(id)){card.element.remove();cards.delete(id);}
      for(const item of items){const id=String(item.id);let card=cards.get(id);
        if(!card){const element=doc.createElement('article');element.className='ui-card ui-stack ui-selectable';element.dataset.itemId=id;
          const media=doc.createElement('button');media.type='button';media.className='ui-media-button';media.style.aspectRatio=String(aspectRatio);
          const image=doc.createElement('img');image.alt='';image.loading='lazy';Object.assign(image.style,{inlineSize:'100%',blockSize:'100%',objectFit:'contain'});media.append(image);
          const caption=doc.createElement('div');caption.className='ui-pad ui-stack';Object.assign(caption.style,{display:'grid',gridTemplateColumns:'minmax(0,1fr) auto',alignItems:'center',minWidth:'0',overflow:'hidden'});const action=doc.createElement('button');action.type='button';action.className='ui-item';action.dataset.uiVariant='quiet';Object.assign(action.style,{minWidth:'0',overflow:'hidden'});UI.adoptAction(action,{label:item.label,...(actionIcon?{icon:actionIcon}:{}),sprite});
          const detail=doc.createElement('small');detail.className='ui-meta';caption.append(action,detail);
          detail.style.gridColumn='1 / -1';detail.style.gridRow='2';
          const select=()=>onSelect(id);media.addEventListener('click',select);action.addEventListener('click',select);
          if(onManage){const manage=doc.createElement('button');manage.type='button';UI.adoptAction(manage,{label:'Manage '+item.label,icon:'more',iconOnly:true,sprite});manage.style.gridColumn='2';manage.style.gridRow='1';manage.addEventListener('click',()=>onManage(id));caption.append(manage);}
          element.append(media,caption);card={element,media,image,action,detail};cards.set(id,card);
        }
        card.media.setAttribute('aria-label','Open '+item.label);card.media.setAttribute('aria-pressed',String(id===String(selectedId)));card.element.dataset.uiSelected=String(id===String(selectedId));
        UI.setActionLabel(card.action,item.label);card.action.title=item.label;card.detail.textContent=item.detail||'';card.detail.hidden=!item.detail;
        if(item.image){if(card.image.getAttribute('src')!==item.image)card.image.src=item.image;card.image.hidden=false;}else{card.image.removeAttribute('src');card.image.hidden=true;}
        const position=items.findIndex(row=>String(row.id)===id);if(root.children[position]!==card.element)root.insertBefore(card.element,root.children[position]||null);
      }
    }
    return {update,setMinColumnWidth,dispose(){if(disposed)return;disposed=true;root.replaceChildren();root.className=original;root.style.gridTemplateColumns=originalColumns;delete root.dataset.uiGrid;cards.clear();}};
  };
  // Searchable native preview catalogue. Apps supply images from their own renderer.
  UI.createShapeBrowser=({root,onSelect=()=>{},sprite}={})=>{
    if(!root?.ownerDocument)throw new TypeError('Shape browser needs a root element');
    const doc=root.ownerDocument,originalClass=root.className,originalBusy=root.getAttribute('aria-busy');
    const off=[],listen=(node,type,handler)=>{node.addEventListener(type,handler);off.push(()=>node.removeEventListener(type,handler));};
    root.classList.add('ui-stack');
    const toolbar=doc.createElement('div');toolbar.className='ui-toolbar';
    const field=(label,input)=>{const wrap=doc.createElement('label');wrap.className=input.type==='search'?'ui-field ui-search':'ui-field';const text=doc.createElement('span');text.className='ui-label';text.textContent=label;wrap.append(text,input);return wrap;};
    const search=doc.createElement('input');search.type='search';search.placeholder='Search shapes';search.setAttribute('aria-label','Search shapes');
    const pack=doc.createElement('select');pack.setAttribute('aria-label','Shape pack');
    const previewSize=doc.createElement('input');previewSize.type='range';previewSize.className='ui-range';previewSize.min='56';previewSize.max='160';previewSize.step='8';previewSize.value='80';previewSize.setAttribute('aria-label','Preview size');
    const sizeField=field('Preview size',previewSize);sizeField.style.minInlineSize='min(100%,16rem)';
    const sizeValue=doc.createElement('span');sizeValue.className='ui-meta';sizeField.append(sizeValue);
    toolbar.append(field('Search',search),field('Pack',pack),sizeField);
    const gallery=doc.createElement('div');gallery.setAttribute('aria-label','Shape previews');
    const status=doc.createElement('output');status.className='ui-meta';status.setAttribute('aria-live','polite');
    root.append(toolbar,gallery,status);
    let items=[],selectedId='',visible=[],busy=false,disposed=false;
    const words=value=>String(value??'').normalize('NFKD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
    const packOf=item=>String(item.pack||'Shapes');
    const mediaButtons=()=>[...gallery.querySelectorAll('.ui-media-button')];
    const focusCard=id=>{const buttons=mediaButtons();for(const button of buttons)button.tabIndex=button.closest('[data-item-id]')?.dataset.itemId===id?0:-1;buttons.find(button=>button.tabIndex===0)?.focus();};
    const setBusy=(value,message)=>{busy=Boolean(value);root.setAttribute('aria-busy',String(busy));search.disabled=busy;pack.disabled=busy;for(const button of gallery.querySelectorAll('button'))button.disabled=busy;if(message)status.textContent=String(message);};
    const choose=async id=>{if(busy||disposed||!items.some(item=>item.id===id))return;setBusy(true,'Applying shape…');try{await onSelect(id);if(disposed)return;selectedId=id;render();}catch(error){if(!disposed){status.textContent=error?.message||String(error);status.dataset.error='true';}}finally{if(!disposed)setBusy(false);}};
    const catalogue=UI.createPreviewCatalogue({root:gallery,onSelect:id=>void choose(String(id)),sprite,minColumnWidth:'80px',aspectRatio:1,actionIcon:false});
    const resize=()=>{const size=Math.max(56,Math.min(160,Number(previewSize.value)||80));previewSize.value=String(size);sizeValue.textContent=`${size} px`;previewSize.setAttribute('aria-valuetext',`${size} pixels`);gallery.style.gridTemplateColumns=`repeat(auto-fill,minmax(min(100%,${size}px),1fr))`;};
    listen(previewSize,'input',resize);resize();
    function render(){
      const terms=words(search.value).trim().split(/\s+/).filter(Boolean),active=doc.activeElement?.closest?.('[data-item-id]')?.dataset.itemId;
      visible=items.filter(item=>(!pack.value||packOf(item)===pack.value)&&terms.every(term=>words([item.id,item.label,packOf(item),item.detail,...(item.tags||[])].join(' ')).includes(term)));
      catalogue.update(visible.map(item=>({...item,detail:''})),selectedId);
      const focusId=visible.some(item=>item.id===active)?active:visible.some(item=>item.id===selectedId)?selectedId:visible[0]?.id;
      for(const card of gallery.querySelectorAll('[data-item-id]')){const primary=card.querySelector('.ui-media-button');if(primary){primary.tabIndex=card.dataset.itemId===focusId?0:-1;primary.setAttribute('aria-label','Use '+(visible.find(item=>item.id===card.dataset.itemId)?.label||card.dataset.itemId));}for(const button of card.querySelectorAll('button')){button.disabled=busy;if(button!==primary)button.tabIndex=-1;}}
      status.textContent=visible.length?`${visible.length} of ${items.length} shapes`:'No shapes match. Clear the search or select another pack.';delete status.dataset.error;
    }
    listen(search,'input',render);listen(pack,'change',render);
    listen(search,'keydown',event=>{if(event.key==='Escape'&&search.value){event.preventDefault();event.stopPropagation();search.value='';render();}else if(event.key==='ArrowDown'&&visible.length){event.preventDefault();focusCard(visible[0].id);}else if(event.key==='Enter'&&visible.length===1){event.preventDefault();void choose(visible[0].id);}});
    listen(gallery,'keydown',event=>{
      if(busy||!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','Home','End'].includes(event.key)||!event.target.closest?.('.ui-media-button'))return;
      const buttons=mediaButtons(),index=buttons.indexOf(event.target);if(index<0||!buttons.length)return;
      event.preventDefault();event.stopPropagation();let next=index;
      if(event.key==='Home')next=0;else if(event.key==='End')next=buttons.length-1;else if(event.key==='ArrowLeft')next=Math.max(0,index-1);else if(event.key==='ArrowRight')next=Math.min(buttons.length-1,index+1);else{
        const here=buttons[index].getBoundingClientRect(),down=event.key==='ArrowDown',rows=buttons.map((button,i)=>({i,rect:button.getBoundingClientRect()})).filter(entry=>down?entry.rect.top>here.top+2:entry.rect.top<here.top-2);
        if(rows.length){const row=down?Math.min(...rows.map(entry=>entry.rect.top)):Math.max(...rows.map(entry=>entry.rect.top));next=rows.filter(entry=>Math.abs(entry.rect.top-row)<2).sort((a,b)=>Math.abs(a.rect.left-here.left)-Math.abs(b.rect.left-here.left))[0].i;}
      }
      focusCard(buttons[next].closest('[data-item-id]').dataset.itemId);
    });
    listen(gallery,'focusin',event=>{if(event.target.matches?.('.ui-media-button'))for(const button of mediaButtons())button.tabIndex=button===event.target?0:-1;});
    return {
      update(next,selection=''){
        const ids=new Set();items=(Array.isArray(next)?next:[]).filter(item=>item&&item.id!=null&&!ids.has(String(item.id))&&ids.add(String(item.id))).map(item=>({...item,id:String(item.id),label:String(item.label||item.id),tags:Array.isArray(item.tags)?item.tags:[]}));selectedId=String(selection??'');
        const selectedPack=pack.value,packs=[...new Set(items.map(packOf))].sort((a,b)=>a.localeCompare(b));pack.replaceChildren();const all=doc.createElement('option');all.value='';all.textContent='All packs';pack.append(all);for(const name of packs){const option=doc.createElement('option');option.value=name;option.textContent=name;pack.append(option);}pack.value=packs.includes(selectedPack)?selectedPack:'';render();
      },
      setBusy,
      setStatus(message,error=false){status.textContent=String(message||'');if(error)status.dataset.error='true';else delete status.dataset.error;},
      focusSearch(){search.focus();},
      dispose(){disposed=true;for(const remove of off)remove();catalogue.dispose();toolbar.remove();gallery.remove();status.remove();root.className=originalClass;if(originalBusy===null)root.removeAttribute('aria-busy');else root.setAttribute('aria-busy',originalBusy);},
    };
  };

  UI.renderProofSheet=async({items,width=3840,height=2160,title='Proof sheet',background='#101419',color='#f4f5f7',font='sans-serif',signal}={})=>{
    if(!Array.isArray(items)||!items.length||items.length>48)throw Error('Choose 1–48 proof images');
    if(!Number.isInteger(width)||!Number.isInteger(height)||width<640||height<360||width>7680||height>4320)throw Error('Invalid proof sheet size');
    const canvas=document.createElement('canvas');canvas.width=width;canvas.height=height;const c=canvas.getContext('2d'),unit=width/3840,pad=64*unit,gap=24*unit,top=144*unit,caption=28*unit;
    let best;for(let cols=1;cols<=Math.min(items.length,10);cols++){const rows=Math.ceil(items.length/cols),w=Math.min((width-pad*2-gap*(cols-1))/cols,((height-top-pad-gap*(rows-1))/rows-caption)*16/9);if(w>0&&(!best||w>best.w))best={cols,rows,w};}
    if(!best)throw Error('Proof images do not fit');
    c.fillStyle=background;c.fillRect(0,0,width,height);c.fillStyle=color;c.font=`700 ${38*unit}px ${font}`;c.fillText(title,pad,64*unit);c.font=`${20*unit}px ${font}`;c.fillText(`${items.length} previews · 16:9 · ${width} × ${height}`,pad,100*unit);
    const cells=[];for(let i=0;i<items.length;i++){signal?.throwIfAborted();const item=items[i],image=new Image();image.src=item.image;await image.decode();signal?.throwIfAborted();const row=Math.floor(i/best.cols),count=Math.min(best.cols,items.length-row*best.cols),x=(width-count*best.w-(count-1)*gap)/2+(i%best.cols)*(best.w+gap),y=top+row*(best.w*9/16+caption+gap),h=best.w*9/16;
      c.fillStyle=color;c.font=`${18*unit}px ${font}`;c.fillText(item.label,x,y+20*unit,best.w);const scale=Math.min(best.w/image.naturalWidth,h/image.naturalHeight),iw=image.naturalWidth*scale,ih=image.naturalHeight*scale;c.drawImage(image,x+(best.w-iw)/2,y+caption+(h-ih)/2,iw,ih);cells.push({id:item.id,x,y:y+caption,width:best.w,height:h});
    }
    return {canvas,cells};
  };
  // Bulk controls retain native details, text, and the host's persistence owner.
  UI.createSectionActions=({root,actions,selector='details.ui-section',sprite,fill=true,iconOnly=false,onChange=()=>{}}={})=>{
    if(!root||!actions||root.ownerDocument!==actions.ownerDocument)throw new TypeError('Section actions need a root and native action group in one document');
    const originalClass=actions.className;if(fill){actions.classList?.remove('ui-inline');actions.classList?.add('ui-fill');}else actions.classList?.remove('ui-fill');actions.classList?.add('ui-actions');
    const doc=root.ownerDocument,buttons=[true,false].map(open=>{const button=doc.createElement('button');button.type='button';UI.adoptAction(button,{label:open?'Expand all':'Collapse all',icon:open?'chevron-down':'chevron-up',...(iconOnly?{iconOnly:true}:{}),...(sprite?{sprite}:{})});actions.append(button);return button;});
    const sections=()=>[...root.querySelectorAll(selector)].filter(node=>!node.closest('[hidden]'));
    const refresh=()=>{const nodes=sections();actions.hidden=!nodes.length;buttons[0].disabled=!nodes.some(node=>!node.open);buttons[1].disabled=!nodes.some(node=>node.open);};
    const set=open=>{const nodes=sections();for(const node of nodes)node.open=open;onChange({open,sections:nodes});refresh();};
    const expand=()=>set(true),collapse=()=>set(false);buttons[0].addEventListener('click',expand);buttons[1].addEventListener('click',collapse);root.addEventListener('toggle',refresh,true);UI.observeActions?.(actions);refresh();
    return {refresh,expand,collapse,dispose(){buttons[0].removeEventListener('click',expand);buttons[1].removeEventListener('click',collapse);root.removeEventListener('toggle',refresh,true);UI.releaseActions?.(actions);for(const button of buttons)button.remove();actions.className=originalClass;}};
  };
  // Inspect presented media without changing its dimensions or creative state.
  UI.createMediaViewport=({surface,content,minScale=.125,maxScale=32,keyboard=true,spacePan=true,onChange=()=>{}}={})=>{
    if(!surface||!content||surface.ownerDocument!==content.ownerDocument)throw new TypeError('Media viewport requires native nodes from one document');
    const doc=surface.ownerDocument,view=doc.defaultView,off=[],original={transform:content.style.transform,origin:content.style.transformOrigin,cursor:surface.style.cursor,tab:surface.getAttribute('tabindex')};
    if(!Number.isFinite(minScale)||!Number.isFinite(maxScale)||minScale<=0||maxScale<minScale)throw new TypeError('Use a positive bounded zoom range');
    let state={scale:1,x:0,y:0},space=false,hover=false,drag=null,disposed=false,enabled=true;
    const listen=(node,type,fn,options)=>{node.addEventListener(type,fn,options);off.push(()=>node.removeEventListener(type,fn,options));};
    const interactive=target=>target?.closest?.('button,a,input,select,textarea,summary,dialog,[contenteditable=true],.ui-actions,.cm-editor');
    const apply=next=>{if(disposed)return;state={...next};content.style.transformOrigin='center center';content.style.transform=`translate(${state.x}px,${state.y}px) scale(${state.scale})`;onChange({...state});};
    const zoom=(factor,point)=>{if(!Number.isFinite(factor)||factor<=0)return;const rect=surface.getBoundingClientRect(),x=Number.isFinite(point?.x)?point.x-rect.left-rect.width/2:0,y=Number.isFinite(point?.y)?point.y-rect.top-rect.height/2:0,scale=Math.max(minScale,Math.min(maxScale,state.scale*factor)),ratio=scale/state.scale;apply({scale,x:x-(x-state.x)*ratio,y:y-(y-state.y)*ratio});};
    const fit=()=>apply({scale:1,x:0,y:0});
    const finish=cancel=>{if(!drag)return;const prior=drag;drag=null;if(cancel)apply(prior.state);if(surface.hasPointerCapture?.(prior.id))surface.releasePointerCapture(prior.id);surface.style.cursor=space?'grab':original.cursor;};
    const resetGesture=()=>{space=false;finish(true);surface.style.cursor=original.cursor;};
    if(original.tab===null)surface.tabIndex=0;
    listen(surface,'pointerenter',()=>{hover=true;});listen(surface,'pointerleave',()=>{hover=false;});
    listen(surface,'wheel',event=>{if(!enabled||interactive(event.target))return;event.preventDefault();event.stopImmediatePropagation();const unit=event.deltaMode===1?16:event.deltaMode===2?surface.clientHeight:1;if(event.ctrlKey||event.metaKey||event.altKey)zoom(Math.exp(-Math.max(-1000,Math.min(1000,event.deltaY*unit))*.0015),{x:event.clientX,y:event.clientY});else apply({...state,x:state.x-(event.shiftKey?(event.deltaX||event.deltaY):event.deltaX)*unit,y:state.y-(event.shiftKey?0:event.deltaY)*unit});},{capture:true,passive:false});
    listen(surface,'pointerdown',event=>{if(!enabled||interactive(event.target)||!(event.button===1||event.button===0&&space))return;event.preventDefault();event.stopImmediatePropagation();surface.focus({preventScroll:true});drag={id:event.pointerId,x:event.clientX,y:event.clientY,state:{...state}};surface.setPointerCapture(event.pointerId);surface.style.cursor='grabbing';},true);
    listen(surface,'pointermove',event=>{if(!drag||drag.id!==event.pointerId)return;event.preventDefault();event.stopImmediatePropagation();apply({...state,x:drag.state.x+event.clientX-drag.x,y:drag.state.y+event.clientY-drag.y});},true);
    listen(surface,'pointerup',event=>{if(drag?.id!==event.pointerId)return;event.preventDefault();event.stopImmediatePropagation();finish(false);},true);
    for(const type of ['pointercancel','lostpointercapture'])listen(surface,type,()=>finish(true));
    listen(surface,'dblclick',event=>{if(!enabled||interactive(event.target)||event.button!==0)return;event.preventDefault();event.stopImmediatePropagation();fit();},true);
    listen(doc,'keydown',event=>{if(!enabled||!keyboard||event.defaultPrevented||interactive(event.target)||!hover&&!surface.contains(doc.activeElement))return;if(spacePan&&(event.code==='Space'||event.key===' ')){space=true;surface.style.cursor='grab';event.preventDefault();event.stopImmediatePropagation();}else if(event.target===surface){if(['0','+','=','-','Escape','ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(event.key)){event.preventDefault();event.stopImmediatePropagation();if(event.key.startsWith('Arrow')){const step=event.shiftKey?200:40;apply({...state,x:state.x+({ArrowLeft:-step,ArrowRight:step}[event.key]||0),y:state.y+({ArrowUp:-step,ArrowDown:step}[event.key]||0)});}else if(event.key==='Escape'&&drag)finish(true);else if(['0','Escape'].includes(event.key))fit();else zoom(event.key==='-'?1/1.2:1.2);}}},true);
    listen(doc,'keyup',event=>{if((event.code==='Space'||event.key===' ')&&space){space=false;surface.style.cursor=drag?'grabbing':original.cursor;event.preventDefault();event.stopImmediatePropagation();}},true);
    listen(view,'blur',resetGesture);listen(doc,'visibilitychange',()=>{if(doc.hidden)resetGesture();});
    // Safari exposes a native pinch instead of Ctrl-wheel.
    let pinch=1;
    listen(surface,'gesturestart',event=>{if(!enabled||interactive(event.target))return;event.preventDefault();event.stopImmediatePropagation();pinch=1;},{capture:true,passive:false});
    listen(surface,'gesturechange',event=>{if(!enabled||interactive(event.target))return;event.preventDefault();event.stopImmediatePropagation();zoom(event.scale/pinch,{x:event.clientX,y:event.clientY});pinch=event.scale;},{capture:true,passive:false});
    listen(surface,'gestureend',event=>{if(!enabled||interactive(event.target))return;event.preventDefault();event.stopImmediatePropagation();pinch=1;},{capture:true,passive:false});
    return {fit,zoom,setEnabled(value){resetGesture();enabled=Boolean(value);},get enabled(){return enabled;},pan:(x,y)=>apply({...state,x:state.x+x,y:state.y+y}),get state(){return {...state};},dispose(){resetGesture();disposed=true;for(const remove of off)remove();content.style.transform=original.transform;content.style.transformOrigin=original.origin;surface.style.cursor=original.cursor;if(original.tab===null)surface.removeAttribute('tabindex');}};
  };
  // Independent native panel toggles. Selection never recreates panel contents.
  UI.createPanelToggles=({items,selected=[],maxSelected=2,selectionMode='multiple',onChange=()=>{}}={})=>{
    if(!Array.isArray(items)||!items.length||items.some(x=>!x.id||!x.button||!x.panel))throw new TypeError('Panel toggles need named native buttons and panels');
    const ids=new Set(items.map(x=>x.id)),off=[];if(ids.size!==items.length||!Number.isInteger(maxSelected)||maxSelected<1)throw new TypeError('Use unique panel IDs and a positive panel limit');let active=[];
    const clean=list=>[...new Set(list)].filter(id=>ids.has(id)).slice(-Math.max(1,maxSelected));
    const set=(list,{notify=true}={})=>{active=clean(list);for(const item of items){const visible=active.includes(item.id);item.button.setAttribute('aria-pressed',String(visible));item.button.setAttribute('aria-controls',item.panel.id);item.panel.hidden=!visible;}if(notify)onChange([...active]);return [...active];};
    const show=id=>set(selectionMode==='exclusive'?[id]:[...active.filter(x=>x!==id),id]);
    for(const item of items){
      const click=(event={})=>set(selectionMode==='exclusive'&&!event.shiftKey?(active.length===1&&active[0]===item.id?[]:[item.id]):active.includes(item.id)?active.filter(x=>x!==item.id):[...active,item.id]);
      const key=event=>{if(!['ArrowLeft','ArrowRight','Home','End'].includes(event.key))return;event.preventDefault();const enabled=items.filter(x=>!x.button.disabled),index=enabled.indexOf(item);(event.key==='Home'?enabled[0]:event.key==='End'?enabled.at(-1):enabled[(index+(event.key==='ArrowRight'?1:-1)+enabled.length)%enabled.length])?.button.focus();};
      item.button.addEventListener('click',click);item.button.addEventListener('keydown',key);off.push(()=>{item.button.removeEventListener('click',click);item.button.removeEventListener('keydown',key);});
    }
    set(selected,{notify:false});return {set,show,get selected(){return [...active];},dispose(){for(const remove of off)remove();}};
  };
  // Inspector rows share name/action/value columns; original controls stay alive.
  UI.adoptPropertyRow=(row,{name,control,actions,layout='standard'}={})=>{
    if(!row||!control||row.ownerDocument!==control.ownerDocument||actions&&row.ownerDocument!==actions.ownerDocument)throw new TypeError('Property rows require controls from one document');
    if(!['standard','compact','trailing','leading-actions'].includes(layout))throw new TypeError('Unknown property row layout');
    const doc=row.ownerDocument;
    if(!actions){actions=doc.createElement('div');actions.className='ui-actions ui-inline';actions.hidden=true;}
    const input=control.matches?.('input,select,textarea')?control:control.querySelector('input,select,textarea');
    let label=row.querySelector(':scope > [data-ui-property-label]');
    if(!label){label=doc.createElement('label');label.dataset.uiPropertyLabel='';label.className='ui-label';row.prepend(label);}
    label.textContent=String(name);label.title=String(name);if(input){if(!input.id)input.id='ui-property-'+doc.defaultView.crypto.randomUUID();label.htmlFor=input.id;}
    row.classList.add('ui-property-row');Object.assign(row.style,{font:'var(--ui-control-font)',display:'grid',gridTemplateColumns:'minmax(0,min(var(--ui-property-label-width,18ch),35%)) minmax(var(--ui-property-actions-width,calc(2 * var(--ui-control-height) + var(--ui-gap))),max-content) minmax(0,1fr)',alignItems:'center',gap:'var(--ui-gap)',marginBlock:'0',minInlineSize:'0',inlineSize:'100%'});
    Object.assign(label.style,{gridColumn:'1',gridRow:'1',minInlineSize:'0',overflowWrap:'anywhere'});
    actions.dataset.uiPropertyActions='';
    Object.assign(actions.style,{gridColumn:'2',gridRow:'1',minInlineSize:'max-content',inlineSize:'max-content',maxInlineSize:'none',flexWrap:'nowrap',containerType:'normal',justifyContent:'flex-end'});
    control.dataset.uiPropertyValue='';
    Object.assign(control.style,{gridColumn:'3',gridRow:'1',minInlineSize:'0',inlineSize:'100%',maxInlineSize:'100%'});
    if(layout==='compact')Object.assign(row.style,{gridTemplateColumns:'minmax(0,var(--ui-property-label-width,8ch)) auto minmax(0,1fr)',font:'var(--ui-control-font)'});
    if(layout==='trailing'){
      row.dataset.uiPropertyLayout='trailing';
      row.style.gridTemplateColumns='minmax(0,1fr) minmax(0,var(--control-value-width,35%)) max-content';
      control.style.gridColumn='2';actions.style.gridColumn='3';
    }
    if(layout==='leading-actions'){
      row.dataset.uiPropertyLayout='leading-actions';
      row.style.gridTemplateColumns='minmax(0,1fr) max-content minmax(0,var(--control-value-width,35%))';
      actions.style.gridColumn='2';
      control.style.gridColumn='3';
    }
    if(layout==='trailing'||layout==='leading-actions'){row.style.containerType='inline-size';row.style.containerName='ui-property';}
    row.append(actions,control);return {element:row,label,control,actions};
  };
  UI.adoptPropertyAction=(row,{name,action,icon,label=name,sprite}={})=>{
    UI.adoptAction(action,{icon,label,iconOnly:false,sprite});action.dataset.uiLabel='always';
    const control=UI.adoptPropertyRow(row,{name,control:action});row.classList.add('ui-property-action');row.dataset.uiComponent='property-action';return control;
  };
  const propertyActions=new WeakMap();
  UI.setPropertyAction=(row,options={})=>{
    let label=row.querySelector('[data-ui-property-label]')||row.querySelector('.parameter-head > label,.parameter-head > strong');if(!label)return;
    let entry=propertyActions.get(row);
    if(!entry&&(typeof options.onReset==='function'||typeof options.onActivate==='function')){
      const button=row.ownerDocument.createElement('button');button.type='button';button.dataset.uiPropertyLabel='';button.dataset.uiSurface='graphic';button.className='ui-graphic-action';button.dataset.uiLabel='always';
      button.style.color=label.style.color;Object.assign(button.style,{gridColumn:'1',gridRow:'1',textAlign:'start',justifyContent:'start',justifySelf:'stretch',margin:'0',padding:'0'});
      const name=label.textContent;UI.adoptAction(button,{label:name});
      const treeIcon=[...(label.children||[])].find(child=>child.dataset.uiTreeIcon);
      if(treeIcon){button.dataset.uiTreeRow=label.dataset.uiTreeRow;button.insertBefore(treeIcon,button.firstChild);}
      label.replaceWith(button);label=button;
      entry={button,name,busy:false};
      const reset=async()=>{if(entry.busy||typeof entry.onReset!=='function')return;entry.busy=true;button.disabled=true;button.setAttribute('aria-busy','true');try{await entry.onReset();}catch(error){button.title=error.message;}finally{entry.busy=false;button.disabled=!entry.onReset&&!entry.onActivate;button.setAttribute('aria-busy','false');}};
      button.addEventListener('dblclick',()=>void reset());
      button.addEventListener('click',event=>{if(entry.busy)return;if(event.detail<=1&&entry.onActivate)entry.onActivate();else if(event.detail===0)void reset();});
      propertyActions.set(row,entry);
    }
    if(entry){
      for(const key of ['onReset','onActivate'])if(Object.hasOwn(options,key))entry[key]=options[key];
      entry.button.disabled=entry.busy||!entry.onReset&&!entry.onActivate;
      entry.button.setAttribute('aria-label',entry.onActivate?`${entry.name} — show events`:`${entry.name} — reset to default`);
      entry.button.title=entry.onActivate?`Click to show events for ${entry.name}; double-click to reset`:`Double-click to reset ${entry.name}; Enter or Space when focused`;
      if(entry.onActivate)entry.button.style.color='var(--ui-accent)';
    }
    return label;
  };
  // Canonical property action order, without replacing nodes or disturbing unchanged focus.
  UI.orderPropertyActions=group=>{
    if(!group)return;const rank={keyframe:0,fx:1},children=[...group.children];
    const ordered=children.slice().sort((a,b)=>(rank[a.dataset.uiPropertyAction]??3)-(rank[b.dataset.uiPropertyAction]??3));
    if(ordered.some((node,index)=>node!==children[index]))group.append(...ordered);
    return group;
  };
  // Automation changes the existing label, never inspector geometry or authored values.
  UI.setPropertyState=(row,{active=false,description='',color}={})=>{
    const label=row.querySelector('[data-ui-property-label]')||row.querySelector('.parameter-head > label,.parameter-head > strong');
    const driven=active||Boolean(propertyActions.get(row)?.onActivate);
    row.dataset.uiDriven=String(Boolean(driven));if(!label)return;
    label.style.color=driven?(color||'var(--ui-accent)'):'';
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
    const element=document.createElement('label');element.className=variant==='controller'?'ui-switch ui-controller-toggle':variant==='compact-box'?'ui-switch ui-box-switch':'ui-switch';
    const input=document.createElement('input');input.type='checkbox';input.setAttribute('aria-label',String(label));input.setAttribute('role','switch');
    const output=document.createElement('span');output.className='ui-label';element.append(input,output);
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
  UI.createColourValue=({label,onSet=()=>{},document=window.document}={})=>{
    const element=document.createElement('div');element.className='ui-field';
    const picker=document.createElement('input');picker.type='color';picker.setAttribute('aria-label',`Choose ${label}`);picker.style.flex='0 0 var(--ui-control-height)';picker.style.inlineSize='var(--ui-control-height)';picker.style.blockSize='calc(var(--ui-field-height) - 2px)';picker.style.padding='0';
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
  // Fullscreen a viewer container: native dialogs cannot request fullscreen.
  // Keep the open top-layer viewer and its existing media/playback intact.
  UI.createFullscreen=(button,{scope=null,target=null,media=null,sprite='/shared-ui/icons.svg'}={})=>{
    const doc=button.ownerDocument,view=doc.defaultView,removers=[];
    scope ||= button.closest('dialog')||doc.documentElement;target ||= scope===doc.documentElement?scope:scope.querySelector('[data-ui-lightbox-content]')||(scope.tagName==='DIALOG'?null:doc.documentElement);
    if(!target||target.ownerDocument!==doc||scope.ownerDocument!==doc||target.tagName==='DIALOG')throw new TypeError('Fullscreen needs a non-dialog target in the same document');
    const old={hidden:button.hidden,disabled:button.disabled,pressed:button.getAttribute('aria-pressed')};
    let disposed=false,pending=false,wanted=false,owned=false,video=null,nativeOwned=false;
    const element=()=>doc.fullscreenElement||doc.webkitFullscreenElement;
    const request=()=>typeof target.requestFullscreen==='function'&&doc.fullscreenEnabled!==false?target.requestFullscreen:typeof target.webkitRequestFullscreen==='function'&&doc.webkitFullscreenEnabled!==false?target.webkitRequestFullscreen:null;
    const active=()=>element()===target||Boolean(video?.webkitDisplayingFullscreen);
    const listen=(owner,type,fn)=>{owner.addEventListener(type,fn);removers.push(()=>owner.removeEventListener(type,fn));};
    const nativeChanged=()=>{if(!video?.webkitDisplayingFullscreen)nativeOwned=false;sync();};
    function sync(){if(disposed)return;const full=active();button.hidden=old.hidden||!request()&&typeof video?.webkitEnterFullscreen!=='function';button.disabled=old.disabled;button.setAttribute('aria-pressed',String(full));UI.adoptAction(button,{label:full?'Exit fullscreen':'Fullscreen',ariaLabel:full?'Exit fullscreen':'Fullscreen',icon:full?'fit':'fullscreen',title:full?'Exit fullscreen':'Fullscreen',sprite});}
    function refresh(){
      if(disposed)return;
      const next=typeof media==='function'?media():media||scope.querySelector('video');
      if(next!==video){if(nativeOwned)video?.webkitExitFullscreen?.();video?.removeEventListener('webkitbeginfullscreen',nativeChanged);video?.removeEventListener('webkitendfullscreen',nativeChanged);video=next;nativeOwned=false;video?.addEventListener('webkitbeginfullscreen',nativeChanged);video?.addEventListener('webkitendfullscreen',nativeChanged);}
      sync();
    }
    async function exit(){
      wanted=false;
      try{if(owned&&element()===target){const leave=doc.exitFullscreen||doc.webkitExitFullscreen;if(leave)await leave.call(doc);}if(nativeOwned)video?.webkitExitFullscreen?.();}catch(_){}finally{if(!pending||element()===target)owned=false;nativeOwned=false;sync();}
    }
    async function toggle(){
      if(disposed||pending||old.disabled)return false;
      refresh();pending=true;UI.setActionState(button,{state:'idle',sprite});sync();
      try{
        if(active()){wanted=false;const leave=doc.exitFullscreen||doc.webkitExitFullscreen;if(element()===target&&leave)await leave.call(doc);else video?.webkitExitFullscreen?.();owned=false;nativeOwned=false;}
        else{wanted=true;const enter=request();if(enter){owned=true;await enter.call(target);if(disposed||!wanted)await exit();}else if(typeof video?.webkitEnterFullscreen==='function'){nativeOwned=true;video.webkitEnterFullscreen();}else return false;}
        return true;
      }catch(_){wanted=false;owned=false;nativeOwned=false;if(!disposed)UI.setActionState(button,{state:'error',message:'Fullscreen is unavailable. Try again in a supported browser.',sprite});return false;}
      finally{pending=false;sync();}
    }
    function changed(){if(!element()&&!pending)owned=false;if(owned&&!wanted)void exit();sync();}
    function dispose(){if(disposed)return;disposed=true;void exit();for(const remove of removers)remove();video?.removeEventListener('webkitbeginfullscreen',nativeChanged);video?.removeEventListener('webkitendfullscreen',nativeChanged);button.hidden=old.hidden;button.disabled=old.disabled;if(old.pressed===null)button.removeAttribute('aria-pressed');else button.setAttribute('aria-pressed',old.pressed);}
    listen(button,'click',()=>{void toggle();});listen(doc,'fullscreenchange',changed);listen(doc,'webkitfullscreenchange',changed);listen(scope,'close',()=>{void exit();});listen(view,'pagehide',event=>{if(!event.persisted)dispose();});
    refresh();return {refresh,toggle,exit,dispose,get active(){return active();}};
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
    const trigger=summary.getBoundingClientRect(),base=panel.getBoundingClientRect(),above=Math.max(0,trigger.top-8),below=Math.max(0,view.innerHeight-trigger.bottom-8),preferAbove=menu.dataset.uiPlacement==='top'||base.bottom<=trigger.top;
    const up=preferAbove?above>=base.height||above>below:below<base.height&&above>below;
    panel.style.maxHeight=Math.max(0,Math.min(parseFloat(view.getComputedStyle(panel).maxHeight)||Infinity,up?above:below))+'px';
    const box=panel.getBoundingClientRect(),left=Math.max(8,Math.min(box.left,view.innerWidth-box.width-8)),top=up?trigger.top-box.height:trigger.bottom;
    panel.style.translate=`${left-box.left}px ${Math.max(8,top)-box.top}px`;panel.scrollTop=scrollTop;
  };
  UI.createFunctionControl=(input,{getValue=null,canScrub=()=>true,step=()=>Number(input.step)||.01,min=()=>input.min===''?-Infinity:Number(input.min),max=()=>input.max===''?Infinity:Number(input.max),snap=false}={})=>{
    if(!['number','text'].includes(input.type))throw new TypeError('Function controls require a native numeric or expression input');
    const numeric=()=>input.type==='number'?input.valueAsNumber:input.value.trim()===''?NaN:Number(input.value);
    const doc=input.ownerDocument,view=doc.defaultView,removers=[];let gesture=null,disposed=false;
    const read=value=>typeof value==='function'?value():value;
    const rounded=(value,increment,origin)=>Number((origin+Math.round((value-origin)/increment)*increment).toPrecision(12));
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
      const lower=read(min),upper=read(max),increment=Math.abs(read(step)||.01)*scale,candidate=gesture.value+dx*increment;
      gesture.value=Math.max(lower,Math.min(upper,read(snap)?rounded(candidate,increment,0):Number(candidate.toPrecision(12))));gesture.x=event.clientX;
      if(numeric()!==gesture.value){input.value=String(gesture.value);emit('input');}
    });
    listen(input,'pointerup',event=>{if(event.pointerId===gesture?.id)finish();});
    listen(input,'pointercancel',()=>finish(true));listen(input,'lostpointercapture',()=>finish(true));
    listen(doc,'keydown',event=>{if(gesture&&event.key==='Escape'){event.preventDefault();event.stopImmediatePropagation();finish(true);}});
    listen(doc,'visibilitychange',()=>{if(doc.visibilityState==='hidden')finish(true);});
    const dispose=()=>{if(disposed)return;finish(true);disposed=true;for(const remove of removers)remove();input.classList.remove('ui-function-value');};listen(view,'pagehide',event=>{if(!event.persisted)dispose();});
    return {dispose};
  };
  UI.createNumberSteppers=(input,{label='Value',step=()=>Number(input.step)||.01,onStep=()=>{}}={})=>{
    const doc=input.ownerDocument,group=doc.createElement('span'),buttons=[],handlers=[];
    group.className='ui-actions ui-inline';group.dataset.uiLayout='vertical';group.dataset.uiDensity='micro';group.setAttribute('role','group');group.setAttribute('aria-label',`${label} adjustment`);
    for(const direction of [1,-1]){
      const button=doc.createElement('button');button.type='button';button.className='ui-action';button.tabIndex=-1;button.textContent=direction>0?'▴':'▾';
      const handler=event=>{if(!input.disabled&&!input.readOnly)onStep(direction*(event.shiftKey?10:event.altKey?0.1:1),event);};
      button.addEventListener('click',handler);buttons.push(button);handlers.push(handler);group.append(button);
    }
    const sync=()=>{const amount=Number(typeof step==='function'?step():step)||.01;for(let i=0;i<buttons.length;i++){const name=(i===0?'Increase ':'Decrease ')+label+' by '+amount;buttons[i].title=name;buttons[i].setAttribute('aria-label',name);buttons[i].disabled=Boolean(input.disabled||input.readOnly);}};
    sync();
    return {element:group,sync,dispose(){for(let i=0;i<buttons.length;i++)buttons[i].removeEventListener('click',handlers[i]);group.remove();}};
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
  UI.cardColors=Object.freeze([
    ['Neutral','#ffffff'],['Changes','#c44c53'],['Review','#f3d376'],['Approved','#22c55e'],['Translucent','transparent'],
    ['Light pink','#ffb3d2'],['Peach','#ffbf94'],['Lemon','#fff18a'],['Mint','#9be5bc'],['Seafoam','#8ce3d6'],['Baby blue','#99d6ff'],['Periwinkle','#b7c3ff'],['Lilac','#d6b3ff'],['Grey','#cbd1d8'],['Sand','#e7cbb4']
  ]);
  // Native swatches share one container-sized grid in pickers, filters and inspectors.
  UI.cardColorGroups=Object.freeze([
    {label:'Default colours',choices:[UI.cardColors[0],UI.cardColors[4],...UI.cardColors.slice(1,4)]},
    {label:'Pastel colours',choices:UI.cardColors.slice(5)}
  ]);
  UI.createColorPanel=({root,document=root?.ownerDocument||window.document,label='Colours',choices=UI.cardColors,groups=null,headings=true,maxColumns=5,multiple=false,value=multiple?[]:null,onChange=()=>{}}={})=>{
    const element=root||document.createElement('div'),content=document.createElement('div'),buttons=[],listeners=[],grids=[];let values=new Set(),largest=choices.length;
    element.classList.add('ui-field','ui-grid','ui-pad');element.replaceChildren(content);
    const layout=()=>{const width=content.getBoundingClientRect().width;if(!width)return;const view=document.defaultView,min=Math.max(30,parseFloat(view.getComputedStyle(element).getPropertyValue('--ui-control-height'))||30),available=Math.max(1,Math.floor((width+6)/((view.matchMedia?.('(pointer:coarse)').matches?min:min*.8)+6))),limit=Math.min(Math.max(1,Math.floor(Number(maxColumns)||5)),available);let columns=limit;for(let n=limit;n>=Math.ceil(limit/2);n--)if(largest%n===0){columns=n;break;}const size=Math.min(min,(width-6*(columns-1))/columns);for(const grid of grids){grid.style.gridTemplateColumns=`repeat(${columns},minmax(0,${size}px))`;grid.style.justifyContent='center';}for(const button of buttons)button.style.minBlockSize=size+'px';};
    const observer=document.defaultView.ResizeObserver?new document.defaultView.ResizeObserver(layout):null;observer?.observe(element);
    element.setAttribute('role','group');element.setAttribute('aria-label',label);
    const setValue=next=>{values=new Set((Array.isArray(next)?next:next==null?[]:[next]).map(String));for(const b of buttons)b.setAttribute('aria-pressed',String(values.has(b.dataset.uiColorValue)));};
    function render(sections){for(const [b,fn]of listeners)b.removeEventListener('click',fn);listeners.length=0;buttons.length=0;grids.length=0;largest=Math.max(...(sections||[{choices}]).map(s=>s.choices.length));content.replaceChildren();content.className=sections?'ui-stack':'ui-color-palette';
      for(const section of sections||[{choices}]){let grid=content;if(sections){const group=document.createElement('section'),heading=document.createElement('h3');group.className='ui-stack';heading.className='ui-meta';heading.textContent=section.label;grid=document.createElement('div');grid.className='ui-color-palette';grid.setAttribute('role','group');grid.setAttribute('aria-label',section.label);if(headings)group.append(heading);else if(content.children.length)group.style.paddingBlockStart='var(--ui-space-3,12px)';group.append(grid);content.append(group);}
        grids.push(grid);for(const entry of section.choices){const [name,color]=Array.isArray(entry)?entry:[entry.label||entry.name||entry.value,entry.value||entry.color];const b=document.createElement('button');b.type='button';b.className='ui-swatch';b.dataset.uiColorValue=String(color);b.setAttribute('aria-label',name);b.title=name;
          const fill=UI.resolveCardColor(color);b.style.setProperty('--ui-swatch-value',`light-dark(${fill.light},${fill.dark})`);
          const click=()=>{const v=String(color);if(multiple){values.has(v)?values.delete(v):values.add(v);}else values=new Set([v]);setValue([...values]);onChange(multiple?[...values]:v);};b.addEventListener('click',click);listeners.push([b,click]);buttons.push(b);grid.append(b);
        }
      }setValue([...values]);layout();
    }
    const setChoices=next=>{choices=next;render(null);},setGroups=next=>render(next);
    render(groups);setValue(value);return {element,buttons,setValue,setChoices,setGroups,dispose(){observer?.disconnect();for(const [b,fn]of listeners)b.removeEventListener('click',fn);}};
  };
  UI.createConfirmAction=(trigger,{label='Confirm',message='Continue?',onConfirm=()=>{},sprite}={})=>{
    const doc=trigger.ownerDocument,view=doc.defaultView,panel=doc.createElement('div');panel.className='ui-panel ui-pad ui-stack';panel.popover='auto';panel.id='ui-confirm-'+view.crypto.randomUUID();panel.setAttribute('role','dialog');panel.setAttribute('aria-label',message);
    Object.assign(panel.style,{position:'fixed',margin:'0',inset:'auto',width:'min(320px,calc(100vw - 24px))'});
    const text=doc.createElement('p');text.textContent=message;const status=doc.createElement('p');status.className='ui-status';status.setAttribute('role','status');const actions=doc.createElement('div');actions.className='ui-actions ui-fill';const cancel=doc.createElement('button'),confirm=doc.createElement('button');cancel.type=confirm.type='button';UI.adoptAction(cancel,{label:'Cancel',icon:'close',sprite});UI.adoptAction(confirm,{label,icon:'check',sprite});confirm.dataset.uiVariant='danger';actions.append(cancel,confirm);panel.append(text,status,actions);doc.body.append(panel);let pressedOpen=false;
    function close(){if(panel.matches(':popover-open'))panel.hidePopover();if(trigger.isConnected)trigger.focus({preventScroll:true});}
    function open(){if(trigger.disabled||!trigger.isConnected)return;if(pressedOpen||panel.matches(':popover-open')){pressedOpen=false;return close();}status.textContent='';const owner=trigger.closest('dialog')||doc.body;if(panel.parentElement!==owner)owner.append(panel);panel.showPopover();position();cancel.focus();}
    function position(){if(!panel.matches(':popover-open'))return;const r=trigger.getBoundingClientRect(),p=panel.getBoundingClientRect();Object.assign(panel.style,{left:Math.max(12,Math.min(r.left,view.innerWidth-p.width-12))+'px',top:Math.max(12,Math.min(r.bottom+6,view.innerHeight-p.height-12))+'px'});}
    const press=()=>{pressedOpen=panel.matches(':popover-open');},toggle=()=>trigger.setAttribute('aria-expanded',String(panel.matches(':popover-open')));
    const accept=async()=>{confirm.disabled=cancel.disabled=true;try{await onConfirm();close();}catch(error){status.textContent=error.message||'Action failed';status.dataset.state='error';}finally{confirm.disabled=cancel.disabled=false;}};
    const dispose=()=>{cancel.removeEventListener('click',close);confirm.removeEventListener('click',accept);trigger.removeEventListener('pointerdown',press);panel.removeEventListener('toggle',toggle);view.removeEventListener('resize',position);doc.removeEventListener('scroll',position,true);view.removeEventListener('pagehide',dispose);panel.remove();for(const name of ['aria-haspopup','aria-controls','aria-expanded'])trigger.removeAttribute(name);};
    trigger.setAttribute('aria-haspopup','dialog');trigger.setAttribute('aria-controls',panel.id);trigger.setAttribute('aria-expanded','false');trigger.addEventListener('pointerdown',press);panel.addEventListener('toggle',toggle);cancel.addEventListener('click',close);confirm.addEventListener('click',accept);view.addEventListener('resize',position);doc.addEventListener('scroll',position,true);view.addEventListener('pagehide',dispose,{once:true});return {element:panel,open,close,dispose};
  };
  UI.createFilterButton=({element,document=element?.ownerDocument||window.document,label='Filters',sprite,onClick=()=>{}}={})=>{
    element ||= document.createElement('button');if(element.tagName==='BUTTON')element.type='button';UI.adoptAction(element,{label,icon:'filter',sprite});element.addEventListener('click',onClick);return {element,dispose(){element.removeEventListener('click',onClick);}};
  };
  UI.createColorPicker=(trigger,{value=null,onChange=()=>{},title='Card colour',placement='auto',sprite=trigger.querySelector('use')?.getAttribute('href')?.split('#')[0]}={})=>{
    const doc=trigger.ownerDocument,view=doc.defaultView,removers=[];
    const panel=doc.createElement('div');panel.className='ui-popout ui-color-picker ui-chrome';panel.popover='auto';
    panel.dataset.uiComponent='color-picker';panel.id='ui-colour-'+view.crypto.randomUUID();panel.setAttribute('role','dialog');
    const header=doc.createElement('header'),heading=doc.createElement('h2');heading.className='ui-section-title';heading.id=panel.id+'-title';heading.textContent=title;header.append(heading);panel.setAttribute('aria-labelledby',heading.id);
    const body=doc.createElement('div');body.dataset.uiPopoutBody='';body.className='ui-stack';
    const palette=UI.createColorPanel({document:doc,label:'Card colours',groups:UI.cardColorGroups,headings:false,onChange:choose});
    const buttons=palette.buttons;body.append(palette.element);
    const custom=doc.createElement('div');custom.className='';const caption=doc.createElement('span');caption.className='ui-label';caption.textContent='Custom colour';const input=doc.createElement('input');input.type='color';input.setAttribute('aria-label','Custom card colour');const customValue=doc.createElement('div');customValue.className='ui-field';customValue.append(input);custom.append(customValue);body.append(custom);UI.adoptPropertyRow(custom,{name:'Custom colour',control:customValue,layout:'compact'});
    const hexField=doc.createElement('div');hexField.className='ui-field';const hexLabel=doc.createElement('span');hexLabel.className='ui-label';hexLabel.textContent='Hex';const hex=doc.createElement('input');hex.type='text';hex.maxLength=7;hex.autocomplete='off';hex.spellcheck=false;hex.setAttribute('aria-label','Hex colour');hex.placeholder='#99d6ff';const apply=doc.createElement('button');apply.type='button';apply.textContent='Apply';const hexValue=doc.createElement('div');hexValue.className='ui-field';hexValue.append(hex,apply);hexField.className='';hexField.append(hexValue);body.append(hexField);UI.adoptPropertyRow(hexField,{name:'Hex',control:hexValue,layout:'compact'});UI.adoptAction(apply,{label:'Apply',icon:'check',iconOnly:true,sprite});
    const footer=doc.createElement('footer');footer.className='ui-actions ui-fill';const done=doc.createElement('button');done.type='button';done.textContent='Done';footer.append(done);panel.append(header,body,footer);doc.body.append(panel);
    trigger.setAttribute('aria-haspopup','dialog');trigger.setAttribute('aria-controls',panel.id);trigger.setAttribute('aria-expanded','false');
    let disposed=false,pressedOpen=false;
    function listen(node,type,fn,options){node.addEventListener(type,fn,options);removers.push(()=>node.removeEventListener(type,fn,options));}
    function setValue(next,{mixed=false}={}){if(next!==null)UI.resolveCardColor(next);value=next?.toLowerCase()??null;for(const button of buttons){const pressed=String(!mixed&&button.dataset.uiColorValue===value);if(button.getAttribute('aria-pressed')!==pressed)button.setAttribute('aria-pressed',pressed);}if(doc.activeElement!==input&&input.value!==(value||'#ffffff'))input.value=value&&value!=='transparent'?value:'#ffffff';if(doc.activeElement!==hex)hex.value=value&&value!=='transparent'?value:'#ffffff';}
    function position(){if(!panel.matches(':popover-open'))return;const r=trigger.getBoundingClientRect();if(placement==='top')panel.style.maxHeight=Math.max(100,r.top-20)+'px';const p=panel.getBoundingClientRect();if(placement==='top'){panel.style.left=Math.max(12,Math.min(r.left+r.width/2-p.width/2,view.innerWidth-p.width-12))+'px';panel.style.top=Math.max(12,r.top-p.height-8)+'px';return;}const right=r.right+10,left=right+p.width<=view.innerWidth-12?right:r.left-p.width-10;panel.style.left=Math.max(12,Math.min(left,view.innerWidth-p.width-12))+'px';panel.style.top=Math.max(12,Math.min(r.top,view.innerHeight-p.height-12))+'px';}
    function close(){if(panel.matches(':popover-open'))panel.hidePopover();}
    function open(){if(disposed||trigger.disabled)return;if(pressedOpen||panel.matches(':popover-open')){pressedOpen=false;close();return;}const owner=trigger.closest('dialog')||doc.body;if(panel.parentElement!==owner)owner.append(panel);panel.showPopover();position();(buttons.find(button=>button.getAttribute('aria-pressed')==='true')||buttons[0]).focus({preventScroll:true});}
    function choose(next){setValue(next);close();onChange(next);trigger.focus({preventScroll:true});}
    listen(trigger,'pointerdown',()=>{pressedOpen=panel.matches(':popover-open');});
    listen(panel,'keydown',event=>event.stopPropagation());
    function applyHex(){const next=hex.value.trim();const valid=/^#?[0-9a-f]{6}$/i.test(next);hex.setCustomValidity(valid?'':'Enter six hex digits, such as #99d6ff.');hex.setAttribute('aria-invalid',String(!valid));if(valid)choose((next.startsWith('#')?next:'#'+next).toLowerCase());else hex.reportValidity();}
    listen(hex,'input',()=>{hex.setCustomValidity('');hex.removeAttribute('aria-invalid');});listen(hex,'keydown',event=>{if(event.key==='Enter'){event.preventDefault();applyHex();}});listen(apply,'click',applyHex);
    listen(input,'change',()=>choose(input.value));listen(done,'click',close);
    listen(panel,'toggle',event=>{const open=event.newState==='open';trigger.setAttribute('aria-expanded',String(open));if(open){position();view.addEventListener('resize',position);doc.addEventListener('scroll',position,true);}else{view.removeEventListener('resize',position);doc.removeEventListener('scroll',position,true);if(panel.contains(doc.activeElement)||doc.activeElement===doc.body)trigger.focus({preventScroll:true});}});
    setValue(value);
    return {element:panel,open,close,setValue,dispose(){if(disposed)return;disposed=true;close();palette.dispose();view.removeEventListener('resize',position);doc.removeEventListener('scroll',position,true);for(const remove of removers)remove();panel.remove();for(const name of ['aria-haspopup','aria-controls','aria-expanded'])trigger.removeAttribute(name);}};
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
    let values=[],matches=[],active=-1,disposed=false,composing=false,editing=false;
    const removers=[];
    function on(node,type,handler){node.addEventListener(type,handler);removers.push(()=>node.removeEventListener(type,handler));}
    let pool=documents.get(doc);
    if(!pool){pool={open:new Set(),count:0,handler:event=>{for(const item of pool.open)if(!item.element.contains(event.target))item.close();}};doc.addEventListener('pointerdown',pool.handler);documents.set(doc,pool);}pool.count++;
    const control={element:wrapper,open(){input.focus();editing=false;active=-1;render();},close,dispose,setOptions};
    function close(){list.hidden=true;input.setAttribute('aria-expanded','false');input.removeAttribute('aria-activedescendant');pool.open.delete(control);}
    function render(){
      if(disposed)return;
      const query=!editing&&values.some(item=>item.label===input.value)?'':input.value.toLocaleLowerCase();matches=values.filter(item=>item.label.toLocaleLowerCase().includes(query)).slice(0,100);active=Math.min(active,matches.length-1);list.replaceChildren();
      for(const [index,item] of matches.entries()){const option=doc.createElement('span');option.className='ui-option';option.id=`${list.id}-${index}`;option.dataset.option=index;option.setAttribute('role','option');option.setAttribute('aria-selected',String(index===active));option.textContent=item.label;list.append(option);}
      list.hidden=!matches.length;input.setAttribute('aria-expanded',String(matches.length>0));status.textContent=matches.length?`${matches.length} choices`:'No matching choices';
      if(matches.length)pool.open.add(control);else pool.open.delete(control);
      if(active>=0){input.setAttribute('aria-activedescendant',`${list.id}-${active}`);list.children[active]?.scrollIntoView({block:'nearest'});}else input.removeAttribute('aria-activedescendant');
    }
    function commit(index){const item=matches[index];if(!item)return;editing=false;input.value=item.label;close();onSelect(item);input.dispatchEvent(new view.Event('change',{bubbles:true}));input.dispatchEvent(new view.CustomEvent('ui:select',{detail:item,bubbles:true}));}
    function setOptions(next){values=next.slice(0,1000).map(item=>typeof item==='string'?{value:item,label:item}:{value:String(item.value??item.label),label:String(item.label??item.value)});if(!list.hidden)render();}
    function dispose(){if(disposed)return;disposed=true;close();for(const remove of removers)remove();pool.count--;if(!pool.count){doc.removeEventListener('pointerdown',pool.handler);documents.delete(doc);}input.removeAttribute('role');input.removeAttribute('aria-autocomplete');input.removeAttribute('aria-controls');input.removeAttribute('aria-expanded');wrapper.before(input);wrapper.remove();}
    on(input,'compositionstart',()=>{composing=true;close();});on(input,'compositionend',()=>{composing=false;editing=true;active=-1;render();});
    on(input,'input',()=>{if(!composing){editing=true;active=-1;render();}});on(input,'focus',()=>{editing=false;active=-1;render();});
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
  // Suggestions for part of an existing text field; the app owns text and retrieval.
  UI.createTextSuggestions=(input,{onSelect=()=>{},label='Suggestions'}={})=>{
    const doc=input.ownerDocument,view=doc.defaultView,list=doc.createElement('div'),removers=[];
    list.className='ui-listbox';list.id='ui-text-options-'+view.crypto.randomUUID();list.setAttribute('role','listbox');list.setAttribute('aria-label',label);list.hidden=true;
    Object.assign(list.style,{position:'fixed',zIndex:'2147483647',maxBlockSize:'min(16rem,40vh)',overflow:'auto',margin:'0'});
    (input.closest?.('dialog')||doc.body).append(list);
    const attributes=['role','aria-autocomplete','aria-controls','aria-expanded','aria-activedescendant'],prior=attributes.map(key=>input.getAttribute(key));
    input.setAttribute('role','combobox');input.setAttribute('aria-autocomplete','list');input.setAttribute('aria-controls',list.id);input.setAttribute('aria-expanded','false');
    let items=[],active=0,disposed=false;
    function on(node,type,fn,options){node.addEventListener(type,fn,options);removers.push(()=>node.removeEventListener(type,fn,options));}
    function hide(){items=[];list.hidden=true;input.setAttribute('aria-expanded','false');input.removeAttribute('aria-activedescendant');}
    function draw(){
      list.replaceChildren();
      for(const [index,item] of items.entries()){
        const option=doc.createElement('span');option.className='ui-option ui-truncate';option.id=list.id+'-'+index;option.dataset.option=String(index);option.setAttribute('role','option');option.setAttribute('aria-selected',String(index===active));option.textContent=item.label;option.title=item.label;list.append(option);
      }
      list.hidden=!items.length;input.setAttribute('aria-expanded',String(Boolean(items.length)));
      if(items.length){input.setAttribute('aria-activedescendant',list.id+'-'+active);list.children[active]?.scrollIntoView?.({block:'nearest'});}
    }
    function show(next){
      if(disposed||doc.visibilityState==='hidden')return;
      items=next.slice(0,20);active=0;draw();
      const rect=input.getBoundingClientRect(),width=Math.min(rect.width,view.innerWidth-16);
      list.style.width=width+'px';list.style.left=Math.max(8,Math.min(rect.left,view.innerWidth-width-8))+'px';
      const below=view.innerHeight-rect.bottom;
      list.style.top=(below>=Math.min(list.offsetHeight,160)?rect.bottom+4:Math.max(8,rect.top-list.offsetHeight-4))+'px';
    }
    function choose(index){const item=items[index];if(!item)return;hide();onSelect(item);}
    on(input,'keydown',event=>{
      if(event.isComposing||list.hidden||event.shiftKey||event.ctrlKey||event.metaKey||event.altKey)return;
      if(!['ArrowDown','ArrowUp','Enter','Tab','Escape'].includes(event.key))return;
      event.preventDefault();event.stopImmediatePropagation();
      if(event.key==='Escape')hide();
      else if(event.key==='Enter'||event.key==='Tab')choose(active);
      else{active=(active+(event.key==='ArrowDown'?1:-1)+items.length)%items.length;draw();}
    },true);
    on(list,'pointerdown',event=>event.preventDefault());
    on(list,'click',event=>{const option=event.target.closest('[data-option]');if(option)choose(Number(option.dataset.option));});
    on(input,'blur',hide);on(input,'compositionstart',hide);
    on(doc,'pointerdown',event=>{if(event.target!==input&&!list.contains(event.target))hide();});
    on(doc,'visibilitychange',()=>{if(doc.visibilityState==='hidden')hide();});
    on(view,'resize',hide);on(doc,'scroll',event=>{if(!list.contains(event.target))hide();},true);
    function dispose(){if(disposed)return;hide();disposed=true;for(const remove of removers)remove();list.remove();attributes.forEach((key,i)=>prior[i]===null?input.removeAttribute(key):input.setAttribute(key,prior[i]));}
    on(view,'pagehide',event=>{hide();if(!event.persisted)dispose();});
    return {show,hide,dispose,element:list};
  };
  // Native, keyboard-operable hue/saturation picker with optional multiple nodes.
  UI.createColorWheel=({root,values=[],choices=[],multiple=false,label='Colour wheel',onChange=()=>{}}={})=>{
    if(!root?.ownerDocument)throw new TypeError('Colour wheel needs a native root');
    const doc=root.ownerDocument,view=doc.defaultView,size=240,button=doc.createElement('button'),canvas=doc.createElement('canvas'),selected=doc.createElement('div'),status=doc.createElement('span'),accentProbe=doc.createElement('span');
    const normalize=value=>/^#[\da-f]{6}$/i.test(String(value))?String(value).toLowerCase():null;
    const palette=[...new Set(choices.map(normalize).filter(Boolean))];let colors=[],cursor={h:0,s:1},disposed=false,selectionSignature=null,drag=null,suppressClick=false,hovered=false;
    const rgb=hex=>[1,3,5].map(i=>parseInt(hex.slice(i,i+2),16));
    function hsv(hex){const [r,g,b]=rgb(hex).map(v=>v/255),max=Math.max(r,g,b),min=Math.min(r,g,b),d=max-min;return{h:!d?0:((max===r?(g-b)/d+(g<b?6:0):max===g?(b-r)/d+2:(r-g)/d+4)*60),s:max?d/max:0};}
    function hex(h,s){const c=s,x=c*(1-Math.abs(h/60%2-1)),m=1-c,parts=h<60?[c,x,0]:h<120?[x,c,0]:h<180?[0,c,x]:h<240?[0,x,c]:h<300?[x,0,c]:[c,0,x];return '#'+parts.map(v=>Math.round((v+m)*255).toString(16).padStart(2,'0')).join('');}
    function nearest(color){if(!palette.length)return color;const a=rgb(color);return palette.reduce((best,next)=>{const distance=value=>rgb(value).reduce((sum,v,i)=>sum+(v-a[i])**2,0);return distance(next)<distance(best)?next:best;});}
    const background=doc.createElement('canvas');background.width=background.height=size;
    const paint=background.getContext('2d'),pixels=paint.createImageData(size,size);
    for(let y=0;y<size;y++)for(let x=0;x<size;x++){const dx=(x-size/2)/(size/2-12),dy=(y-size/2)/(size/2-12),s=Math.hypot(dx,dy),i=(y*size+x)*4;if(s>1)continue;const color=rgb(hex((Math.atan2(dy,dx)*180/Math.PI+360)%360,s));pixels.data.set([...color,255],i);}
    paint.putImageData(pixels,0,0);canvas.width=canvas.height=size;canvas.setAttribute('aria-hidden','true');Object.assign(canvas.style,{display:'block',inlineSize:'100%',aspectRatio:'1'});
    button.type='button';button.className='ui-action';button.title='Click to add/remove a colour; drag a node to adjust it. Arrows choose hue/saturation; Enter toggles; Escape cancels a drag.';Object.assign(button.style,{display:'block',inlineSize:'100%',maxInlineSize:'100%',touchAction:'none'});button.append(canvas);
    selected.className='ui-actions';selected.setAttribute('aria-label','Selected colours');status.className='ui-meta ui-truncate';status.setAttribute('role','status');status.setAttribute('aria-live','polite');accentProbe.hidden=true;accentProbe.style.color='var(--ui-accent)';root.classList.add('ui-stack');Object.assign(root.style,{inlineSize:'100%',minInlineSize:'0'});root.dataset.uiComponent='colour-wheel';root.append(button,status,selected,accentProbe);
    function point(value){const c=hsv(value),a=c.h*Math.PI/180;return{x:size/2+Math.cos(a)*c.s*(size/2-12),y:size/2+Math.sin(a)*c.s*(size/2-12)};}
    function draw(){
      const ctx=canvas.getContext('2d');ctx.clearRect(0,0,size,size);ctx.drawImage(background,0,0);
      // Resolve light-dark()/variable tokens through native CSS before Canvas paint.
      const ink=view.getComputedStyle(root).color||'#fff',accent=view.getComputedStyle(accentProbe).color||ink;
      ctx.beginPath();ctx.arc(size/2,size/2,size/2-10,0,Math.PI*2);ctx.lineWidth=1.5;ctx.strokeStyle=ink;ctx.stroke();
      for(const value of colors){const p=point(value);ctx.beginPath();ctx.arc(p.x,p.y,value===drag?.value?10:7,0,Math.PI*2);ctx.fillStyle=value;ctx.fill();ctx.lineWidth=4;ctx.strokeStyle=ink;ctx.stroke();ctx.lineWidth=2;ctx.strokeStyle=accent;ctx.stroke();}
      const value=nearest(hex(cursor.h,cursor.s)),p=point(value);ctx.beginPath();ctx.arc(p.x,p.y,hovered||drag?10:3,0,Math.PI*2);ctx.lineWidth=2;ctx.strokeStyle=accent;ctx.stroke();
      button.setAttribute('aria-label',`${label}; ${colors.length} selected; hue ${Math.round(cursor.h)}, saturation ${Math.round(cursor.s*100)} percent`);
      const feedback=`${colors.length?colors.length+' selected':'All colours'} · ${hovered||drag?value:'Click to add · drag to adjust'}`;if(status.textContent!==feedback)status.textContent=feedback;
      const signature=colors.join(',');if(signature!==selectionSignature){selectionSignature=signature;selected.replaceChildren();for(const color of colors){const remove=doc.createElement('button');remove.type='button';remove.className='ui-tag';remove.textContent=color+' ×';remove.setAttribute('aria-label','Remove colour '+color);remove.onclick=()=>{change(colors.filter(v=>v!==color));button.focus({preventScroll:true});};selected.append(remove);}}selected.hidden=!colors.length;
    }
    function setValues(next){if(disposed)return;colors=[...new Set(next.map(normalize).filter(Boolean).map(nearest))].slice(0,multiple?32:1);draw();}
    function change(next){if(disposed)return;const before=colors.join(',');setValues(next);if(before!==colors.join(','))onChange([...colors]);}
    function toggle(value){value=nearest(value);change(colors.includes(value)?colors.filter(v=>v!==value):multiple?[...colors,value]:[value]);}
    function position(event){const r=canvas.getBoundingClientRect();if(!r.width||!r.height)return null;const x=(event.clientX-r.left)/r.width*size,y=(event.clientY-r.top)/r.height*size,dx=(x-size/2)/(size/2-12),dy=(y-size/2)/(size/2-12);return{x,y,inside:Math.hypot(dx,dy)<=1,h:(Math.atan2(dy,dx)*180/Math.PI+360)%360,s:Math.min(1,Math.hypot(dx,dy)),hit:colors.find(value=>{const p=point(value);return Math.hypot(p.x-x,p.y-y)<=Math.max(12,12*size/r.width);})};}
    function aim(p){cursor={h:p.h,s:p.s};hovered=p.inside;}
    function click(event){if(disposed)return;if(suppressClick&&event.detail){suppressClick=false;return;}suppressClick=false;if(!event.detail){toggle(hex(cursor.h,cursor.s));return;}const p=position(event);if(!p?.inside)return;aim(p);toggle(p.hit||hex(cursor.h,cursor.s));}
    function down(event){if(disposed||drag||event.button!==0||event.isPrimary===false)return;const p=position(event);if(!p?.inside)return;event.preventDefault();button.focus({preventScroll:true});aim(p);drag={id:event.pointerId,original:[...colors],index:p.hit?colors.indexOf(p.hit):multiple?colors.length:0,hit:p.hit,value:p.hit,x:event.clientX,y:event.clientY,moved:false};button.setPointerCapture?.(event.pointerId);draw();}
    function move(event){if(disposed||drag&&event.pointerId!==drag.id)return;const p=position(event);if(!p)return;aim(p);button.style.cursor=p.hit?'grab':'crosshair';if(drag){event.preventDefault();drag.moved ||= Math.hypot(event.clientX-drag.x,event.clientY-drag.y)>3;if(drag.moved){const next=[...drag.original];drag.value=nearest(hex(cursor.h,cursor.s));next[drag.index]=drag.value;button.style.cursor='grabbing';change(next);return;}}draw();}
    function end(event,cancel=false){if(!drag||event&&event.pointerId!==drag.id)return;const prior=drag;drag=null;if(cancel){if(prior.moved)change(prior.original);}else{if(!prior.moved)toggle(prior.hit||hex(cursor.h,cursor.s));suppressClick=true;}if(button.hasPointerCapture?.(prior.id))button.releasePointerCapture(prior.id);button.style.cursor='crosshair';draw();}
    function key(event){if(event.key==='Escape'&&drag){event.preventDefault();event.stopPropagation();end(null,true);return;}if(!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','Enter',' ','Home','Delete','Backspace'].includes(event.key))return;event.preventDefault();event.stopPropagation();const step=event.shiftKey?15:5;if(event.key==='ArrowLeft'||event.key==='ArrowRight')cursor.h=(cursor.h+(event.key==='ArrowRight'?step:-step)+360)%360;else if(event.key==='ArrowUp'||event.key==='ArrowDown')cursor.s=Math.max(0,Math.min(1,cursor.s+(event.key==='ArrowUp'?step:-step)/100));else if(event.key==='Home')cursor={h:0,s:1};else if(event.key==='Delete'||event.key==='Backspace'){change(colors.filter(v=>v!==nearest(hex(cursor.h,cursor.s))));return;}else{toggle(hex(cursor.h,cursor.s));return;}draw();}
    const off=[];function on(target,type,handler){target.addEventListener(type,handler);off.push(()=>target.removeEventListener(type,handler));}
    on(button,'click',click);on(button,'keydown',key);on(button,'pointerdown',down);on(button,'pointermove',move);on(button,'pointerup',event=>end(event));on(button,'pointercancel',event=>end(event,true));on(button,'lostpointercapture',event=>end(event,true));on(button,'pointerleave',()=>{hovered=false;if(!drag)draw();});on(doc,'visibilitychange',()=>{if(doc.hidden)end(null,true);});on(view,'pagehide',()=>end(null,true));setValues(values);
    return {element:root,get values(){return [...colors];},setValues,clear:()=>change([]),dispose(){if(disposed)return;end(null,true);disposed=true;for(const remove of off)remove();button.remove();selected.remove();status.remove();accentProbe.remove();background.width=background.height=1;canvas.width=canvas.height=1;}};
  };
  UI.createSuggestedInput=(input,{options=()=>[],excluded=()=>[],onCommit=()=>{},limit=6,label='Suggestions',separator=null,tags=false}={})=>{
    const doc=input.ownerDocument,view=doc.defaultView,list=doc.createElement('div'),slot=doc.createElement('div'),removers=[];
    const attributes=['role','aria-autocomplete','aria-controls','aria-expanded','aria-activedescendant','autocomplete','enterkeyhint'],prior=attributes.map(name=>input.getAttribute(name));
    slot.className='ui-listbox';Object.assign(slot.style,{position:'fixed',zIndex:'2147483647',margin:'0',maxBlockSize:'min(16rem,40vh)'});slot.append(list);list.className=tags?'ui-tags':'ui-stack';list.id=`${input.id||view.crypto.randomUUID()}-suggestions`;list.setAttribute('role','listbox');list.setAttribute('aria-label',label);
    (input.closest('dialog')||doc.body).append(slot);
    for(const [name,value] of Object.entries({role:'combobox','aria-autocomplete':'list','aria-controls':list.id,autocomplete:'off',enterkeyhint:'done'}))input.setAttribute(name,value);
    let matches=[],active=-1,disposed=false,composing=false;
    function on(node,type,handler,options){node.addEventListener(type,handler,options);removers.push(()=>node.removeEventListener(type,handler,options));}
    function hide(){slot.hidden=true;list.hidden=true;input.setAttribute('aria-expanded','false');input.removeAttribute('aria-activedescendant');}
    function draw(){
      if(disposed||composing||doc.hidden)return;
      const query=input.value.trim().toLocaleLowerCase(),selected=new Set(excluded().map(tag=>tag.toLocaleLowerCase()));
      matches=options().filter(tag=>!selected.has(tag.toLocaleLowerCase())&&tag.toLocaleLowerCase().startsWith(query)).slice(0,limit);active=Math.min(active,matches.length-1);list.replaceChildren();
      matches.forEach((tag,index)=>{const button=doc.createElement('button');button.type='button';button.className=tags?'ui-tag':'ui-action';button.textContent=tag;if(!tags)UI.adoptAction(button,{label:tag});button.id=`${list.id}-${index}`;button.setAttribute('role','option');button.setAttribute('aria-selected',String(index===active));button.tabIndex=-1;
        button.addEventListener('pointerdown',event=>event.preventDefault());button.addEventListener('click',()=>{commit(tag);input.focus();});list.append(button);});
      slot.hidden=!matches.length;list.hidden=!matches.length;
      if(matches.length){const rect=(input.closest('.ui-field')||input).getBoundingClientRect(),width=Math.min(rect.width,view.innerWidth-16);slot.style.width=width+'px';slot.style.left=Math.max(8,Math.min(rect.left,view.innerWidth-width-8))+'px';slot.style.top=(view.innerHeight-rect.bottom>=Math.min(slot.offsetHeight,160)?rect.bottom+4:Math.max(8,rect.top-slot.offsetHeight-4))+'px';}input.setAttribute('aria-expanded',String(Boolean(matches.length)));
      if(matches.length&&active>=0)input.setAttribute('aria-activedescendant',`${list.id}-${active}`);else input.removeAttribute('aria-activedescendant');
    }
    function commit(value){if(!value.trim())return;input.value='';active=-1;hide();onCommit(value);}
    function handleKey(event){
      if(composing||event.isComposing||event.shiftKey||event.ctrlKey||event.metaKey||event.altKey)return;
      if(event.key==='Escape'&&!list.hidden){event.preventDefault();event.stopPropagation();hide();return;}
      if(['ArrowDown','ArrowUp'].includes(event.key)){event.preventDefault();active=active<0?(event.key==='ArrowDown'?0:matches.length-1):(active+(event.key==='ArrowDown'?1:-1)+matches.length)%(matches.length||1);draw();}
      if(event.key==='Enter'||separator&&event.key===separator){event.preventDefault();event.stopPropagation();commit(event.key==='Enter'&&!list.hidden&&active>=0?matches[active]:input.value);}
    }
    on(input,'input',()=>{active=-1;draw();});on(input,'focus',draw);on(input,'blur',hide);on(input,'keydown',handleKey);
    on(input,'compositionstart',()=>{composing=true;hide();});on(input,'compositionend',()=>{composing=false;draw();});
    on(doc,'pointerdown',event=>{if(event.target!==input&&!slot.contains(event.target))hide();});on(view,'resize',hide);on(doc,'scroll',event=>{if(!slot.contains(event.target))hide();},true);on(doc,'visibilitychange',()=>{if(doc.hidden)hide();});on(view,'pagehide',event=>{hide();if(!event.persisted)dispose();});
    on(input,'paste',event=>{const value=event.clipboardData?.getData('text');if(separator&&value?.includes(separator)){event.preventDefault();commit(value);}});
    function dispose(){if(disposed)return;disposed=true;hide();for(const remove of removers)remove();slot.remove();attributes.forEach((name,i)=>prior[i]===null?input.removeAttribute(name):input.setAttribute(name,prior[i]));}
    hide();return {element:list,hide,draw,handleKey,flush:()=>commit(input.value),dispose};
  };
  UI.createTagInput=(input,{field, chips,layout='inline',...options}={})=>{
    if(!['inline','stacked','wrap','field'].includes(layout))throw new TypeError('Unknown tag field layout');
    // Keep declared tag slots stable; suggestions retain their overlay ownership.
    let layoutState=[],chipObserver,chipPlacement,fieldShell;const chipStyles=new Map();
    const wrapChips=()=>{for(const node of chips.querySelectorAll('.ui-tag,.ui-tag .ui-label')){if(!chipStyles.has(node))chipStyles.set(node,node.getAttribute('style'));Object.assign(node.style,{whiteSpace:'normal',overflowWrap:'anywhere'});}};
    if(field&&chips){const entry=input.closest('.ui-field')||input;layoutState=[field,entry,chips].map(node=>({node,style:node.getAttribute('style')}));Object.assign(field.style,{display:'flex',flexWrap:'nowrap',gap:'var(--ui-gap)',minInlineSize:'0'});Object.assign(entry.style,{minInlineSize:'0',inlineSize:'100%',flex:'1 1 14ch'});Object.assign(chips.style,{flex:'0 1 auto',maxInlineSize:'50%',flexWrap:'nowrap',overflowX:'auto',minInlineSize:'0'});if(entry!==field)field.prepend(entry);
      if(layout==='stacked'){
        Object.assign(field.style,{display:'grid',gridTemplateColumns:'minmax(0,1fr)',gridTemplateRows:'var(--ui-field-height) calc(max(var(--ui-tag-height), var(--ui-control-height)) + 18px)',alignItems:'start'});
        Object.assign(entry.style,{gridRow:'1',flex:'none',blockSize:'var(--ui-field-height)'});
        Object.assign(chips.style,{display:'flex',gridRow:'2',inlineSize:'100%',maxInlineSize:'100%',blockSize:'100%',alignItems:'start',flex:'none'});
      }else if(layout==='wrap'||layout==='field'){
        Object.assign(field.style,{display:'grid',gridTemplateColumns:'minmax(0,1fr)',gridTemplateRows:'auto auto',alignItems:'start'});
        Object.assign(entry.style,{gridRow:'1',flex:'none',minBlockSize:'var(--ui-field-height)'});
        Object.assign(chips.style,{display:'flex',gridRow:'2',inlineSize:'100%',maxInlineSize:'100%',flex:'none',flexWrap:'wrap',alignItems:'start',maxBlockSize:'var(--ui-tag-list-height,calc(3 * var(--ui-control-height) + 2 * var(--ui-gap)))',overflowX:'hidden',overflowY:'auto'});
        if(layout==='field'){
          if(entry===input)throw new TypeError('Composed tag entry requires a native ui-field shell');
          fieldShell={node:entry,value:entry.getAttribute('data-ui-tag-field')};entry.setAttribute('data-ui-tag-field','');chipPlacement={parent:chips.parentNode,next:chips.nextSibling};layoutState.push({node:input,style:input.getAttribute('style')});
          Object.assign(field.style,{display:'block'});Object.assign(entry.style,{display:'flex',flexWrap:'wrap',alignItems:'center',gap:'var(--ui-gap)',inlineSize:'100%',maxInlineSize:'100%'});
          // Committed pills and the trailing native entry share one wrapping flow.
          // A contents slot keeps removal handlers and the caller's chip owner intact.
          Object.assign(entry.style,{maxBlockSize:'var(--ui-tag-list-height,calc(3 * max(var(--ui-tag-height),var(--ui-control-height)) + 4 * var(--ui-gap)))',overflowX:'hidden',overflowY:'auto',paddingBlock:'var(--ui-gap)'});
          Object.assign(input.style,{flex:'1 1 12ch',inlineSize:'auto',minInlineSize:'min(100%,12ch)',maxInlineSize:'100%'});
          Object.assign(chips.style,{display:'contents'});entry.prepend(chips);
        }
        wrapChips();const Observer=input.ownerDocument.defaultView.MutationObserver;if(Observer){chipObserver=new Observer(wrapChips);chipObserver.observe(chips,{childList:true,subtree:true});}
      }
    }
    const control=UI.createSuggestedInput(input,{...options,tags:true,separator:',',label:'Suggested tags'}),dispose=control.dispose;let restored=false;
    control.dispose=()=>{if(restored)return;restored=true;chipObserver?.disconnect();dispose();if(fieldShell){fieldShell.value===null?fieldShell.node.removeAttribute('data-ui-tag-field'):fieldShell.node.setAttribute('data-ui-tag-field',fieldShell.value);}if(chipPlacement)chipPlacement.parent.insertBefore(chips,chipPlacement.next?.parentNode===chipPlacement.parent?chipPlacement.next:null);for(const [node,style]of chipStyles)style===null?node.removeAttribute('style'):node.setAttribute('style',style);for(const {node,style}of layoutState)style===null?node.removeAttribute('style'):node.setAttribute('style',style);};return control;
  };
  function activate(tab){const group=tab.closest('[data-ui-tabs]');if(!group)return;
    for(const item of group.querySelectorAll('[role=tab]')){const selected=item===tab;item.setAttribute('aria-selected',String(selected));item.tabIndex=selected?0:-1;const panel=document.getElementById(item.getAttribute('aria-controls'));if(panel)panel.hidden=!selected;}
  }
  document.addEventListener('click',event=>{const tab=event.target.closest?.('[data-ui-tabs] [role=tab]');if(tab)activate(tab);});
  document.addEventListener('keydown',event=>{const tab=event.target.closest?.('[data-ui-tabs] [role=tab]');if(!tab)return;const tabs=[...tab.closest('[data-ui-tabs]').querySelectorAll('[role=tab]:not(:disabled)')],index=tabs.indexOf(tab);let next;
    if(event.key==='ArrowRight'||event.key==='ArrowDown')next=tabs[(index+1)%tabs.length];else if(event.key==='ArrowLeft'||event.key==='ArrowUp')next=tabs[(index-1+tabs.length)%tabs.length];else if(event.key==='Home')next=tabs[0];else if(event.key==='End')next=tabs.at(-1);
    if(next){event.preventDefault();activate(next);next.focus();}
  });



})();

/* Fit registered native groups on size changes, without rebuilding app controls. */
(() => {
  'use strict';
  if(typeof window==='undefined'||!window.SharedUI)return;
  const UI=window.SharedUI,pools=new WeakMap();
  const actionSelector='.ui-action',overflowSelector='details.ui-overflow';
  const fixedLabel='[data-ui-label=hidden],[data-ui-label=always],.ui-item,.ui-menu-panel .ui-action';
  const number=value=>parseFloat(value)||0;
  function poolFor(doc){
    if(pools.has(doc))return pools.get(doc);
    const view=doc.defaultView,groups=new Map(),pending=new Set(),targets=new Map(),removers=[],compactStyles=new Map();
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
      const essential=node.dataset.uiLabel==='always'||node.matches('.ui-item')||Boolean(node.closest('.ui-menu-panel'))&&node.dataset.uiLabel!=='hidden';
      const hidden=!essential&&(compact||node.dataset.uiLabel==='hidden'||css.getPropertyValue?.('--ui-action-caption').trim()==='none');
      const glyph=number(style(icon).width)||18;
      const toggle=node.matches('.ui-toggle')?node.querySelector(':scope > input'):null;
      const extra=(node.tagName==='SUMMARY'&&!node.parentElement.matches(overflowSelector)?14:0)+(toggle?outer(toggle)+number(css.columnGap):0);
      const inset=number(css.getPropertyValue?.('--ui-control-inset'))||number(css.paddingLeft);
      const padding=hidden?Math.max(0,(number(css.minWidth)-glyph-2)/2):inset;
      return Math.max(number(css.minWidth),(css.flexDirection==='column'?Math.max(glyph,hidden?0:caption(label)):glyph+(hidden?0:caption(label)+number(css.columnGap)))+extra+padding*2+2)+margins(css);
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
      if(isAction(node))return actionWidth(node,(compact===true||compact instanceof Set&&compact.has(node))&&eligible(node));
      if(node.matches('.ui-field'))return fieldWidth(node,(compact===true||compact instanceof Set&&compact.has(node))&&eligible(node));
      if(node.tagName==='DETAILS'){const summary=node.querySelector(':scope > summary');if(summary&&isAction(summary))return actionWidth(summary,(compact===true||compact instanceof Set&&compact.has(summary))&&eligible(summary));}
      if(node.matches('.ui-actions.ui-inline,[data-ui-layout=inline]')||style(node).display==='contents')return rowWidth(children(node),style(node),compact,collapsed,node.matches('.ui-fill'));
      const css=style(node),basis=number(css.flexBasis);if(number(css.flexGrow)>0)return Math.max(number(css.minWidth),basis||caption(node)+sides(css))+margins(css);
      // The header identity's auto margin is leftover space, not caption width.
      if(node.parentElement?.matches('.ui-header')&&node===children(node.parentElement)[0]&&!node.matches('.ui-actions,.ui-action,.ui-field,button,details'))return node.getBoundingClientRect().width;
      return outer(node);
    }
    function rowWidth(nodes,css,compact,collapsed,equal=false){const widths=nodes.map(node=>width(node,compact,collapsed));
      const fixed=equal&&compact instanceof Set?nodes.map((node,i)=>compact.has(node)&&node.hasAttribute('data-ui-compact-priority')?i:-1).filter(i=>i>=0):[];
      return (equal?fixed.reduce((sum,i)=>sum+widths[i],0)+Math.max(0,...widths.filter((_,i)=>!fixed.includes(i)))*(nodes.length-fixed.length):widths.reduce((sum,value)=>sum+value,0))+number(css.columnGap)*Math.max(0,nodes.length-1);
    }
    function descendants(nodes){return nodes.flatMap(node=>node.matches(overflowSelector)?descendants(contents(node)):node.matches('.ui-actions.ui-inline,[data-ui-layout=inline]')?descendants(children(node)):node.tagName==='DETAILS'?[node.querySelector(':scope > summary')].filter(Boolean):[node]);}
    function priorities(nodes){return nodes.flatMap(node=>node.matches(overflowSelector)?[node]:node.matches('.ui-actions.ui-inline,[data-ui-layout=inline]')?priorities(children(node)):[]);}
    function restoreCompact(node){const values=compactStyles.get(node);if(!values)return;for(const [name,value,priority]of values)value?node.style.setProperty(name,value,priority):node.style.removeProperty(name);compactStyles.delete(node);}
    function smallAction(node){if(!isAction(node)||!node.style?.setProperty)return;const values=['size','icon','flow'].map(name=>'--ui-action-'+name);compactStyles.set(node,values.map(name=>[name,node.style.getPropertyValue(name),node.style.getPropertyPriority(name)]));['0px','var(--ui-control-icon,min(18px, calc(var(--ui-control-height) - 2px)))','row'].forEach((value,i)=>node.style.setProperty(values[i],value));}
    function setCompact(node,value){if(value){if(!node.hasAttribute('data-ui-compact'))node.setAttribute('data-ui-compact','');}else if(node.hasAttribute('data-ui-compact'))node.removeAttribute('data-ui-compact');}
    function untrack(group){const item=groups.get(group);if(!item)return;for(const node of compactStyles.keys())if(group.contains?.(node))restoreCompact(node);groups.delete(group);pending.delete(group);const count=targets.get(item.target)-1;if(count)targets.set(item.target,count);else{targets.delete(item.target);observer.unobserve(item.target);}}
    function queue(group){if(disposed||paused)return;pending.add(group);if(!frame)frame=view.requestAnimationFrame(flush);}
    function fit(group,item){
      if(!group.isConnected){untrack(group);return;}
      // Overflow contents are governed by their outer group, including while closed.
      if(group.closest(overflowSelector))return;
      const owner=group.parentElement;if(group.matches('.ui-inline,[data-ui-layout=inline]')&&owner?.matches('.ui-actions,.ui-toolbar')&&owner.dataset.uiLayout!=='vertical'&&style(owner).flexDirection!=='column'){untrack(group);register(owner);return;}
      const css=style(group),nodes=children(group).filter(node=>!['absolute','fixed'].includes(style(node).position)),actions=descendants(nodes).filter(eligible);
      for(const node of descendants(nodes).filter(node=>node.matches('[data-ui-label=always],.ui-item'))){restoreCompact(node);setCompact(node,false);}
      for(const node of actions)restoreCompact(node);
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
        }else{
          // An intrinsic dock may still be icon-sized after growing. Its explicit
          // pixel cap is the available slot; measuring its compact width locks it.
          const cap=css.maxWidth?.endsWith('px')?number(css.maxWidth):available;
          available=Math.min(available,cap||available);
        }
        available-=margins(css)+sides(css);
      }
      const collapsed=new Set(),limit=Math.max(0,available-2);
      const required=mode=>rowWidth(nodes,css,mode,collapsed,group.matches('.ui-fill'));
      let compact=!vertical&&required(false)>limit;
      if(compact&&actions.some(node=>node.hasAttribute('data-ui-compact-priority'))){
        const chosen=new Set(),ranks=[...new Set(actions.map(node=>node.hasAttribute('data-ui-compact-priority')?number(node.dataset.uiCompactPriority):Infinity))].sort((a,b)=>a-b);
        for(const rank of ranks){for(const node of actions)if((node.hasAttribute('data-ui-compact-priority')?number(node.dataset.uiCompactPriority):Infinity)===rank)chosen.add(node);if(required(chosen)<=limit)break;}
        compact=chosen;
      }
      // Large appearance gives way only when even its icon targets cannot fit.
      // Restore first on every fit so growing containers regain the saved appearance.
      if(compact&&required(compact)>limit)for(const node of actions)smallAction(node);
      for(const node of actions)setCompact(node,compact===true||compact instanceof Set&&compact.has(node));
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
    function flush(){frame=0;const work=[...pending];pending.clear();for(const group of work){const item=groups.get(group);if(item)fit(group,item);}for(const group of groups.keys())if(!group.isConnected)untrack(group);for(const menu of doc.querySelectorAll?.('details.ui-menu[open]')||[])UI.positionMenu?.(menu);}
    const observer=new view.ResizeObserver(entries=>{
      for(const entry of entries)for(const [group,item]of groups)if(item.target===entry.target){const box=entry.target.getBoundingClientRect();if(box.width!==item.width||box.height!==item.height)queue(group);}
    });
    function register(group){
      if(!group||disposed||group.closest(overflowSelector))return;
      // A horizontal row owns its intrinsic subgroups. Registering both lets a
      // child's later fit undo the parent's caption mode and creates outliers.
      const parent=group.parentElement;
      if(group.matches('.ui-inline,[data-ui-layout=inline]')&&parent?.matches('.ui-actions,.ui-toolbar')&&parent.dataset.uiLayout!=='vertical'&&style(parent).flexDirection!=='column'){untrack(group);register(parent);return;}
      const target=group.matches('.ui-inline,[data-ui-layout=inline]')?group.parentElement:group;if(!target)return;
      let item=groups.get(group);
      // Native toolbars can be adopted before a context dock relocates them.
      // Follow their current container instead of retaining the original slot.
      if(item&&item.target!==target){untrack(group);item=null;}
      if(!item){item={target,width:-1,height:-1};groups.set(group,item);targets.set(target,(targets.get(target)||0)+1);if(!paused)observer.observe(target);}
      queue(group);
    }
    function refresh(){for(const group of groups.keys())queue(group);}
    function suspend(){paused=true;observer.disconnect();view.cancelAnimationFrame(frame);frame=0;pending.clear();}
    function resume(){if(disposed||doc.visibilityState==='hidden')return;paused=false;for(const group of groups.keys())if(!group.isConnected)untrack(group);for(const target of targets.keys())observer.observe(target);refresh();}
    function on(target,type,handler,capture=false){target.addEventListener(type,handler,capture);removers.push(()=>target.removeEventListener(type,handler,capture));}
    function dispose(){if(disposed)return;disposed=true;suspend();for(const remove of removers)remove();for(const node of compactStyles.keys())restoreCompact(node);groups.clear();targets.clear();pools.delete(doc);}
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


// A response curve is one property value until deliberately opened. The full
// editor is the same native control in a bounded, keyboard-accessible popover.
UI.createCurveValue=(options={})=>{
  const doc=options.document||window.document,label=options.label||'Response';
  let points=[...(options.points||[1/3,0,2/3,1])],disposed=false;
  const element=doc.createElement('button');element.type='button';element.className='ui-curve-value ui-action';
  element.setAttribute('aria-label','Edit '+label+' curve');element.title='Edit '+label+' curve';
  const preview=doc.createElementNS('http://www.w3.org/2000/svg','svg');preview.setAttribute('viewBox','0 0 50 22');preview.setAttribute('aria-hidden','true');
  Object.assign(preview.style,{inlineSize:'50px',blockSize:'22px',flex:'none',overflow:'visible'});
  const path=doc.createElementNS('http://www.w3.org/2000/svg','path');path.setAttribute('fill','none');path.setAttribute('stroke','var(--ui-accent)');path.setAttribute('stroke-width','1.5');preview.append(path);
  const caption=doc.createElement('span');caption.className='ui-label';caption.textContent='Edit curve';
  Object.assign(element.style,{display:'flex',alignItems:'center',justifyContent:'space-between',gap:'var(--ui-gap)',minInlineSize:'0'});element.append(preview,caption);
  const panel=doc.createElement('article');panel.className='ui-popout';panel.setAttribute('role','dialog');panel.setAttribute('aria-label',label+' curve');panel.style.setProperty('--ui-popout-width','23rem');
  const header=doc.createElement('header'),title=doc.createElement('h5'),close=doc.createElement('button');title.textContent=label;close.type='button';
  UI.adoptAction(close,{label:'Close curve editor',icon:'close',iconOnly:true,sprite:options.sprite});header.append(title,close);
  const body=doc.createElement('div');body.dataset.uiPopoutBody='';
  const editor=UI.createCurveControl({...options,document:doc,onChange(next,commit){points=[...next];paint();return options.onChange?.(next,commit);}});
  const exact=doc.createElement('details');exact.className='ui-section';const summary=doc.createElement('summary'),heading=doc.createElement('h5');heading.textContent='Exact handles';summary.append(heading);exact.append(summary,editor.element.children[1]);editor.element.append(exact);
  body.append(editor.element);panel.append(header,body);
  const popover=UI.createAnchoredPopover(element,{element:panel});close.addEventListener('click',popover.close);
  function paint(){const y=value=>options.invert?1-value:value;path.setAttribute('d','M 1 '+(21-20*y(points[4]??0))+' C '+(1+48*points[0])+' '+(21-20*y(points[1]))+' '+(1+48*points[2])+' '+(21-20*y(points[3]))+' 49 '+(21-20*y(points[5]??1)));}
  paint();
  return {element,editor:editor.element,open:popover.open,close:popover.close,sync(next={}){editor.sync(next);if(next.points){points=[...next.points];paint();}element.disabled=next.available===false;},dispose(){if(disposed)return;disposed=true;popover.dispose();editor.dispose();close.removeEventListener('click',popover.close);}};
};

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

/* Compact, application-neutral component hierarchy. Apps supply navigation and optionally
   stable inline content hosts; Shared UI owns rows, visibility, focus and keyboard grammar. */
(() => {
  'use strict';
  if(typeof window==='undefined'||!window.SharedUI)return;
  const UI=window.SharedUI;
  // A native disclosure or property label can share the hierarchy's compact row grammar.
  UI.adoptControlTreeRow=function(target,{kind,enabled=true,sprite='./shared-ui/icons.svg'}={}){
    if(!target?.ownerDocument||!['group','control'].includes(kind))throw new TypeError('A tree group summary or control label is required');
    let icon=[...target.children].find(child=>child.dataset.uiTreeIcon);
    if(!enabled){delete target.dataset.uiTreeRow;icon?.remove();return target;}
    target.dataset.uiTreeRow=kind;
    if(!icon){const doc=target.ownerDocument;icon=doc.createElementNS('http://www.w3.org/2000/svg','svg');icon.classList.add('ui-icon');icon.setAttribute('aria-hidden','true');icon.setAttribute('viewBox','0 0 24 24');icon.append(doc.createElementNS('http://www.w3.org/2000/svg','use'));target.insertBefore(icon,target.firstChild);}
    icon.dataset.uiTreeIcon=kind;icon.firstElementChild.setAttribute('href',sprite+'#ui-'+(kind==='group'?'layers':'sliders'));return target;
  };
  UI.createCompactControlTree=function({navigation,onSelect,onChange=()=>{},onSearch=()=>{},onContextMenu=null,sprite='./shared-ui/icons.svg'}={}){
    if(!navigation||typeof navigation.rows!=='function'||typeof navigation.key!=='function')throw new TypeError('A control-tree navigation model is required');
    const doc=document,root=doc.createElement('div');
    root.className='ui-control-tree';root.setAttribute('role','tree');root.setAttribute('aria-label','Components');
    let signature='',focused='',query='',typed='',typedAt=0,inlineContent=null,visible=[];
    const entries=new Map(),empty=doc.createElement('p'),parked=doc.createElement('div');empty.className='ui-meta';empty.textContent='No matching component.';parked.hidden=true;
    const items=()=>visible.map(id=>entries.get(id)?.item).filter(Boolean);
    const rowFor=id=>visible.includes(id)?entries.get(id)?.item:null;
    const focus=id=>{focused=id;for(const item of items())item.tabIndex=item.dataset.component===id?0:-1;rowFor(id)?.focus({preventScroll:true});rowFor(id)?.scrollIntoView({block:'nearest'});};
    const syncChildren=(parent,children)=>{
      let cursor=parent.firstElementChild;
      for(const child of children){if(child!==cursor)parent.insertBefore(child,cursor);cursor=child.nextElementSibling;}
      for(const child of [...parent.children])if(!children.includes(child))child.remove();
    };
    function entryFor(n){
      let entry=entries.get(n.id);if(entry)return entry;
      const item=doc.createElement('div');item.className='ui-control-tree-item';item.dataset.component=n.id;item.setAttribute('role','treeitem');
      const line=doc.createElement('div');line.className='ui-control-tree-line ui-item';line.dataset.uiVariant='quiet';
      const expander=doc.createElement('span');expander.className='ui-control-tree-expander';expander.dataset.expand='';expander.setAttribute('aria-hidden','true');
      const symbol=doc.createElementNS('http://www.w3.org/2000/svg','svg');symbol.classList.add('ui-icon');symbol.setAttribute('aria-hidden','true');
      const use=doc.createElementNS('http://www.w3.org/2000/svg','use');symbol.append(use);
      const label=doc.createElement('span');label.className='ui-control-tree-label';
      const options=doc.createElement('button');options.type='button';options.className='ui-control-tree-options';options.hidden=true;
      UI.adoptAction(options,{label:'Component choices',icon:'more',iconOnly:true,sprite});
      options.onclick=event=>{event.preventDefault();event.stopPropagation();onContextMenu?.(entry.node,event);};
      line.append(expander,symbol,label,options);item.append(line);
      const group=doc.createElement('div');group.className='ui-control-tree-children';group.setAttribute('role','group');
      entry={item,line,expander,use,label,options,group,content:null,node:n};entries.set(n.id,entry);
      line.onclick=event=>{const node=entry.node;if(event.target.closest('[data-expand]')&&(node.expandable??node.children)){navigation.toggle(node.id);render();focus(node.id);onChange();}else{focused=node.id;onSelect(node.id);render();focus(node.id);}};
      item.oncontextmenu=event=>{const target=event.target||item;if(target.closest?.('[role=treeitem]')!==item||entry.content?.contains(target))return;onContextMenu?.(entry.node,event);};
      item.onfocus=event=>{if(event.target===item){focused=entry.node.id;for(const other of items())other.tabIndex=other===item?0:-1;}};
      return entry;
    }
    function render(){
      const rows=navigation.rows(query);
      const next=JSON.stringify([rows.map(n=>[n.id,n.parent,n.label,n.description,n.depth,n.children,n.expandable,n.expanded,n.available,n.protected,n.selectors?.length||0]),navigation.selected]);
      if(signature===next)return;
      const active=doc.activeElement,hadFocus=root.contains(active),oldFocus=hadFocus?active.closest('[data-component]')?.dataset.component:focused,treeFocus=hadFocus&&active===entries.get(oldFocus)?.item,scroll=root.scrollTop;
      if(!rows.some(n=>n.id===focused))focused=rows.some(n=>n.id===navigation.selected)?navigation.selected:rows[0]?.id??'';
      visible=rows.map(n=>n.id);
      const groups=new Map([[null,root]]),desired=new Map([[root,[]]]),siblings=new Map();
      for(const n of rows){if(!siblings.has(n.parent))siblings.set(n.parent,[]);siblings.get(n.parent).push(n.id);}
      for(const n of rows){
        const entry=entryFor(n),{item,line,expander,use,label,group}=entry;entry.node=n;item.hidden=false;item.setAttribute('aria-label',n.label);
        item.setAttribute('aria-selected',String(n.id===navigation.selected));item.setAttribute('aria-level',String(n.depth+1));item.tabIndex=n.id===focused?0:-1;
        const peers=siblings.get(n.parent);item.setAttribute('aria-setsize',String(peers.length));item.setAttribute('aria-posinset',String(peers.indexOf(n.id)+1));
        line.dataset.uiSelected=String(n.id===navigation.selected);line.style.setProperty('--control-tree-depth',String(n.depth));
        const expandable=Boolean(n.expandable??n.children);expander.textContent=expandable?(n.expanded?'▾':'▸'):'';
        if(expandable)item.setAttribute('aria-expanded',String(Boolean(n.expanded)));else item.removeAttribute('aria-expanded');
        use.setAttribute('href',sprite+'#'+(n.protected?'ui-lock':n.children?'ui-folder':'ui-sliders'));label.textContent=n.label;
        const variants=Boolean(n.selectors?.length&&!n.protected);if(variants)item.dataset.uiVariation='true';else delete item.dataset.uiVariation;
        entry.options.hidden=!variants||!onContextMenu;entry.options.setAttribute('aria-label','Variations for '+n.label);entry.options.title='Choose a variation or saved look';
        const variationHint=variants?'Switchable appearance variations'+(onContextMenu?'. Use the choices button or Shift+F10.':''):'';
        if(variationHint)item.setAttribute('aria-description',variationHint);else item.removeAttribute('aria-description');
        if(n.protected)item.dataset.uiProtected='true';else delete item.dataset.uiProtected;if(n.available===false)item.dataset.uiUnavailable='true';else delete item.dataset.uiUnavailable;
        item.title=(n.description||n.label)+(variationHint?' · '+variationHint:'');
        const content=inlineContent?.(n)||null;
        if(content&&(content.ownerDocument!==doc||content===root||content.contains(root)))throw new TypeError('Inline tree content must be a separate node in the same document');
        entry.content=content;if(content){content.dataset.uiTreeContent=n.id;content.style.setProperty('--control-tree-depth',String(n.depth+1));content.hidden=!n.expanded;}
        syncChildren(item,[line,...(content?[content]:[]),...(n.children?[group]:[])]);
        const parent=groups.get(n.parent)||root;desired.get(parent).push(item);
        if(n.children){group.hidden=!n.expanded;groups.set(n.id,group);desired.set(group,[]);}
      }
      if(!rows.length)desired.set(root,[empty]);
      // Keep editors reachable by their host while a branch or filter hides its row.
      // Visible navigation excludes these parked items from focus and keyboard traversal.
      const hidden=[];for(const [id,entry]of entries)if(!visible.includes(id)){entry.item.hidden=true;entry.item.tabIndex=-1;hidden.push(entry.item);}
      if(hidden.length){desired.get(root).push(parked);desired.set(parked,hidden);}
      for(const [parent,children]of desired)syncChildren(parent,children);
      signature=next;root.scrollTop=scroll;
      if(hadFocus&&rowFor(oldFocus)){
        if(treeFocus||!root.contains(active)||active.closest('[hidden]'))focus(oldFocus);
        else if(doc.activeElement!==active)active.focus({preventScroll:true});
      }
    }
    const keydown=event=>{
      const item=event.target.closest('[role=treeitem]');if(!item||event.target!==item)return;
      const id=item.dataset.component;if(entries.get(id)?.item!==item)return;
      if(onContextMenu&&(event.key==='ContextMenu'||event.key==='F10'&&event.shiftKey)){event.preventDefault();event.stopPropagation();onContextMenu(entries.get(id).node,event);return;}
      if(['ArrowUp','ArrowDown','ArrowLeft','ArrowRight','Home','End'].includes(event.key)&&!event.altKey){
        event.preventDefault();event.stopPropagation();const next=navigation.key(id,event.key,query);render();focus(next);onChange();return;
      }
      if(event.key==='Enter'||event.key===' '){event.preventDefault();event.stopPropagation();onSelect(id);render();focus(id);return;}
      if(event.key.length===1&&!event.metaKey&&!event.ctrlKey&&!event.altKey){
        const now=performance.now();typed=now-typedAt<650?typed+event.key.toLowerCase():event.key.toLowerCase();typedAt=now;
        const rows=navigation.rows(query),index=rows.findIndex(n=>n.id===id),ordered=[...rows.slice(index+1),...rows.slice(0,index+1)],next=ordered.find(n=>n.label.toLowerCase().startsWith(typed));
        if(next){event.preventDefault();event.stopPropagation();focus(next.id);}
      }
    };
    const keyup=event=>{if(event.target===entries.get(event.target?.dataset?.component)?.item&&[' ','Enter','ArrowLeft','ArrowRight','ArrowUp','ArrowDown','Home','End'].includes(event.key))event.stopPropagation();};
    root.addEventListener('keydown',keydown);root.addEventListener('keyup',keyup);
    return {element:root,render,focus,setInlineContent(provider){if(provider!==null&&typeof provider!=='function')throw new TypeError('Inline tree content needs a provider or null');inlineContent=provider;signature='';render();},setQuery(value){query=value;signature='';render();onSearch(query);},get query(){return query;},reveal(){navigation.select(navigation.selected,{record:false});render();rowFor(navigation.selected)?.scrollIntoView({block:'nearest'});},dispose(){root.removeEventListener('keydown',keydown);root.removeEventListener('keyup',keyup);for(const entry of entries.values()){entry.line.onclick=null;entry.item.oncontextmenu=null;entry.item.onfocus=null;}entries.clear();visible=[];}};
  };
})();

/* A split between adjacent vertical sections, with keyboard and pointer resizing.
   The host owns persistence; Shared UI owns the handle, geometry and semantics. */
(() => {
  'use strict';
  if(typeof window==='undefined'||!window.SharedUI)return;
  window.SharedUI.createVerticalSplitter=function(top,{value=180,min=80,max=()=>700,onChange=()=>{},label='Resize sections'}={}){
    if(!top?.ownerDocument)throw new TypeError('A section is required');
    const doc=top.ownerDocument,handle=doc.createElement('div'),view=doc.defaultView;
    handle.className='ui-vertical-splitter';handle.setAttribute('role','separator');handle.tabIndex=0;
    handle.setAttribute('aria-label',label);handle.setAttribute('aria-orientation','horizontal');
    handle.title='Drag to resize · Arrow Up/Down · double-click to reset';
    const original=value;let size=value,drag=null;
    const bounds=()=>({min:Math.max(0,typeof min==='function'?Number(min()):Number(min)),max:Math.max(0,typeof max==='function'?Number(max()):Number(max))});
    function setValue(next,final=false){const range=bounds();size=Math.max(range.min,Math.min(Math.max(range.min,range.max),Math.round(next)));
      top.style.blockSize=size+'px';handle.setAttribute('aria-valuemin',String(range.min));handle.setAttribute('aria-valuemax',String(Math.max(range.min,range.max)));handle.setAttribute('aria-valuenow',String(size));onChange(size,{final});}
    const move=event=>{if(drag&&event.pointerId===drag.pointerId)setValue(drag.height+event.clientY-drag.y);};
    const stop=event=>{if(!drag||event.pointerId!==drag.pointerId)return;drag=null;delete handle.dataset.dragging;view.removeEventListener('pointermove',move,true);view.removeEventListener('pointerup',stop,true);view.removeEventListener('pointercancel',stop,true);setValue(size,true);};
    handle.addEventListener('pointerdown',event=>{if(event.button!==0)return;event.preventDefault();drag={pointerId:event.pointerId,y:event.clientY,height:top.getBoundingClientRect().height};handle.dataset.dragging='true';handle.setPointerCapture(event.pointerId);view.addEventListener('pointermove',move,true);view.addEventListener('pointerup',stop,true);view.addEventListener('pointercancel',stop,true);});
    handle.addEventListener('lostpointercapture',stop);
    handle.addEventListener('keydown',event=>{const delta={ArrowUp:-16,ArrowDown:16,PageUp:-64,PageDown:64}[event.key];if(delta!==undefined){event.preventDefault();setValue(size+delta,true);}else if(event.key==='Home'||event.key==='End'){event.preventDefault();setValue(event.key==='Home'?original:bounds().max,true);}});
    handle.addEventListener('dblclick',()=>setValue(original,true));
    setValue(value);return {element:handle,setValue,get value(){return size;}};
  };
})();


/* Native filter forms shared by tables, galleries and other collections. */
(() => {
  'use strict';
  if(typeof window==='undefined'||!window.SharedUI)return;
  const UI=window.SharedUI;
  UI.createFilterMenu=(form,{label='Filters',sprite,defaults={},summary:summaryHost=null,onChange=()=>{}}={})=>{
    const element=form?.querySelector('details[data-ui-filter]'),summary=element?.querySelector('summary');
    if(form?.tagName!=='FORM'||!summary)throw new TypeError('Use a native form with details[data-ui-filter] and summary');
    const doc=form.ownerDocument,view=doc.defaultView,off=[];let disposed=false,active=0,resetTimer;
    const chips=new Map(),host=summaryHost,wasHidden=host?.hidden;
    if(host&&host.ownerDocument!==doc)throw new TypeError('Filter summary must share the form document');
    const fields=()=>[...(form.elements||form.querySelectorAll('[data-ui-filter-field]'))].filter(f=>f.name&&['INPUT','SELECT','TEXTAREA'].includes(f.tagName)&&f.matches('[data-ui-filter-field]'));
    const baseline=f=>defaults[f.name]??f.dataset.uiFilterDefault??(f.multiple?[]:'');
    const normalize=value=>(Array.isArray(value)?value:[value]).filter(v=>v!==''&&v!=null).map(String).sort();
    function values(){const out=Object.create(null);for(const f of fields()){
      if(f.disabled)continue;
      if(f.type==='radio'||f.type==='checkbox'){
        out[f.name]??=[];if(f.checked)out[f.name].push(f.value);
      }else out[f.name]=f.multiple?[...f.selectedOptions].map(o=>o.value):f.value;
    }return out;}
    function refresh(){if(disposed)return;const state=values(),seen=new Set();active=0;
      for(const f of fields()){if(f.disabled||seen.has(f.name))continue;seen.add(f.name);if(JSON.stringify(normalize(state[f.name]))!==JSON.stringify(normalize(baseline(f))))active++;}
      UI.adoptAction(summary,{label:active?`${label} · ${active}`:label,ariaLabel:active?`${label}, ${active} active`:label,icon:'filter',sprite});
      summary.dataset.uiFilterActive=String(active);
      summary.classList?.toggle('ui-info',active>0);
      for(const clear of form.querySelectorAll('[data-ui-filter-clear]')){if(clear.tagName==='BUTTON')clear.disabled=!active;else clear.setAttribute('aria-disabled',String(!active));}
      if(host){
        const names=new Set();
        for(const f of fields()){
          if(f.disabled||names.has(f.name)||JSON.stringify(normalize(state[f.name]))===JSON.stringify(normalize(baseline(f))))continue;
          names.add(f.name);
          let chip=chips.get(f.name);
          if(!chip){chip=doc.createElement('button');chip.type='button';chip.className='ui-tag ui-info';chip.dataset.uiLabel='always';chip.dataset.uiFilterName=f.name;host.append(chip);chips.set(f.name,chip);}
          const caption=f.dataset.uiFilterLabel||f.getAttribute('aria-label')||f.labels?.[0]?.querySelector('.ui-label')?.textContent||f.name;
          const value=f.tagName==='SELECT'?[...f.selectedOptions].map(o=>o.label||o.textContent).join(', '):normalize(state[f.name]).join(', ');
          UI.adoptAction(chip,{label:caption+': '+value,ariaLabel:'Clear '+caption+' filter: '+value,icon:'close',sprite});
          chip.querySelector('.ui-label').classList.add('ui-truncate');
        }
        for(const [name,chip] of chips)if(!names.has(name)){const focused=doc.activeElement===chip;chip.remove();chips.delete(name);if(focused)([...chips.values()].find(n=>names.has(n.dataset.uiFilterName))||summary).focus({preventScroll:true});}
        host.hidden=!active;
      }
      return state;
    }
    function emit(reason){const state=refresh();if(!disposed)onChange(state,{reason,active});}
    function clear(name){if(disposed)return;for(const f of fields()){
      if(f.disabled||name!==undefined&&f.name!==name)continue;
      const wanted=normalize(baseline(f));
      if(f.type==='radio'||f.type==='checkbox')f.checked=wanted.includes(f.value);
      else if(f.multiple){for(const o of f.options)o.selected=wanted.includes(o.value);}
      else f.value=wanted[0]??'';
    }emit('clear');}
    function changed(event){if(event.target.form===form&&event.target.matches('[data-ui-filter-field]'))emit(event.type);}function externalChanged(event){if(event.target.closest('form')!==form)changed(event);}
    function click(event){if(event.target.closest('[data-ui-filter-clear]')?.closest('form')!==form)return;event.preventDefault();clear();}
    function key(event){if(event.key==='Escape'&&element.open&&!event.defaultPrevented){event.preventDefault();element.open=false;summary.focus({preventScroll:true});}}
    function listen(node,type,fn){node.addEventListener(type,fn);off.push(()=>node.removeEventListener(type,fn));}
    if(host)listen(host,'click',event=>{const chip=event.target.closest('[data-ui-filter-name]');if(chip&&chips.get(chip.dataset.uiFilterName)===chip){event.preventDefault();clear(chip.dataset.uiFilterName);}});
    listen(form,'reset',event=>{view.clearTimeout(resetTimer);resetTimer=view.setTimeout(()=>{if(!event.defaultPrevented&&!disposed)emit('reset');},0);});
    listen(form,'input',changed);listen(form,'change',changed);listen(doc,'input',externalChanged);listen(doc,'change',externalChanged);listen(form,'click',click);listen(element,'keydown',key);
    listen(view,'pagehide',event=>{if(!event.persisted)dispose();});
    function dispose(){if(disposed)return;disposed=true;view.clearTimeout(resetTimer);for(const remove of off)remove();for(const chip of chips.values())chip.remove();chips.clear();if(host)host.hidden=wasHidden;}
    refresh();return {element,get values(){return values();},get active(){return active;},refresh,clear,dispose};
  };
})();

/* Native canonical compositions: shells only, no app state, transport or listeners. */
(() => {
  'use strict';
  if (typeof window === 'undefined' || !window.SharedUI) return;
  const UI = window.SharedUI;
  const ID = 'review-workspace', REVISION = '1';
  const SLOTS = ['header', 'toolbar', 'filters', 'body', 'aside', 'footer'];
  const VARIANTS = ['standard', 'split', 'stack'];
  const CROWDING = ['wrap', 'scroll', 'priority'];
  const OVERRIDES = Object.freeze({
    gap: {property: '--ui-composition-gap', min: 0, max: 64, units: ['px', 'rem', 'em']},
    aside: {property: '--ui-composition-aside', min: 0, max: 640, units: ['px', 'rem', 'em', '%']}
  });
  const plain = value => value && typeof value === 'object' && !Array.isArray(value);
  function length(value, spec, name) {
    const match = typeof value === 'string' && /^(\d+(?:\.\d+)?|\.\d+)(px|rem|em|%)$/.exec(value);
    if (!match || !spec.units.includes(match[2])) throw new TypeError('Invalid ' + name + ' length');
    const amount = Number(match[1]), unit = match[2], max = unit === '%' ? (name === 'aside' ? 60 : 100) : unit === 'rem' || unit === 'em' ? (name === 'aside' ? 40 : 4) : spec.max;
    const min = name === 'aside' ? unit === 'px' ? 128 : unit === '%' ? 15 : 8 : 0;
    if (!Number.isFinite(amount) || amount < min || amount > max) throw new RangeError('Out-of-range ' + name);
    return value;
  }
  function configuration(options = {}) {
    if (!plain(options) || Object.keys(options).some(key => !['variant', 'crowding', 'overrides', 'instanceId', 'document'].includes(key)))
      throw new TypeError('Unknown composition option');
    const variant = options.variant ?? 'standard', crowding = options.crowding ?? 'wrap';
    if (!VARIANTS.includes(variant) || !CROWDING.includes(crowding)) throw new TypeError('Unknown composition variant or crowding');
    const raw = options.overrides ?? {}, overrides = {};
    if (!plain(raw) || Object.keys(raw).some(key => !['gap', 'aside', 'reason'].includes(key))) throw new TypeError('Unknown composition override');
    for (const [key, spec] of Object.entries(OVERRIDES)) {
      if (raw[key] !== undefined) overrides[key] = length(raw[key], spec, key);
    }
    const count = Object.keys(overrides).length;
    if (count) {
      if (typeof raw.reason !== 'string' || raw.reason.trim().length < 4 || raw.reason.length > 200 ||
          /[\u0000-\u001f\u007f]/.test(raw.reason)) throw new TypeError('Layout overrides need a concise reason');
      overrides.reason = raw.reason.trim();
    } else if (raw.reason !== undefined) throw new TypeError('Reason without a layout override');
    return {variant, crowding, overrides};
  }
  UI.createComposition = (componentId, slots, options = {}) => {
    if (componentId !== ID) throw new TypeError('Unknown canonical composition: ' + componentId);
    if (!plain(slots) || Object.keys(slots).some(key => !SLOTS.includes(key))) throw new TypeError('Unknown composition slot');
    const doc = options.document || SLOTS.flatMap(key => slots[key] == null ? [] : Array.isArray(slots[key]) ? slots[key] : [slots[key]])[0]?.ownerDocument || window.document;
    if (!doc || typeof doc.createElement !== 'function') throw new TypeError('DOM document required');
    const instanceId = options.instanceId;
    if (instanceId !== undefined && (typeof instanceId !== 'string' || !/^[a-z][a-z0-9.-]{1,79}$/.test(instanceId))) throw new TypeError('Invalid stable instance identity');
    let config = configuration(options);
    const nodes = new Map(), seen = new Set();
    for (const key of SLOTS) {
      const value = slots[key], group = value == null ? [] : Array.isArray(value) ? value : [value];
      if ((key === 'header' || key === 'body') && group.length === 0) throw new TypeError('Missing required composition slot: ' + key);
      if (group.length > 100) throw new RangeError('Too many slot elements');
      for (const item of group) {
        if (item?.nodeType !== 1 || item.ownerDocument !== doc || item.isConnected || seen.has(item))
          throw new TypeError('Slot elements must be unique, detached native DOM nodes');
        for (const prior of seen) if (item.contains?.(prior) || prior.contains?.(item))
          throw new TypeError('Nested slot elements must be passed through one parent');
        seen.add(item);
      }
      nodes.set(key, group);
    }
    const make = (tag, cls, slot) => {
      const el = doc.createElement(tag);
      if (cls) el.className = cls;
      if (slot) el.dataset.uiCompositionSlot = slot;
      return el;
    };
    const root = make('article', 'ui-composition ui-card');
    root.dataset.uiComposition = ID; root.dataset.uiCompositionRevision = REVISION;
    if (instanceId) root.dataset.uiCompositionInstance = instanceId;
    const frame = make('div', 'ui-composition-layout');
    const hosts = new Map();
    function insert(key, tag, cls, into) {
      if (!nodes.get(key).length) return;
      const host = make(tag, cls, key);
      host.append(...nodes.get(key)); into.append(host); hosts.set(key, host);
    }
    insert('header', 'header', 'ui-composition-header ui-stack', frame);
    insert('toolbar', 'div', 'ui-composition-toolbar ui-toolbar', frame);
    insert('filters', 'div', 'ui-composition-filters', frame);
    const main = make('div', 'ui-composition-main');
    insert('body', 'section', 'ui-composition-body ui-stack', main);
    insert('aside', 'aside', 'ui-composition-aside ui-stack', main);
    frame.append(main);
    insert('footer', 'footer', 'ui-composition-footer ui-actions', frame);
    root.append(frame);
    let disposed = false;
    function apply(next) {
      const previous = config.overrides;
      for (const key of Object.keys(OVERRIDES)) if (previous[key] !== undefined) root.style.removeProperty(OVERRIDES[key].property);
      for (const key of Object.keys(OVERRIDES)) if (next.overrides[key] !== undefined) root.style.setProperty(OVERRIDES[key].property, next.overrides[key]);
      root.dataset.uiVariant = next.variant; root.dataset.uiCrowding = next.crowding;
      root.dataset.uiCompositionOrigin = Object.keys(next.overrides).some(key => key !== 'reason') ? 'instance' : 'canonical';
      const keys = Object.keys(next.overrides).filter(key => key !== 'reason');
      if (keys.length) root.dataset.uiCompositionOverrides = keys.join(',');
      else delete root.dataset.uiCompositionOverrides;
      config = next;
    }
    apply(config);
    return Object.freeze({
      element: root,
      slots: Object.freeze(Object.fromEntries(hosts)),
      getConfiguration() {
        return Object.freeze({id: ID, revision: REVISION, instanceId: instanceId ?? null, variant: config.variant,
          crowding: config.crowding, origin: root.dataset.uiCompositionOrigin, overrides: Object.freeze({...config.overrides})});
      },
      setLayout(next = {}) {
        if (disposed) throw new Error('Composition disposed');
        if (!plain(next) || Object.keys(next).some(key => !['variant', 'crowding', 'overrides'].includes(key))) throw new TypeError('Invalid layout update');
        const updated = configuration({variant: next.variant ?? config.variant, crowding: next.crowding ?? config.crowding,
          overrides: next.overrides === undefined ? config.overrides : next.overrides});
        apply(updated); // Existing DOM and callbacks remain unchanged; container CSS handles reflow.
        return this.getConfiguration();
      },
      dispose() {
        if (disposed) return; disposed = true; root.remove();
        // No listeners, timers, observers or global coordination were created.
      }
    });
  };
})();

/* Shared native floating review surface. Can augment a pinned fixture's v1
 * baseline runtime OR be bundled into a candidate runtime. No app markup copy,
 * network/storage, global drag listener, source selection or auto-mount. */
(() => {
  'use strict';
  const instances=new WeakMap();
  const placements=new Set(['bottom-right','bottom-left','top-right','top-left']);
  const variants=/^(installed|baseline|candidate|unverified|saved:[a-z0-9][a-z0-9-]{1,63})$/;
  const sha40=/^[a-f0-9]{40}$/;
  const sha64=/^[a-f0-9]{64}$/;
  const versions=/^[a-zA-Z0-9][a-zA-Z0-9._+-]{0,63}$/;
  const deployments=new Set(['not-deployed','deployed','unverified']);
  function readProvenance(value={}){
    if(!value||typeof value!=='object'||Array.isArray(value)||
      Object.keys(value).some(k=>!['appName','appVersion','appSha','uiVersion','uiSha','cssRevision',
        'variant','deploymentState'].includes(k)))
      throw new TypeError('Review provenance must use the shared typed fields');
    const string=(value,label)=>{
      if(value===undefined||value===null||value==='')return null;
      if(typeof value!=='string'||value.length>80||/[\u0000-\u001f\u007f]/.test(value))
        throw new TypeError('Invalid '+label+' provenance');
      return value.trim()||null;
    };
    const appName=string(value.appName,'appName')||'Application unverified';
    const appVersion=string(value.appVersion,'appVersion');
    const appSha=string(value.appSha,'appSha');
    const uiVersion=string(value.uiVersion,'uiVersion');
    const uiSha=string(value.uiSha,'uiSha');
    const cssRevision=string(value.cssRevision,'cssRevision');
    if(appVersion&&!versions.test(appVersion)||uiVersion&&!versions.test(uiVersion)||
       appSha&&!sha40.test(appSha)||uiSha&&!sha40.test(uiSha)||
       cssRevision&&!sha64.test(cssRevision))
      throw new TypeError('Source/version identity needs a complete validated SHA or version');
    const variant=value.variant??'unverified',deploymentState=value.deploymentState??'unverified';
    if(!variants.test(variant)||!deployments.has(deploymentState)||
      deploymentState==='deployed'&&variant==='candidate')
      throw new TypeError('Review variant/deployment claim is invalid');
    return {appName,appVersion,appSha,uiVersion,uiSha,cssRevision,variant,deploymentState};
  }
  function formatReviewProvenance(value={}){
    const p=readProvenance(value);
    const baseline=p.variant==='baseline'||p.variant==='installed';
    const variantLabel=baseline?'Installed baseline · code-equivalent only':
      p.variant==='candidate'?'Local candidate shared-ui':
      p.variant.startsWith('saved:')?'Saved shared-ui draft':
      'Unverified local review';
    const deploymentLabel=p.deploymentState==='deployed'?'Deployed (host-reported)':
      p.deploymentState==='not-deployed'?
        (baseline?'Local fixture · NOT live production':'Local fixture · NOT deployed'):
      'Deployment status unverified';
    const short=value=>value?value.slice(0,8):'unverified';
    const identityLabel='App '+(p.appVersion||'version unknown')+' · '+short(p.appSha)+
      ' | UI '+(p.uiVersion||'version unknown')+' · '+short(p.uiSha);
    return Object.freeze({
      ...p,variantLabel,deploymentLabel,identityLabel,
      details:Object.freeze([
        ['Application',p.appName],['Application version',p.appVersion||'Unreported'],
        ['App source Git SHA',p.appSha||'Unverified'],
        ['Shared UI version',p.uiVersion||'Unreported'],
        ['Shared UI source Git SHA',p.uiSha||'Unverified'],
        ['CSS asset SHA256',p.cssRevision||'Unverified'],
        ['Variant',variantLabel],['Deployment',deploymentLabel]
      ])
    });
  }
  function viewportBox(view){
    const vv=view.visualViewport;
    const finite=(n,backup)=>typeof n==='number'&&Number.isFinite(n)?n:backup;
    const width=Math.max(1,finite(vv?.width,finite(view.innerWidth,1)));
    const height=Math.max(1,finite(vv?.height,finite(view.innerHeight,1)));
    return {x:finite(vv?.offsetLeft,0),y:finite(vv?.offsetTop,0),width,height};
  }
  function fitPosition(point,size,viewport,margin=8){
    const m=Math.max(0,Math.min(margin,viewport.width/4,viewport.height/4));
    const minX=viewport.x+m,minY=viewport.y+m;
    const maxX=Math.max(minX,viewport.x+viewport.width-m-size.width);
    const maxY=Math.max(minY,viewport.y+viewport.height-m-size.height);
    const clamp=(value,lo,hi)=>Math.max(lo,Math.min(hi,value));
    return {x:clamp(point.x,minX,maxX),y:clamp(point.y,minY,maxY),
      minX,minY,maxX,maxY,gutter:m};
  }
  function createFloatingPanel(panel,{label='Review panel',placement='bottom-right',margin=8,provenance={}}={}){
    if(!panel?.ownerDocument||typeof panel.prepend!=='function'||!panel.isConnected)
      throw new TypeError('Floating panel must be an already mounted native element');
    if(instances.has(panel))return instances.get(panel);
    if(typeof label!=='string'||!label.trim()||label.length>80||
      !placements.has(placement)||!Number.isFinite(margin)||margin<0||margin>24)
      throw new TypeError('Floating panel needs a readable label, safe placement and margin');
    // Reject malformed/unverified source claims before adding any native chrome.
    formatReviewProvenance(provenance);
    const doc=panel.ownerDocument,view=doc.defaultView;
    if(!view)throw new TypeError('Floating panel needs its own window');
    let stopped=false,drag=null,moved=false,current={x:0,y:0},lastProvenance=null;
    const old={
      style:panel.getAttribute('style'),aria:panel.getAttribute('aria-label'),
      marker:panel.getAttribute('data-ui-floating-panel'),
      variant:panel.getAttribute('data-ui-floating-variant'),
      hadClass:panel.classList.contains('ui-floating-panel')
    };
    const node=(tag,css,text)=>{
      const element=doc.createElement(tag);
      if(css)element.className=css;
      if(text!==undefined)element.textContent=text;
      return element;
    };
    // Prepend ONLY new fixture chrome. The original native forms/buttons and
    // app-owned <details> remain at their original DOM identity and position.
    const chrome=node('header','ui-floating-chrome');
    const controls=node('div','ui-actions ui-inline');
    const handle=node('button','ui-floating-handle','Move panel');
    handle.type='button';
    handle.setAttribute('aria-label','Move '+label+'; arrow keys move, Shift+arrows move faster, Home resets');
    handle.setAttribute('aria-keyshortcuts','ArrowUp ArrowDown ArrowLeft ArrowRight Shift+ArrowUp Shift+ArrowDown Shift+ArrowLeft Shift+ArrowRight Home');
    handle.title='Drag here with mouse/touch · Arrow keys to move · Home to reset';
    const reset=node('button','ui-floating-reset','Reset position');
    reset.type='button';reset.title='Restore panel to '+placement.replace('-',' ')+' corner';
    reset.setAttribute('aria-label','Reset position of '+label);
    controls.append(handle,reset);
    const name=node('strong','ui-floating-name',label);
    const variant=node('span','ui-floating-variant');
    const deployment=node('span','ui-floating-deployment ui-meta');
    const identity=node('span','ui-floating-identity ui-meta');
    const info=node('details','ui-floating-provenance');
    const summary=node('summary',null,'Versions & provenance');
    const fields=node('dl','ui-floating-source-list');
    Object.assign(fields.style,{display:'grid',gridTemplateColumns:'minmax(6rem,auto) minmax(0,1fr)',gap:'3px 8px',margin:'6px 0 0'});
    info.append(summary,fields);
    const status=node('span','ui-sr-only');
    status.setAttribute('role','status');status.setAttribute('aria-live','polite');
    chrome.append(controls,name,variant,deployment,identity,info,status);
    panel.prepend(chrome);
    panel.classList.add('ui-floating-panel');
    panel.setAttribute('data-ui-floating-panel','true');
    if(old.aria===null)panel.setAttribute('aria-label',label);
    Object.assign(panel.style,{position:'fixed',inset:'auto',right:'auto',bottom:'auto'});
    const removers=[];
    function on(target,event,listener,options){
      target?.addEventListener?.(event,listener,options);
      if(target?.removeEventListener)removers.push(()=>target.removeEventListener(event,listener,options));
    }
    function setProvenance(value){
      if(stopped)return lastProvenance;
      const formatted=formatReviewProvenance(value);
      lastProvenance=formatted;
      variant.textContent=formatted.variantLabel;
      deployment.textContent=formatted.deploymentLabel;
      identity.textContent=formatted.identityLabel;
      fields.replaceChildren();
      for(const [key,value] of formatted.details){
        const dt=node('dt','ui-meta',key),dd=node('dd',null,value);dd.style.margin='0';
        fields.append(dt,dd);
      }
      panel.dataset.uiFloatingVariant=formatted.variant;
      return formatted;
    }
    function visibleBox(){
      const v=viewportBox(view);
      const inset=Math.max(0,Math.min(margin,v.width/4,v.height/4));
      const maxWidth=Math.max(1,v.width-2*inset);
      const maxHeight=Math.max(1,v.height-2*inset);
      const w=maxWidth+'px',h=maxHeight+'px';
      if(panel.style.maxWidth!==w)panel.style.maxWidth=w;
      if(panel.style.maxHeight!==h)panel.style.maxHeight=h;
      const rect=panel.getBoundingClientRect();
      return {viewport:v,size:{width:Math.min(maxWidth,Math.max(0,rect.width)),
        height:Math.min(maxHeight,Math.max(0,rect.height))}};
    }
    function positionAt(point){
      const {viewport,size}=visibleBox();
      const fitted=fitPosition(point,size,viewport,margin);
      current={x:fitted.x,y:fitted.y};
      const left=current.x+'px',top=current.y+'px';
      if(panel.style.left!==left)panel.style.left=left;
      if(panel.style.top!==top)panel.style.top=top;
      return fitted;
    }
    function corner(bounds){
      return {x:placement.endsWith('right')?bounds.maxX:bounds.minX,
        y:placement.startsWith('bottom')?bounds.maxY:bounds.minY};
    }
    function reflow(){
      if(stopped)return;
      const {viewport,size}=visibleBox(),bounds=fitPosition(current,size,viewport,margin);
      positionAt(moved?current:corner(bounds));
    }
    function resetPosition(){
      if(stopped)return;
      moved=false;reflow();
      status.textContent='Panel position reset to '+placement.replace('-',' ')+'.';
    }
    function finish(cancel){
      if(!drag)return;
      const prior=drag;drag=null;
      if(cancel){moved=prior.wasMoved;positionAt(prior.origin);}
      try{if(handle.hasPointerCapture?.(prior.id))handle.releasePointerCapture(prior.id);}catch{}
      delete handle.dataset.uiDragging;
    }
    on(handle,'pointerdown',event=>{
      if(stopped||drag||event.button!==0||event.isPrimary===false)return;
      const interactive=event.target?.closest?.('button,a,input,select,textarea,summary,[contenteditable],[role=button],[data-ui-no-drag]');
      if(interactive&&interactive!==handle)return;
      const origin={...current};
      try{handle.setPointerCapture(event.pointerId);}catch{return;}
      drag={id:event.pointerId,start:{x:event.clientX,y:event.clientY},
        origin,wasMoved:moved};
      handle.dataset.uiDragging='true';
      event.preventDefault?.();
    });
    on(handle,'pointermove',event=>{
      if(!drag||drag.id!==event.pointerId)return;
      const dx=event.clientX-drag.start.x,dy=event.clientY-drag.start.y;
      if(!Number.isFinite(dx)||!Number.isFinite(dy))return;
      moved=true;positionAt({x:drag.origin.x+dx,y:drag.origin.y+dy});
      event.preventDefault?.();
    });
    on(handle,'pointerup',event=>{if(drag?.id===event.pointerId)finish(false);});
    on(handle,'pointercancel',event=>{if(drag?.id===event.pointerId)finish(true);});
    on(handle,'lostpointercapture',event=>{if(drag?.id===event.pointerId)finish(false);});
    on(handle,'keydown',event=>{
      if(event.target!==handle||event.altKey||event.ctrlKey||event.metaKey)return;
      if(event.key==='Home'){event.preventDefault?.();resetPosition();return;}
      const offsets={ArrowLeft:[-1,0],ArrowRight:[1,0],ArrowUp:[0,-1],ArrowDown:[0,1]};
      const offset=offsets[event.key];
      if(!offset)return;
      event.preventDefault?.();
      const step=event.shiftKey?48:16;
      moved=true;positionAt({x:current.x+offset[0]*step,y:current.y+offset[1]*step});
      status.textContent='Panel moved. Home resets its position.';
    });
    on(reset,'click',()=>{finish(true);resetPosition();});
    on(view,'resize',reflow);
    on(view,'orientationchange',reflow);
    on(view,'scroll',reflow);
    on(view.visualViewport,'resize',reflow);
    on(view.visualViewport,'scroll',reflow);
    on(panel,'toggle',reflow,true);
    on(doc,'visibilitychange',()=>{if(doc.visibilityState==='hidden')finish(true);});
    on(view,'pagehide',event=>{if(!event.persisted)dispose();else finish(true);});
    let observer=null;
    if(typeof view.ResizeObserver==='function'){
      observer=new view.ResizeObserver(()=>reflow());
      observer.observe(panel);
    }
    function dispose(){
      if(stopped)return;
      finish(true);stopped=true;
      observer?.disconnect();
      for(const remove of removers)remove();
      chrome.remove();
      if(!old.hadClass)panel.classList.remove('ui-floating-panel');
      if(old.style===null)panel.removeAttribute('style');else panel.setAttribute('style',old.style);
      if(old.aria===null)panel.removeAttribute('aria-label');else panel.setAttribute('aria-label',old.aria);
      if(old.marker===null)panel.removeAttribute('data-ui-floating-panel');
      else panel.setAttribute('data-ui-floating-panel',old.marker);
      if(old.variant===null)delete panel.dataset.uiFloatingVariant;
      else panel.setAttribute('data-ui-floating-variant',old.variant);
      instances.delete(panel);
    }
    const controller=Object.freeze({
      panel,handle,resetButton:reset,provenanceDetails:info,
      get position(){return {...current,moved};},
      get provenance(){return lastProvenance;},
      setProvenance,reset:resetPosition,reflow,dispose
    });
    instances.set(panel,controller);
    setProvenance(provenance);
    resetPosition();
    return controller;
  }
  const api={createFloatingPanel,formatReviewProvenance,viewportBox,fitPosition};
  if(typeof module==='object'&&module.exports)Object.assign(module.exports,api);
  if(typeof window!=='undefined'&&window.SharedUI){
    // Replaying the exact fixture-only augment after a baseline bundle is
    // harmless; never replace a previously initialized factory.
    if(!window.SharedUI.createFloatingPanel)
      window.SharedUI.createFloatingPanel=createFloatingPanel;
  }
})();

/* Explicit read-only checks for consumer browser tests. No observers or app state. */
(() => {
  'use strict';
  if(typeof window==='undefined'||!window.SharedUI)return;
  const UI=window.SharedUI;
  const controls='button,a.ui-action,summary.ui-action,.ui-field';
  const name=node=>(node.getAttribute('aria-label')||node.querySelector(':scope > .ui-label')?.textContent||node.textContent||node.getAttribute('title')||node.id||node.tagName).trim();
  const box=node=>{const {x,y,width,height}=node.getBoundingClientRect();return {x,y,width,height};};
  // Overlap concerns painted areas, not offscreen descendants of scrollports.
  function clippedBox(node,view){
    let rect=box(node);
    const intersect=(left,top,right,bottom)=>{const x=Math.max(rect.x,left),y=Math.max(rect.y,top);rect={x,y,width:Math.max(0,Math.min(rect.x+rect.width,right)-x),height:Math.max(0,Math.min(rect.y+rect.height,bottom)-y)};};
    for(let parent=node.parentElement;parent;parent=parent.parentElement){
      const css=view.getComputedStyle(parent),clipX=/^(auto|scroll|hidden|clip)$/.test(css.overflowX),clipY=/^(auto|scroll|hidden|clip)$/.test(css.overflowY);if(!clipX&&!clipY)continue;
      const bounds=box(parent),sx=parent.offsetWidth?bounds.width/parent.offsetWidth:1,sy=parent.offsetHeight?bounds.height/parent.offsetHeight:1,left=bounds.x+(parent.clientLeft||0)*sx,top=bounds.y+(parent.clientTop||0)*sy,right=left+(Number.isFinite(parent.clientWidth)?parent.clientWidth*sx:bounds.width),bottom=top+(Number.isFinite(parent.clientHeight)?parent.clientHeight*sy:bounds.height);
      intersect(clipX?left:-Infinity,clipY?top:-Infinity,clipX?right:Infinity,clipY?bottom:Infinity);
    }
    intersect(0,0,view.innerWidth??Infinity,view.innerHeight??Infinity);return rect;
  }
  function visible(node){return Boolean(node.getClientRects().length)&&!node.closest('[hidden],dialog:not([open]),details:not([open]) > :not(summary)');}
  function nodes(scope){return [...scope.querySelectorAll(controls)].filter(node=>visible(node)&&!node.parentElement?.closest('.ui-field')&&!node.matches('.ui-item,.ui-media-button,[data-ui-surface],.ui-graphic-action,.ui-resize-handle'));}
  UI.captureLayout=scope=>nodes(scope).map(element=>({element,name:name(element),box:box(element),compact:element.hasAttribute('data-ui-compact')}));
  UI.compareLayout=(before,{tolerance=.75}={})=>before.flatMap(item=>{
    const node=item.element;if(!node.isConnected||!visible(node))return [{code:'control-disappeared',name:item.name}];
    const after=box(node),delta=Object.fromEntries(Object.keys(after).map(key=>[key,after[key]-item.box[key]]));
    return Object.values(delta).some(value=>Math.abs(value)>tolerance)||item.compact!==node.hasAttribute('data-ui-compact')?[{code:'state-layout-shift',name:item.name,delta}]:[];
  });
  UI.auditControls=scope=>{
    const doc=scope.ownerDocument||scope,view=doc.defaultView,items=nodes(scope),issues=[];
    const issue=(node,code,detail,severity='error')=>issues.push({code,name:name(node),detail,severity});
    for(const node of items){
      if(!name(node)||!node.getAttribute('aria-label')&&!node.textContent.trim()&&!node.querySelector('input[aria-label],select[aria-label]'))issue(node,'missing-name','Give the native action a complete accessible name.');
      if(!node.matches('.ui-action')&&node.matches('button,a,summary')&&node.closest('.ui-actions,.ui-toolbar')&&node.querySelector(':scope > svg'))issue(node,'unadopted-action','Register the native icon command with SharedUI.adoptAction before fitting its group.');
      if(node.matches('.ui-action')){
        if(!node.matches('button,a,summary,label'))issue(node,'non-native-action','Use a native button, link, summary or labeled form control.');
        if(!node.querySelector(':scope > .ui-label'))issue(node,'missing-label','Adopt the action with the shared label helper.');
        const icon=node.querySelector(':scope > svg');if(node.dataset?.uiIcon&&!icon)issue(node,'missing-icon','The declared action icon has no SVG.');if(icon&&!icon.matches('.ui-icon'))issue(node,'unshared-icon','Use the shared SVG icon role.');
        if(icon&&node.getAttribute('aria-busy')!=='true'){const paint=view.getComputedStyle(icon),bounds=icon.getBoundingClientRect?.(),use=icon.querySelector?.('use');if(paint.display==='none'||paint.visibility==='hidden'||paint.opacity==='0'||bounds&&(bounds.width===0||bounds.height===0))issue(node,'hidden-icon','The SVG icon has no visible rendered area.');if(use){const href=use.getAttribute('href')||use.getAttribute('xlink:href');if(!href||!href.includes('#'))issue(node,'missing-icon-reference','The SVG use needs a sprite symbol reference.');else if(typeof use.getBBox==='function'){try{const glyph=use.getBBox();if(!glyph.width&&!glyph.height)issue(node,'empty-icon','The SVG symbol has no rendered geometry; verify the same-origin sprite URL and symbol.');}catch{issue(node,'empty-icon','The SVG symbol could not be measured.');}}}}
        if(node.getAttribute('aria-busy')==='true'&&!node.querySelector('.ui-dynamic'))issue(node,'unreserved-busy-label','Declare labelStates for changing action text.','warning');
      }
      const rect=box(node),css=view.getComputedStyle(node),tag=node.matches('.ui-tag'),multiline=node.matches('textarea')||node.matches('.ui-field')&&(node.hasAttribute('data-ui-tag-field')||Boolean(node.querySelector('textarea,.ui-color-palette'))),token=Math.max(node.matches('.ui-action')?parseFloat(css.getPropertyValue('--ui-action-size'))||0:0,parseFloat(css.getPropertyValue(tag?'--ui-tag-height':node.matches('.ui-field')?'--ui-field-height':'--ui-control-height'))||0),minimum=tag||multiline||node.matches('.ui-visual-card');
      if(!node.matches('.ui-link')&&token&&(minimum?rect.height<token-1:Math.abs(rect.height-token)>1))issue(node,'control-height-drift',`Expected ${minimum?'at least ':''}${token}px, rendered ${rect.height}px.`);
      const header=node.closest('.ui-header');if(header&&!node.closest('.ui-menu-panel,[data-ui-layout=bar]')){
        const bounds=header.getBoundingClientRect();if(rect.x<bounds.left-.75||rect.x+rect.width>bounds.right+.75)issue(node,'header-overflow','The command extends beyond its header.');
      }
    }
    for(let i=0;i<items.length;i++)for(let j=i+1;j<items.length;j++){
      const first=items[i],second=items[j];if(first.contains(second)||second.contains(first))continue;
      const a=clippedBox(first,view),b=clippedBox(second,view);if(Math.min(a.x+a.width,b.x+b.width)-Math.max(a.x,b.x)>.75&&Math.min(a.y+a.height,b.y+b.height)-Math.max(a.y,b.y)>.75)issue(second,'control-overlap',`Overlaps ${name(first)}.`);
    }
    return {version:UI.version,controls:items.length,issues};
  };
})();
