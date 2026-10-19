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
    on(doc,'toggle',event=>{const menu=event.target;if(menu.matches?.('details.ui-menu')){if(menu.open){openedMenus.add(menu);api.positionMenu?.(menu);}else openedMenus.delete(menu);}},true);
    on(doc,'click',event=>{for(const menu of openedMenus)if(!menu.contains(event.target))closeMenu(menu);});
    on(doc,'keydown',event=>{if(event.key!=='Escape')return;const menu=event.target.closest?.('details.ui-menu')||[...(doc.querySelectorAll?.('details.ui-menu[open]')||[])].at(-1);if(menu?.open){event.preventDefault();closeMenu(menu,{focus:true});}});
    const positionMenus=()=>{if(doc.visibilityState!=='hidden')for(const menu of openedMenus)api.positionMenu?.(menu);};
    on(view,'resize',positionMenus);on(doc,'scroll',event=>{if(!event.target.closest?.('.ui-menu-panel'))positionMenus();},true);on(doc,'ui:styles',positionMenus);
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
  const api={version:'1.12.0',mount,release,adoptAction,setActionState,runAction,reserveText,setText,setCardColor,resolveCardColor,createCardColorResolver,setSelection,setSortDirection,setAppColor,createBackToTop,createZoom,installZoomShortcuts,createZoomFeedback,createValueTransition,createZoomSteps,createColumnDrag,createColumnResize,createLightbox,setActionLabel:(element,label,options={})=>adoptAction(element,{...options,label}),source:DEFAULT_SOURCE};
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
  // Bulk controls retain native details, text, and the host's persistence owner.
  UI.createSectionActions=({root,actions,selector='details.ui-section',onChange=()=>{}}={})=>{
    if(!root||!actions||root.ownerDocument!==actions.ownerDocument)throw new TypeError('Section actions need a root and native action group in one document');
    const doc=root.ownerDocument,buttons=[true,false].map(open=>{const button=doc.createElement('button');button.type='button';UI.adoptAction(button,{label:open?'Expand all':'Collapse all',icon:open?'chevron-down':'chevron-up'});actions.append(button);return button;});
    const sections=()=>[...root.querySelectorAll(selector)].filter(node=>!node.closest('[hidden]'));
    const refresh=()=>{const nodes=sections();actions.hidden=!nodes.length;buttons[0].disabled=!nodes.some(node=>!node.open);buttons[1].disabled=!nodes.some(node=>node.open);};
    const set=open=>{const nodes=sections();for(const node of nodes)node.open=open;onChange({open,sections:nodes});refresh();};
    const expand=()=>set(true),collapse=()=>set(false);buttons[0].addEventListener('click',expand);buttons[1].addEventListener('click',collapse);root.addEventListener('toggle',refresh,true);UI.observeActions?.(actions);refresh();
    return {refresh,expand,collapse,dispose(){buttons[0].removeEventListener('click',expand);buttons[1].removeEventListener('click',collapse);root.removeEventListener('toggle',refresh,true);UI.releaseActions?.(actions);for(const button of buttons)button.remove();}};
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
  UI.createPanelToggles=({items,selected=[],maxSelected=2,onChange=()=>{}}={})=>{
    if(!Array.isArray(items)||!items.length||items.some(x=>!x.id||!x.button||!x.panel))throw new TypeError('Panel toggles need named native buttons and panels');
    const ids=new Set(items.map(x=>x.id)),off=[];if(ids.size!==items.length||!Number.isInteger(maxSelected)||maxSelected<1)throw new TypeError('Use unique panel IDs and a positive panel limit');let active=[];
    const clean=list=>[...new Set(list)].filter(id=>ids.has(id)).slice(-Math.max(1,maxSelected));
    const set=(list,{notify=true}={})=>{active=clean(list);for(const item of items){const visible=active.includes(item.id);item.button.setAttribute('aria-pressed',String(visible));item.button.setAttribute('aria-controls',item.panel.id);item.panel.hidden=!visible;}if(notify)onChange([...active]);return [...active];};
    const show=id=>set([...active.filter(x=>x!==id),id]);
    for(const item of items){
      const click=()=>set(active.includes(item.id)?active.filter(x=>x!==item.id):[...active,item.id]);
      const key=event=>{if(!['ArrowLeft','ArrowRight','Home','End'].includes(event.key))return;event.preventDefault();const enabled=items.filter(x=>!x.button.disabled),index=enabled.indexOf(item);(event.key==='Home'?enabled[0]:event.key==='End'?enabled.at(-1):enabled[(index+(event.key==='ArrowRight'?1:-1)+enabled.length)%enabled.length])?.button.focus();};
      item.button.addEventListener('click',click);item.button.addEventListener('keydown',key);off.push(()=>{item.button.removeEventListener('click',click);item.button.removeEventListener('keydown',key);});
    }
    set(selected,{notify:false});return {set,show,get selected(){return [...active];},dispose(){for(const remove of off)remove();}};
  };
  // Inspector rows share name/action/value columns; original controls stay alive.
  UI.adoptPropertyRow=(row,{name,control,actions}={})=>{
    if(!row||!control||row.ownerDocument!==control.ownerDocument||actions&&row.ownerDocument!==actions.ownerDocument)throw new TypeError('Property rows require controls from one document');
    const doc=row.ownerDocument;
    if(!actions){actions=doc.createElement('div');actions.className='ui-actions ui-inline';actions.hidden=true;}
    const input=control.matches?.('input,select,textarea')?control:control.querySelector('input,select,textarea');
    let label=row.querySelector(':scope > [data-ui-property-label]');
    if(!label){label=doc.createElement('label');label.dataset.uiPropertyLabel='';label.className='ui-label';row.prepend(label);}
    label.textContent=String(name);label.title=String(name);if(input){if(!input.id)input.id='ui-property-'+doc.defaultView.crypto.randomUUID();label.htmlFor=input.id;}
    row.classList.add('ui-property-row');Object.assign(row.style,{display:'grid',gridTemplateColumns:'minmax(0,1fr) auto minmax(0,clamp(45%,calc(100% - 2 * var(--ui-control-height) - 10ch),60%))',alignItems:'center',gap:'var(--ui-gap)',marginBlock:'0',minInlineSize:'0',inlineSize:'100%'});
    Object.assign(label.style,{gridColumn:'1',gridRow:'1',minInlineSize:'0',overflowWrap:'anywhere'});
    Object.assign(actions.style,{gridColumn:'2',gridRow:'1',minInlineSize:'0',justifyContent:'flex-end'});
    control.dataset.uiPropertyValue='';
    Object.assign(control.style,{gridColumn:'3',gridRow:'1',minInlineSize:'0',inlineSize:'100%',maxInlineSize:'100%'});
    row.append(actions,control);return {element:row,label,control,actions};
  };
  const propertyActions=new WeakMap();
  UI.setPropertyAction=(row,options={})=>{
    let label=row.querySelector('[data-ui-property-label]')||row.querySelector('.parameter-head > label,.parameter-head > strong');if(!label)return;
    let entry=propertyActions.get(row);
    if(!entry&&(typeof options.onReset==='function'||typeof options.onActivate==='function')){
      const button=row.ownerDocument.createElement('button');button.type='button';button.dataset.uiPropertyLabel='';button.dataset.uiSurface='graphic';
      button.style.color=label.style.color;Object.assign(button.style,{gridColumn:'1',gridRow:'1',textAlign:'start',justifyContent:'start',justifySelf:'stretch',margin:'0',padding:'0'});
      const name=label.textContent;UI.adoptAction(button,{label:name});label.replaceWith(button);label=button;
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
      const rect=input.getBoundingClientRect(),width=Math.min(Math.max(rect.width,240),view.innerWidth-16);
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
