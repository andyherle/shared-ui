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
  function adoptAction(element,{icon,label,labelStates,ariaLabel,iconOnly,title,sprite='./shared-ui/icons.svg'}={}){
    if(!element?.matches?.('button,a,summary'))throw new TypeError('A native button, link or summary is required');
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
  function setCardColor(card,color){
    if(color==null){delete card.dataset.uiColor;card.style.removeProperty('--ui-card-fill');card.style.removeProperty('--ui-card-ink');return;}
    if(typeof color!=='string'||!/^#[0-9a-f]{6}$/i.test(color))throw new TypeError('A six-digit card color is required');
    const rgb=[1,3,5].map(i=>parseInt(color.slice(i,i+2),16)/255).map(c=>c<=.04045?c/12.92:((c+.055)/1.055)**2.4);
    const luminance=rgb[0]*.2126+rgb[1]*.7152+rgb[2]*.0722;
    card.dataset.uiColor=color.toLowerCase();card.style.setProperty('--ui-card-fill',color);card.style.setProperty('--ui-card-ink',luminance<.2?'#ffffff':'#111111');
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
  const api={version:'1.10.0',mount,release,adoptAction,reserveText,setText,setCardColor,setSelection,setSortDirection,setAppColor,createBackToTop,createZoom,createColumnDrag,createColumnResize,createLightbox,setActionLabel:(element,label,options={})=>adoptAction(element,{...options,label}),source:DEFAULT_SOURCE};
  if(typeof module==='object'&&module.exports)module.exports=api;
  if(typeof window!=='undefined'&&typeof document!=='undefined'){
    window.SharedUI=api;api.setMode=mode=>{if(!api.instance)api.instance=mount(document);api.instance.setMode?.(mode);};
    function start(){if(!api.instance)api.instance=mount(document);}
    if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
  }
})();
