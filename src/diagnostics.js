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
