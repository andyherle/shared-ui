/* Native filter forms shared by tables, galleries and other collections. */
(() => {
  'use strict';
  if(typeof window==='undefined'||!window.SharedUI)return;
  const UI=window.SharedUI;
  UI.createFilterMenu=(form,{label='Filters',sprite,defaults={},onChange=()=>{}}={})=>{
    const element=form?.querySelector('details[data-ui-filter]'),summary=element?.querySelector('summary');
    if(form?.tagName!=='FORM'||!summary)throw new TypeError('Use a native form with details[data-ui-filter] and summary');
    const doc=form.ownerDocument,view=doc.defaultView,off=[];let disposed=false,active=0;
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
      for(const clear of form.querySelectorAll('[data-ui-filter-clear]')){if(clear.tagName==='BUTTON')clear.disabled=!active;else clear.setAttribute('aria-disabled',String(!active));}
      return state;
    }
    function emit(reason){const state=refresh();if(!disposed)onChange(state,{reason,active});}
    function clear(){if(disposed)return;for(const f of fields()){
      const wanted=normalize(baseline(f));
      if(f.type==='radio'||f.type==='checkbox')f.checked=wanted.includes(f.value);
      else if(f.multiple){for(const o of f.options)o.selected=wanted.includes(o.value);}
      else f.value=wanted[0]??'';
    }emit('clear');}
    function changed(event){if(event.target.form===form&&event.target.matches('[data-ui-filter-field]'))emit(event.type);}function externalChanged(event){if(event.target.closest('form')!==form)changed(event);}
    function click(event){if(event.target.closest('[data-ui-filter-clear]')?.closest('form')!==form)return;event.preventDefault();clear();}
    function key(event){if(event.key==='Escape'&&element.open&&!event.defaultPrevented){event.preventDefault();element.open=false;summary.focus({preventScroll:true});}}
    function listen(node,type,fn){node.addEventListener(type,fn);off.push(()=>node.removeEventListener(type,fn));}
    listen(form,'input',changed);listen(form,'change',changed);listen(doc,'input',externalChanged);listen(doc,'change',externalChanged);listen(form,'click',click);listen(element,'keydown',key);
    listen(view,'pagehide',event=>{if(!event.persisted)dispose();});
    function dispose(){if(disposed)return;disposed=true;for(const remove of off)remove();}
    refresh();return {element,get values(){return values();},get active(){return active;},refresh,clear,dispose};
  };
})();
