/* Public synthetic fixture only. Not device measurements or application data. */
(() => {
 const UI=globalThis.SharedUI,roots=[...document.querySelectorAll('[data-debug-example]')];if(!UI?.createDebugPanel)return;
 const panels=[];let cursor=72;
 function packet(count,epoch){
  const channels=Array.from({length:count},(_,index)=>{
   const boolean=index%7===0,group=['Geometry','Motion','Solver','Runtime'][index%4];
   const value=x=>boolean?(Math.floor((x+index)/12)%2===0):Math.sin(x/(5+index%19)+index*.27)*(1+index%9)+Math.cos(x/23)*.3;
   return {id:group.toLowerCase()+'.channel_'+String(index).padStart(3,'0'),label:group.toLowerCase()+'.channel_'+String(index).padStart(3,'0'),kind:boolean?'boolean':'number',group,unit:boolean?'':'rel',value:value(cursor),basis:'Synthetic deterministic catalogue fixture',samples:Array.from({length:161},(_,x)=>({x,value:x===80&&index%11===0?null:value(x)}))};
  });
  return {version:1,epoch,title:epoch==='catalogue-a'?'Synthetic motion evaluator':'Independent host / solver',cursor,axis:{label:'Frame',unit:'fr'},status:'SYNTHETIC FIXTURE · NOT TELEMETRY',channels,
   traces:Array.from({length:32},(_,index)=>({id:'cue-'+index,x:index*4,op:index%3?'STATE':'CUE',text:'Synthetic fixture record',fields:{enabled:true,iteration:index,weight:Number(Math.sin(index).toFixed(5)),source:'fixture'}})),
   provenance:['Synthetic deterministic demonstration. No private application data.','Both instances use the same component; selection, freeze, view and cursor are independent.']};
 }
 roots.forEach((root,index)=>{const panel=UI.createDebugPanel({title:'Debug',view:index?'program':'overwhelm',sprite:'./v1/icons.svg'});root.append(panel.element);panels.push(panel);panel.update(packet(index?24:96,index?'catalogue-b':'catalogue-a'));});
 document.getElementById('debug-advance')?.addEventListener('click',()=>{cursor=(cursor+8)%161;panels.forEach((panel,index)=>panel.update(packet(index?24:96,index?'catalogue-b':'catalogue-a')));});
 document.getElementById('debug-pack')?.addEventListener('change',event=>{document.documentElement.dataset.ui=event.target.value;panels.forEach(panel=>panel.refresh());});
 document.getElementById('debug-theme')?.addEventListener('change',event=>{document.documentElement.dataset.theme=event.target.value;panels.forEach(panel=>panel.refresh());});
 window.addEventListener('pagehide',()=>panels.forEach(panel=>panel.destroy()),{once:true});
})();
