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
      const minimum=/^1\.\d+\.\d+$/.test(root.dataset.uiVersion||'')?root.dataset.uiVersion:'1.0.0';
      const candidate=item.version.split('.').map(Number),floor=minimum.split('.').map(Number);
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
    function closeMenu(menu,{focus=false}={}){if(!menu.open)return;menu.open=false;openedMenus.delete(menu);if(focus)menu.querySelector(':scope>summary')?.focus();}
    on(doc,'toggle',event=>{const menu=event.target;if(menu.matches?.('details.ui-menu')){if(menu.open)openedMenus.add(menu);else openedMenus.delete(menu);}},true);
    on(doc,'click',event=>{for(const menu of openedMenus)if(!menu.contains(event.target))closeMenu(menu);});
    on(doc,'keydown',event=>{if(event.key!=='Escape')return;const menu=event.target.closest?.('details.ui-menu');if(menu?.open){event.preventDefault();closeMenu(menu,{focus:true});}});
    function dispose(){if(stopped)return;stopped=true;view.clearTimeout(timer);cancelStyle?.();requestController?.abort();channel?.close();removeLease();for(const remove of removers)remove();openedMenus.clear();api.disposeActions?.(doc);}
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
  const actionStates=new WeakMap();
  function adoptAction(element,{icon,label,labelStates,ariaLabel,iconOnly,title,sprite='./shared-ui/icons.svg'}={}){
    if(!element?.matches?.('button,a,summary'))throw new TypeError('A native button, link or summary is required');
    const feedback=actionStates.get(element);if(feedback&&feedback.state!=='idle'&&icon!==undefined){if(!feedback.applying)feedback.icon=icon;icon=feedback.state==='success'?'check':feedback.state==='error'?'warning':'refresh';}
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
    adoptAction(button,{...(entry.icon?{icon:entry.icon}:state==='idle'?{}:{icon:state==='success'?'check':state==='error'?'warning':'refresh'}),...(label===undefined?{}:{label}),ariaLabel:message?entry.name+': '+message:entry.name,title:message||entry.name,sprite});entry.applying=false;
    let live=button.querySelector('[data-ui-feedback]');if(!live){live=button.ownerDocument.createElement('span');live.className='ui-sr-only';live.dataset.uiFeedback='action';live.setAttribute('role','status');live.setAttribute('aria-live','polite');button.append(live);}if(live.textContent!==message)live.textContent=message;return button;
  }
  async function runAction(button,operation,{pending='Working…',success='Done',sprite}={}){setActionState(button,{state:'pending',message:pending,sprite});try{const result=await operation();setActionState(button,{state:'success',message:success,sprite});return result;}catch(error){setActionState(button,{state:'error',message:error.message||'Action failed',sprite});throw error;}}
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
  function createZoomFeedback(doc,{sprite='./shared-ui/icons.svg'}={}){
    if(zoomDocks.has(doc))return zoomDocks.get(doc);
    const view=doc.defaultView,node=doc.createElement('div');node.className='ui-zoom-feedback ui-toolbar ui-actions ui-inline';node.setAttribute('role','group');node.setAttribute('aria-label','Content zoom');
    const buttons=[];
    for(const [direction,icon,label] of [[-1,'minus','Zoom out'],[0,'maximize','Reset zoom'],[1,'plus','Zoom in']]){
      const button=doc.createElement('button');button.type='button';button.dataset.uiZoom=direction<0?'out':direction>0?'in':'value';
      adoptAction(button,{...(direction?{icon}:{}),label:direction?label:'100%',ariaLabel:label,labelStates:direction?undefined:['10%','100%','300%','800%'],iconOnly:direction!==0,sprite});
      if(direction===0){button.dataset.uiLabel='always';button.setAttribute('aria-live','polite');setText(button.querySelector('.ui-label'),'100%');}
      button.addEventListener('click',()=>doc.dispatchEvent(new view.CustomEvent('ui:zoom',{detail:{direction}})));buttons.push(button);node.append(button);
    }
    doc.body.append(node);
    let visible=true;
    const sync=()=>{node.hidden=!visible||Boolean(doc.querySelector('dialog[open],details.ui-menu[open],details.ui-disclosure[open],[popover]:popover-open'));};
    doc.addEventListener('toggle',sync,true);doc.addEventListener('close',sync,true);
    const api={show(value,{min=0,max=Infinity}={}){if(!Number.isFinite(value))return;setText(buttons[1].querySelector('.ui-label'),Math.round(value)+'%');buttons[0].disabled=value<=min;buttons[2].disabled=value>=max;},setVisible(value){visible=Boolean(value);sync();},dispose(){node.remove();zoomDocks.delete(doc);doc.removeEventListener('toggle',sync,true);doc.removeEventListener('close',sync,true);view.removeEventListener('pagehide',api.dispose);}};
    view.addEventListener('pagehide',api.dispose);zoomDocks.set(doc,api);sync();return api;
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
  const api={version:'1.11.3',mount,release,adoptAction,setActionState,runAction,reserveText,setText,setCardColor,resolveCardColor,createCardColorResolver,setSelection,setSortDirection,setAppColor,createBackToTop,createZoom,installZoomShortcuts,createZoomFeedback,createValueTransition,createZoomSteps,createColumnDrag,createColumnResize,createLightbox,setActionLabel:(element,label,options={})=>adoptAction(element,{...options,label}),source:DEFAULT_SOURCE};
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
  UI.createCombobox=(input,{options=[],onSelect=()=>{}}={})=>{
    const doc=input.ownerDocument,view=doc.defaultView;
    const wrapper=doc.createElement('span');wrapper.className='ui-combobox';input.before(wrapper);wrapper.append(input);
    const list=doc.createElement('span');list.className='ui-listbox';list.hidden=true;list.setAttribute('role','listbox');list.id=`ui-options-${view.crypto?.randomUUID?.()||Math.random().toString(36).slice(2)}`;
    const status=doc.createElement('span');status.className='ui-sr-only';status.setAttribute('role','status');wrapper.append(list,status);
    input.setAttribute('role','combobox');input.setAttribute('aria-autocomplete','list');input.setAttribute('aria-controls',list.id);input.setAttribute('aria-expanded','false');
    let values=[],matches=[],active=-1,disposed=false;
    const removers=[];
    function on(node,type,handler){node.addEventListener(type,handler);removers.push(()=>node.removeEventListener(type,handler));}
    let pool=documents.get(doc);
    if(!pool){pool={open:new Set(),count:0,handler:event=>{for(const item of pool.open)if(!item.element.contains(event.target))item.close();}};doc.addEventListener('pointerdown',pool.handler);documents.set(doc,pool);}pool.count++;
    const control={element:wrapper,close,dispose,setOptions};
    function close(){list.hidden=true;input.setAttribute('aria-expanded','false');input.removeAttribute('aria-activedescendant');pool.open.delete(control);}
    function render(){
      if(disposed)return;
      const query=input.value.toLocaleLowerCase();matches=values.filter(item=>item.label.toLocaleLowerCase().includes(query)).slice(0,100);active=Math.min(active,matches.length-1);list.replaceChildren();
      for(const [index,item] of matches.entries()){const option=doc.createElement('span');option.className='ui-option';option.id=`${list.id}-${index}`;option.dataset.option=index;option.setAttribute('role','option');option.setAttribute('aria-selected',String(index===active));option.textContent=item.label;list.append(option);}
      list.hidden=!matches.length;input.setAttribute('aria-expanded',String(matches.length>0));status.textContent=matches.length?`${matches.length} choices`:'No matching choices';
      if(matches.length)pool.open.add(control);else pool.open.delete(control);
      if(active>=0){input.setAttribute('aria-activedescendant',`${list.id}-${active}`);list.children[active]?.scrollIntoView({block:'nearest'});}else input.removeAttribute('aria-activedescendant');
    }
    function commit(index){const item=matches[index];if(!item)return;input.value=item.label;close();onSelect(item);input.dispatchEvent(new view.Event('change',{bubbles:true}));input.dispatchEvent(new view.CustomEvent('ui:select',{detail:item,bubbles:true}));}
    function setOptions(next){values=next.slice(0,1000).map(item=>typeof item==='string'?{value:item,label:item}:{value:String(item.value??item.label),label:String(item.label??item.value)});if(!list.hidden)render();}
    function dispose(){if(disposed)return;disposed=true;close();for(const remove of removers)remove();pool.count--;if(!pool.count){doc.removeEventListener('pointerdown',pool.handler);documents.delete(doc);}input.removeAttribute('role');input.removeAttribute('aria-autocomplete');input.removeAttribute('aria-controls');input.removeAttribute('aria-expanded');wrapper.before(input);wrapper.remove();}
    on(input,'input',()=>{active=-1;render();});on(input,'focus',()=>{active=-1;render();});
    on(input,'keydown',event=>{
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
      const css=style(node),basis=number(css.flexBasis);if(number(css.flexGrow)>0&&basis>0)return Math.max(number(css.minWidth),basis)+margins(css);
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
          available-=siblings.reduce((sum,node)=>{const sibling=style(node),basis=number(sibling.flexBasis);return sum+(number(sibling.flexGrow)>0&&basis?Math.max(number(sibling.minWidth),basis)+margins(sibling):outer(node));},0)+number(targetCSS.columnGap)*siblings.length;
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
    const controls=node('div','ui-floating-controls');
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
    const deployment=node('span','ui-floating-deployment');
    const identity=node('span','ui-floating-identity');
    const info=node('details','ui-floating-provenance');
    const summary=node('summary',null,'Versions & provenance');
    const fields=node('dl','ui-floating-source-list');
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
        const dt=node('dt',null,key),dd=node('dd',null,value);
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
  function visible(node){return Boolean(node.getClientRects().length)&&!node.closest('[hidden],dialog:not([open]),details:not([open]) > :not(summary)');}
  function nodes(scope){return [...scope.querySelectorAll(controls)].filter(node=>visible(node)&&!node.parentElement?.closest('.ui-field')&&!node.matches('.ui-item,[data-ui-surface],.ui-graphic-action,.ui-resize-handle'));}
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
      if(node.matches('.ui-action')){
        if(!node.matches('button,a,summary,label'))issue(node,'non-native-action','Use a native button, link, summary or labeled form control.');
        if(!node.querySelector(':scope > .ui-label'))issue(node,'missing-label','Adopt the action with the shared label helper.');
        const icon=node.querySelector(':scope > svg');if(icon&&!icon.matches('.ui-icon'))issue(node,'unshared-icon','Use the shared SVG icon role.');
        if(node.getAttribute('aria-busy')==='true'&&!node.querySelector('.ui-dynamic'))issue(node,'unreserved-busy-label','Declare labelStates for changing action text.','warning');
      }
      const rect=box(node),css=view.getComputedStyle(node),token=parseFloat(css.getPropertyValue(node.matches('.ui-field')?'--ui-field-height':'--ui-control-height'));
      if(token&&Math.abs(rect.height-token)>1)issue(node,'control-height-drift',`Expected ${token}px, rendered ${rect.height}px.`);
      const header=node.closest('.ui-header');if(header&&!node.closest('.ui-menu-panel,[data-ui-layout=bar]')){
        const bounds=header.getBoundingClientRect();if(rect.x<bounds.left-.75||rect.x+rect.width>bounds.right+.75)issue(node,'header-overflow','The command extends beyond its header.');
      }
    }
    for(let i=0;i<items.length;i++)for(let j=i+1;j<items.length;j++){
      const first=items[i],second=items[j];if(first.contains(second)||second.contains(first))continue;
      const a=box(first),b=box(second);if(Math.min(a.x+a.width,b.x+b.width)-Math.max(a.x,b.x)>.75&&Math.min(a.y+a.height,b.y+b.height)-Math.max(a.y,b.y)>.75)issue(second,'control-overlap',`Overlaps ${name(first)}.`);
    }
    return {version:UI.version,controls:items.length,issues};
  };
})();
