/* Optional native DOM helpers; no application state or rendering loop. */
(() => {
  'use strict';
  if(typeof window==='undefined'||!window.SharedUI)return;
  const UI=window.SharedUI,documents=new WeakMap();
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
  const fixedLabel='.primary,.ui-primary,[data-ui-variant=primary],[data-ui-label=always],[data-ui-label=hidden],.ui-item';
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
    function caption(node){const css=style(node);if(!context)return node.scrollWidth;context.font=css.font;const text=node.textContent.trim();return context.measureText(text).width+Math.max(0,text.length-1)*number(css.letterSpacing);}
    function actionWidth(node,compact=false){
      const css=style(node),label=node.querySelector(':scope > .ui-label'),icon=node.querySelector(':scope > svg.ui-icon');
      if(!label||!icon)return outer(node);
      const hidden=compact||node.dataset.uiLabel==='hidden';
      const glyph=number(style(icon).width)||18;
      const extra=node.tagName==='SUMMARY'&&!node.parentElement.matches(overflowSelector)?14:0;
      return Math.max(number(css.minWidth),glyph+(hidden?0:caption(label)+number(css.columnGap))+extra+sides(css))+margins(css);
    }
    function isAction(node){return node.matches(actionSelector);}
    function eligible(node){return isAction(node)&&!node.matches(fixedLabel)&&node.querySelector(':scope > svg.ui-icon')&&node.querySelector(':scope > .ui-label');}
    function contents(node){return node.matches(overflowSelector)?children(node).flatMap(child=>child.tagName==='SUMMARY'?[]:child.matches('.ui-actions')?children(child):[child]):children(node);}
    function width(node,compact,collapsed){
      if(node.matches(overflowSelector)){
        if(collapsed.has(node))return actionWidth(node.querySelector(':scope > summary'),true);
        return rowWidth(contents(node),style(node.querySelector(':scope > .ui-actions')||node),compact,collapsed);
      }
      if(isAction(node))return actionWidth(node,compact&&eligible(node));
      if(node.matches('.ui-actions.ui-inline,[data-ui-layout=inline]')||style(node).display==='contents')return rowWidth(children(node),style(node),compact,collapsed);
      if(node.tagName==='DETAILS'&&!node.open){const summary=node.querySelector(':scope > summary');if(summary&&isAction(summary))return actionWidth(summary,compact&&eligible(summary));}
      if(node.matches('.ui-field')&&!node.getBoundingClientRect().width){const css=style(node);return children(node).reduce((sum,child)=>{if(child.tagName==='SELECT'){const text=child.selectedOptions?.[0]?.label||child.value;context.font=style(child).font;return sum+context.measureText(text||'').width+24;}return sum+(child.matches('.ui-label')?caption(child):outer(child));},sides(css))+number(css.columnGap)*Math.max(0,node.children.length-1);}
      return outer(node);
    }
    function rowWidth(nodes,css,compact,collapsed){return nodes.reduce((sum,node)=>sum+width(node,compact,collapsed),0)+number(css.columnGap)*Math.max(0,nodes.length-1);}
    function descendants(nodes){return nodes.flatMap(node=>node.matches(overflowSelector)?descendants(contents(node)):node.matches('.ui-actions.ui-inline,[data-ui-layout=inline]')?descendants(children(node)):node.tagName==='DETAILS'?[node.querySelector(':scope > summary')].filter(Boolean):[node]);}
    function setCompact(node,value){if(value){if(!node.hasAttribute('data-ui-compact'))node.setAttribute('data-ui-compact','');}else if(node.hasAttribute('data-ui-compact'))node.removeAttribute('data-ui-compact');}
    function untrack(group){const item=groups.get(group);if(!item)return;groups.delete(group);pending.delete(group);const count=targets.get(item.target)-1;if(count)targets.set(item.target,count);else{targets.delete(item.target);observer.unobserve(item.target);}}
    function queue(group){if(disposed||paused)return;pending.add(group);if(!frame)frame=view.requestAnimationFrame(flush);}
    function fit(group,item){
      if(!group.isConnected){untrack(group);return;}
      // Overflow contents are governed by their outer group, including while closed.
      if(group.closest(overflowSelector))return;
      const css=style(group),nodes=children(group),actions=descendants(nodes).filter(eligible);
      const overflows=nodes.filter(node=>node.matches(overflowSelector));
      const vertical=group.dataset.uiLayout==='vertical'||css.flexDirection==='column';
      for(const node of actions)setCompact(node,false);
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
      const compact=!vertical&&rowWidth(nodes,css,false,collapsed)>limit;
      if(compact)for(const node of actions)setCompact(node,true);
      if(!vertical){
        // Higher numeric priority stays visible longer. Collapse entire authored groups.
        for(const node of [...overflows].sort((a,b)=>number(a.dataset.uiPriority)-number(b.dataset.uiPriority))){
          if(rowWidth(nodes,css,compact,collapsed)<=limit)break;
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
    const pool={register,refresh,dispose};pools.set(doc,pool);return pool;
  }
  UI.observeActions=group=>{const pool=poolFor(group.ownerDocument);pool?.register(group);return {refresh:()=>pool?.register(group)};};
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
