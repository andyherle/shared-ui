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
