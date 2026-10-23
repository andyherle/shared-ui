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
    on(doc,'toggle',event=>{const node=event.target;if(event.newState==='closed'||node.matches?.('details')&&!node.open){panelAnimations.get(node)?.cancel();for(const child of node.children||[])panelAnimations.get(child)?.cancel();}if(event.newState==='open'||node.open){if(node.matches?.('details')){for(const body of node.children||[])if(body.tagName!=='SUMMARY')animatePanel(body);}else if(node.matches?.('dialog,[popover]'))animatePanel(node);}},true);
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
  function createControlScale(root,{fontSize=12}={}){
    const doc=root.ownerDocument,view=doc.defaultView,style=root.style,coarse=view.matchMedia('(pointer:coarse)');
    const defaults={'control-height':30,'field-height':30,'tag-height':26,gap:6,'control-inset':8,'control-padding':'4px 8px','field-padding':'4px 8px','range-thumb':12,'range-width':128,'switch-width':36,'switch-height':22,'switch-thumb':16,'switch-inset':2,'control-icon':18};
    const names=[...Object.keys(defaults),'control-size','action-icon'].map(name=>'--ui-'+name);
    const previous=new Map(names.map(name=>[name,[style.getPropertyValue(name),style.getPropertyPriority(name)]]));
    let size,disposed=false;
    function restore(){for(const [name,[value,priority]]of previous)value?style.setProperty(name,value,priority):style.removeProperty(name);}
    function refresh(){
      if(disposed||doc.hidden)return;
      restore();
      const css=view.getComputedStyle(root),base=parseFloat(css.getPropertyValue('--ui-control-size'))||12;
      const effective=coarse.matches?Math.max(16,size):size,ratio=effective/base;
      // Read the baseline before writing: computed styles are live; scaling must never compound.
      const values=Object.entries(defaults).map(([name,fallback])=>[name,css.getPropertyValue('--ui-'+name).trim()||(name==='control-icon'&&css.getPropertyValue('--ui-action-icon').trim())||(typeof fallback==='number'?fallback+'px':fallback)]);
      for(const [name,value]of values){
        let scaled=value.replace(/(-?\d*\.?\d+)px\b/g,(_,n)=>(Number(n)*ratio)+'px');
        if(coarse.matches&&['control-height','field-height','tag-height'].includes(name))scaled=`max(44px, ${scaled})`;
        style.setProperty('--ui-'+name,scaled);
      }
      style.setProperty('--ui-control-size',effective+'px');
      style.setProperty('--ui-action-icon','var(--ui-control-icon)');
      api.refreshActions?.(doc);
    }
    function setFontSize(value){if(typeof value!=='number'||!Number.isFinite(value)||value<=0)throw new TypeError('Control font size must be a positive finite number');size=value;refresh();return size;}
    function hide(event){if(!event.persisted)dispose();}
    function dispose(){if(disposed)return;disposed=true;restore();coarse.removeEventListener('change',refresh);doc.removeEventListener('ui:styles',refresh);doc.removeEventListener('visibilitychange',refresh);view.removeEventListener('pageshow',refresh);view.removeEventListener('pagehide',hide);api.refreshActions?.(doc);}
    setFontSize(fontSize);coarse.addEventListener('change',refresh);doc.addEventListener('ui:styles',refresh);doc.addEventListener('visibilitychange',refresh);view.addEventListener('pageshow',refresh);view.addEventListener('pagehide',hide);
    return {setFontSize,refresh,dispose};
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
    adoptAction(button,{...(entry.icon?{icon:entry.icon}:state==='idle'?{}:{icon:state==='success'?'check':state==='error'?'warning':'refresh'}),...(label===undefined?{}:{label}),ariaLabel:message?entry.name+': '+message:entry.name,title:message||entry.name,sprite});entry.applying=false;
    let live=button.querySelector('[data-ui-feedback]');if(!live){live=button.ownerDocument.createElement('span');live.className='ui-sr-only';live.dataset.uiFeedback='action';live.setAttribute('role','status');live.setAttribute('aria-live','polite');button.append(live);}if(live.textContent!==message)live.textContent=message;return button;
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
    Object.assign(element.style,{position:'fixed',inset:'auto',margin:'0',maxInlineSize:'calc(100vw - 24px)',maxBlockSize:'calc(100dvh - 24px)'});
    const listen=(node,type,fn,options)=>{node.addEventListener(type,fn,options);off.push(()=>node.removeEventListener(type,fn,options));};
    function attach(next){anchor=next;anchorAttrs=attrs.map(name=>anchor.getAttribute(name));anchor.setAttribute('aria-haspopup','dialog');anchor.setAttribute('aria-controls',element.id);anchor.setAttribute('aria-expanded',String(shown));anchor.addEventListener('pointerdown',pointer);if(bindTrigger)anchor.addEventListener('click',toggle);}
    function detach(){anchor.removeEventListener('pointerdown',pointer);anchor.removeEventListener('click',toggle);attrs.forEach((name,i)=>anchorAttrs[i]===null?anchor.removeAttribute(name):anchor.setAttribute(name,anchorAttrs[i]));}
    function refresh(){if(disposed||!element.matches(':popover-open'))return;const r=anchor.getBoundingClientRect(),safe=Math.max(12,parseFloat(view.getComputedStyle(element).getPropertyValue('--ui-safe-inset'))||0),below=view.innerHeight-r.bottom-safe-6,above=r.top-safe-6;Object.assign(element.style,{maxInlineSize:Math.max(0,view.innerWidth-2*safe)+'px',maxBlockSize:Math.max(0,Math.max(below,above))+'px'});const p=element.getBoundingClientRect(),top=below>=p.height||below>=above?r.bottom+6:r.top-p.height-6;element.style.left=Math.max(safe,Math.min(r.left,view.innerWidth-p.width-safe))+'px';element.style.top=Math.max(safe,Math.min(top,view.innerHeight-p.height-safe))+'px';}
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
  function animatePanel(element){const view=element.ownerDocument.defaultView;panelAnimations.get(element)?.cancel();if(element.ownerDocument.hidden||view.matchMedia?.('(prefers-reduced-motion:reduce)').matches||typeof element.animate!=='function')return;const animation=element.animate([{opacity:.92,transform:'translateY(2px)'},{opacity:1,transform:'translateY(0)'}],{duration:90,easing:'ease-out'});panelAnimations.set(element,animation);animation.onfinish=animation.oncancel=()=>{if(panelAnimations.get(element)===animation)panelAnimations.delete(element);};return animation;}

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

  const api={version:'1.18.0',setActionLayout,createAdaptiveDensity,createControlScale,animatePanel,createAnchoredPopover,createResponsiveSlot,mount,release,adoptAction,adoptNumberedAction,setActionState,runAction,reserveText,setText,setCardColor,resolveCardColor,createCardColorResolver,setSelection,setSortDirection,setAppColor,createBackToTop,createZoom,installZoomShortcuts,createZoomFeedback,createReviewControls,createContextToolbar,createResizablePanel,createValueTransition,createZoomSteps,createTableSort,createTableToolbar,createColumnDrag,createColumnManager,createColumnResize,createLightbox,createGuide,setActionLabel:(element,label,options={})=>adoptAction(element,{...options,label}),source:DEFAULT_SOURCE};
  if(typeof module==='object'&&module.exports)module.exports=api;
  if(typeof window!=='undefined'&&typeof document!=='undefined'){
    window.SharedUI=api;api.setMode=mode=>{if(!api.instance)api.instance=mount(document);api.instance.setMode?.(mode);};
    function start(){if(!api.instance)api.instance=mount(document);}
    if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
  }
})();
