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
