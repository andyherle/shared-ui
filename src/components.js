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
