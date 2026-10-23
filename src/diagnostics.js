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
