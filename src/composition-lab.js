/* Generic synthetic composition fixture. Uses the same native factory as consumers. */
(() => {
  'use strict';
  const doc=document, UI=window.SharedUI, $=id=>doc.getElementById(id);
  const host=$('composition-host'); if(!host || !UI?.createComposition) return;
  const opts={variant:$('composition-variant'),crowding:$('composition-crowding'),
    width:$('composition-width'),state:$('composition-state'),override:$('composition-override')};
  const mk=(tag,cls,text)=>{const node=doc.createElement(tag);if(cls)node.className=cls;if(text!==undefined)node.textContent=text;return node;};
  const action=(name,icon,handler)=>{
    const b=mk('button','ui-action',name);b.type='button';
    UI.adoptAction(b,{icon,label:name,ariaLabel:name,sprite:'./v1/icons.svg'});
    if(handler)b.addEventListener('click',handler);
    return b;
  };
  const heading=mk('div','ui-stack');
  const title=mk('h3','ui-section-title','Sample review #0042');
  const subtitle=mk('p','ui-meta','Synthetic content · not connected to any application');
  heading.append(title,subtitle);
  const commands=mk('div','ui-actions');
  const select=action('Select','check',()=>{select.setAttribute('aria-pressed',String(select.getAttribute('aria-pressed')!=='true'));});
  const copy=action('Copy','copy',()=>setMessage('Synthetic reference copied · 0042','success'));
  const next=action('Next','arrow-right',()=>setMessage('Next synthetic review selected','success'));
  const overflow=mk('details','ui-disclosure ui-overflow');overflow.dataset.uiPriority='0';
  const summary=mk('summary','ui-action','More actions');summary.setAttribute('aria-label','More actions');
  UI.adoptAction(summary,{icon:'more',label:'More actions',ariaLabel:'More actions',sprite:'./v1/icons.svg'});
  const overflowActions=mk('div','ui-actions ui-disclosure-body');
  overflowActions.append(action('Flag','pin',()=>setMessage('Flagged for synthetic inspection','warning')),action('Clear','refresh',()=>setMessage('Selection cleared','success')));
  overflow.append(summary,overflowActions);commands.append(select,copy,next,overflow);
  const filters=mk('form','ui-actions');filters.id='composition-filter-form';
  const searchLabel=mk('label','ui-field');
  const searchCaption=mk('span','ui-label','Filter');
  const search=mk('input');search.type='search';search.name='filter';search.placeholder='Search fake items…';search.setAttribute('aria-label','Filter synthetic list');
  searchLabel.append(searchCaption,search);
  const filterButton=mk('button','ui-action','Apply filter');filterButton.type='submit';
  UI.adoptAction(filterButton,{icon:'filter',label:'Apply filter',sprite:'./v1/icons.svg'});
  filters.append(searchLabel,filterButton);
  const body=mk('div','ui-stack');
  const form=mk('form','ui-stack');form.id='composition-edit-form';
  const field=mk('label','ui-field');
  const fieldName=mk('span','ui-label','Title');const titleInput=mk('input');
  titleInput.name='title';titleInput.value='Quarterly source review';titleInput.required=true;titleInput.setAttribute('aria-label','Editable synthetic review title');
  field.append(fieldName,titleInput);
  const notesLabel=mk('label','ui-stack'),notesCaption=mk('span','ui-meta','Notes');
  const notes=mk('textarea');notes.rows=3;notes.name='notes';notes.value='Review a synthetic record. Typing, copy, paste, selection and IME remain native.';
  notes.setAttribute('aria-label','Editable synthetic notes');
  notesLabel.append(notesCaption,notes);
  form.append(field,notesLabel);
  const rowsTitle=mk('h4','ui-section-title','Synthetic references');
  const tableScroll=mk('div','ui-table-scroll');tableScroll.tabIndex=0;tableScroll.setAttribute('aria-label','Synthetic reference table');
  const table=mk('table','ui-table');table.dataset.uiVariant='sheet';
  const caption=mk('caption',null,'Example records · no customer data');
  const thead=mk('thead');const thRow=mk('tr');
  for(const name of ['ID','Title','State']){const th=mk('th',null,name);th.scope='col';thRow.append(th);}
  thead.append(thRow);const tbody=mk('tbody');table.append(caption,thead,tbody);tableScroll.append(table);
  const details=mk('details','ui-section');
  const detailsSummary=mk('summary');detailsSummary.append(mk('h5',null,'Additional native details'));
  const extra=mk('p',null,'Retains open state, focus and selection across layout changes.');
  details.append(detailsSummary,extra);
  const message=mk('output','ui-status');message.setAttribute('role','status');message.textContent='Ready for synthetic review';
  body.append(form,rowsTitle,tableScroll,details,message);
  const aside=mk('div','ui-stack');
  const asideTitle=mk('h4','ui-section-title','Source inspector');
  const asideMeta=mk('p','ui-meta','Non-sensitive synthetic metadata and layout context.');
  const nestedHeader=mk('h4','ui-section-title','Nested composition');
  const nestedBody=mk('p','ui-meta','This is the same canonical shell in a narrow inspector.');
  const nested=UI.createComposition('review-workspace',{header:nestedHeader,body:nestedBody},
    {variant:'split',crowding:'wrap',instanceId:'nested-sample'});
  aside.append(asideTitle,asideMeta,nested.element);
  const footer=mk('div','ui-actions');
  const save=mk('button','ui-action','Save synthetic edit');save.type='submit';save.setAttribute('form',form.id);
  UI.adoptAction(save,{icon:'save',label:'Save synthetic edit',sprite:'./v1/icons.svg'});
  const reset=action('Clear message','refresh',()=>setMessage('Ready for synthetic review','success'));
  footer.append(save,reset);
  const instance=UI.createComposition('review-workspace',
    {header:heading,toolbar:commands,filters,body,aside,footer},
    {variant:'standard',crowding:'wrap',instanceId:'synthetic-review'});
  host.append(instance.element);
  let attempts=0;
  const status=$('composition-layout-status');
  function setMessage(text,state){message.textContent=text;message.dataset.state=state;}
  function rowsFor(state){
    tbody.replaceChildren();
    const count=state==='empty'?0:state==='many'?84:4;
    const sample=state==='unicode'?'会議資料 • مرحبا بالعالم • é café 📝':state==='long'?'unbroken-abcdefghijklmnopqrstuvwxyz0123456789-'.repeat(5):'Synthetic reference';
    for(let i=0;i<count;i++){
      const row=mk('tr');
      for(const value of [String(i+1).padStart(3,'0'),sample+' '+(i+1),i%3?'Ready':'Review'])row.append(mk('td',null,value));
      tbody.append(row);
    }
    rowsTitle.textContent='Synthetic references · '+count;
  }
  function showState(){
    const state=opts.state.value;attempts=0;
    save.disabled=state==='disabled'||state==='loading';
    save.setAttribute('aria-busy',String(state==='loading'));
    title.textContent=state==='unicode'?'レビュー · مراجعة · 📝':'Sample review #0042';
    subtitle.textContent=state==='long'?'# Header 1\n## Heading 2\n- Markdown-shaped content — '+'超長字'.repeat(32):'Synthetic content · no private data';
    notes.value=state==='long'?'# H1\n## H2\n### H3\n#### H4\n##### H5\n###### H6\n- A long **Markdown** example.':
      state==='unicode'?'日本語 中文 العربية עברית ♻️ — editable via native IME':
      'Review a synthetic record. Typing, copy, paste, selection and IME remain native.';
    if(state==='empty')titleInput.value='';
    else if(state==='unicode')titleInput.value='資料 समीक्षा مراجعة';
    else if(state==='long')titleInput.value='Long title '+'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.repeat(5);
    else titleInput.value='Quarterly source review';
    rowsFor(state);
    const statuses={loading:['Loading synthetic records…','pending'],error:['Synthetic request failed. Submit to retry.','error'],
      conflict:['Stale revision; first save will conflict.','warning'],disabled:['Changes disabled in this fixture.','warning'],
      editing:['Editing live native fields','warning'],empty:['Empty list; title is required for save.','warning']};
    const [text,kind]=statuses[state]||['Ready for synthetic review','success'];setMessage(text,kind);
  }
  filters.addEventListener('submit',event=>{
    event.preventDefault();
    const q=search.value.trim().toLocaleLowerCase();
    const rows=[...tbody.rows];for(const tr of rows)tr.hidden=!tr.textContent.toLocaleLowerCase().includes(q);
    setMessage('Filter applied without losing field input','success');
  });
  form.addEventListener('submit',event=>{
    event.preventDefault();
    if (!form.reportValidity()) {setMessage('Native validation requires a title.','error');return;}
    attempts++;
    if(opts.state.value==='conflict'&&attempts===1){setMessage('409 stale revision · edit remains intact; retry save','error');return;}
    if(opts.state.value==='error'&&attempts===1){setMessage('503 synthetic failure · same input retained; retry save','error');return;}
    setMessage('Saved synthetic edit #'+attempts+' · no backend write','success');
  });
  function updateLayout(){
    const size=opts.width.value;
    host.style.inlineSize=size==='full'?'100%':`min(100%,${size}px)`;
    const asideWidth=opts.override.value;
    const overrides=asideWidth==='none'?{}:{aside:asideWidth,reason:'Reviewed wider synthetic inspector layout'};
    const savedTitle=titleInput.value,open=details.open,wasActive=doc.activeElement;
    const result=instance.setLayout({variant:opts.variant.value,crowding:opts.crowding.value,overrides});
    if(titleInput.value!==savedTitle||details.open!==open)throw new Error('Composition unexpectedly rebuilt live content');
    status.textContent='review-workspace@'+result.revision+' · '+result.variant+' · '+result.crowding+
      (result.overrides.aside?' · OVERRIDE aside '+result.overrides.aside+' (reason recorded)':' · canonical tokens')+
      ' · focused node '+(wasActive===doc.activeElement?'retained':'changed');
    status.dataset.state=result.overrides.aside?'warning':'success';
    UI.refreshActions?.(doc);
  }
  for(const id of ['variant','crowding','width','override'])opts[id].addEventListener('change',updateLayout);
  opts.state.addEventListener('change',showState);
  $('composition-reset').addEventListener('click',()=>{
    for(const [name,select] of Object.entries(opts))select.selectedIndex=0;
    details.open=false;search.value='';showState();updateLayout();
  });
  const query=new URL(location.href).searchParams;
  for(const [parameter,target] of [['compositionWidth',opts.width],['compositionState',opts.state],
      ['compositionVariant',opts.variant],['compositionCrowding',opts.crowding],['compositionOverride',opts.override]]){
    const value=query.get(parameter);
    if(value&&[...target.options].some(item=>item.value===value))target.value=value;
  }

  // A linked policy is shared by both synthetic views. The fields remain app-owned.
  const policyDemo=mk('section','ui-stack');policyDemo.id='composition-policy-demo';
  policyDemo.append(mk('h3','ui-section-title','Change one shared layout'));
  policyDemo.append(mk('p','ui-meta','Both groups follow one setting. Local choices remain explicit. These are synthetic views.'));
  const policyActions=mk('div','ui-actions'),layoutLabel=mk('label','ui-field'),layoutCaption=mk('span','ui-label','Group layout');
  const layout=mk('select');layout.setAttribute('aria-label','Shared control group layout');
  for(const [value,label]of [['stack','Stack'],['grid','Grid']]){const option=mk('option',null,label);option.value=value;layout.append(option);}
  layoutLabel.append(layoutCaption,layout);policyActions.append(layoutLabel);
  const output=mk('output','ui-meta');output.setAttribute('aria-live','polite');
  const scope=UI.createCompositionScope(),groups=[];
  const views=mk('div','ui-grid');
  for(const [index,label]of ['First view','Second view'].entries()){
    const fields=[];
    for(const name of ['Name','Description']){
      const fieldLabel=mk('label','ui-field'),caption=mk('span','ui-label',name),input=mk('input');
      input.setAttribute('aria-label',label+' '+name.toLowerCase());input.value='Synthetic '+name.toLowerCase();
      fieldLabel.append(caption,input);fields.push(fieldLabel);
    }
    const group=UI.createComposition('control-group',{header:mk('h4','ui-section-title',label),body:fields},{scope,instanceId:'policy-view-'+index});
    groups.push(group);views.append(group.element);
  }
  const pinLabel=mk('label','ui-check'),pin=mk('input');pin.type='checkbox';pinLabel.append(pin,mk('span',null,'Keep second view stacked'));
  function showPolicy(){const state=scope.getState();output.textContent=state.registered+' linked groups · second view '+groups[1].getConfiguration().layoutSources.variant;}
  layout.addEventListener('change',()=>{scope.setDefaults({'control-group':{variant:layout.value}},{expectedRevision:scope.getState().revision});showPolicy();});
  pin.addEventListener('change',()=>{groups[1].setLayout({variant:pin.checked?'stack':null});showPolicy();});
  policyActions.append(action('Use source defaults','refresh',()=>{scope.setDefaults({},{expectedRevision:scope.getState().revision});layout.value='stack';showPolicy();}));
  policyDemo.append(policyActions,pinLabel,views,output);host.parentElement.append(policyDemo);showPolicy();

  showState();updateLayout();
})();
