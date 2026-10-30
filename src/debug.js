/* Optional, read-only debug surface. No transport, storage, network or application state.
 * Load the reviewed shared runtime first. See docs/DEBUG.md for the packet contract.
 */
(() => {
  'use strict';
  const UI = globalThis.SharedUI;
  if (!UI) throw new Error('Load SharedUI runtime before the debug component');
  const LIMITS = Object.freeze({channels:512, samples:2048, traces:2048, text:512});
  const finite = value => typeof value === 'number' && Number.isFinite(value);
  const number = value => typeof value === 'boolean' ? Number(value) : finite(value) ? value : null;
  const text = (value, size=LIMITS.text) => String(value ?? '').slice(0,size);
  const scalar = value => value === null || typeof value === 'boolean' || finite(value) ? value : typeof value === 'string' ? text(value) : null;
  const format = value => value === null || value === undefined ? '—' : typeof value === 'number' ? (Number.isInteger(value) ? String(value) : Number(value.toPrecision(6)).toString()) : text(value);
  const dict = () => Object.create(null);
  // Input is a declarative packet, never arbitrary executable code or HTML.
  function normalize(input) {
    if (input?.version !== 1) throw new Error('Unsupported debug packet version');
    const notices=[], seen=new Set();
    const channels=(Array.isArray(input.channels)?input.channels:[]).slice(0,LIMITS.channels).flatMap(source=>{
      const id=text(source?.id,180); if(!id || seen.has(id)) return []; seen.add(id);
      const points=new Map();
      const raw=Array.isArray(source.samples)?source.samples:[];
      if(raw.length>LIMITS.samples)notices.push(id+': latest '+LIMITS.samples+' supplied samples retained');
      for(const point of raw.slice(-LIMITS.samples))if(finite(point?.x))points.set(point.x,{x:point.x,value:scalar(point.value)});
      const samples=[...points.values()].sort((a,b)=>a.x-b.x);
      const domain=Array.isArray(source.domain)&&source.domain.length===2&&source.domain.every(finite)&&source.domain[1]>source.domain[0]?source.domain.slice():null;
      return [{id,label:text(source.label||id),group:text(source.group||'Channels'),kind:['number','boolean','text'].includes(source.kind)?source.kind:typeof source.value==='boolean'?'boolean':finite(source.value)?'number':'text',unit:text(source.unit,40),basis:text(source.basis||'Host supplied'),value:scalar(source.value),samples,domain}];
    });
    if((input.channels?.length||0)>channels.length)notices.push('Channel limit / duplicate IDs: '+channels.length+' of '+input.channels.length+' accepted');
    const traces=(Array.isArray(input.traces)?input.traces:[]).slice(-LIMITS.traces).map((source,index)=>{
      const fields=dict();for(const [key,value]of Object.entries(source?.fields||{}).slice(0,32))fields[text(key,80)]=scalar(value);
      return {id:text(source?.id??index,180),x:finite(source?.x)?source.x:null,op:text(source?.op||'TRACE',40),level:['warning','error'].includes(source?.level)?source.level:'info',text:text(source?.text),fields};
    });
    if((input.traces?.length||0)>traces.length)notices.push('Latest '+LIMITS.traces+' trace records retained');
    const provenance=(Array.isArray(input.provenance)?input.provenance:[]).slice(0,20).map(value=>text(value));
    return {version:1,epoch:text(input.epoch,180),title:text(input.title||'Debug'),cursor:finite(input.cursor)?input.cursor:null,axis:{label:text(input.axis?.label||'Sample',60),unit:text(input.axis?.unit||'',24)},status:text(input.status),channels,traces,provenance,notices:[...notices,...(Array.isArray(input.notices)?input.notices:[]).slice(0,12).map(value=>text(value))]};
  }
  function extent(channels) {
    let low=Infinity,high=-Infinity;
    for(const channel of channels)for(const point of channel.samples){low=Math.min(low,point.x);high=Math.max(high,point.x);}
    return low===Infinity?[0,1]:low===high?[low-.5,high+.5]:[low,high];
  }
  function range(channel) {
    if(channel.domain)return channel.domain;
    let low=Infinity,high=-Infinity;
    for(const point of channel.samples){const v=number(point.value);if(v!==null){low=Math.min(low,v);high=Math.max(high,v);}}
    if(low===Infinity)return [0,1];
    if(low===high){const pad=Math.max(.5,Math.abs(low)*.05);return [low-pad,high+pad];}
    return [low,high];
  }
  // Min/max buckets keep narrow spikes. Null samples break paths, including after reduction.
  function decimate(points, budget=600) {
    budget=Math.max(8,Math.floor(budget));if(points.length<=budget)return points;
    const size=Math.ceil(points.length/Math.max(1,Math.floor(budget/5))),out=[];
    for(let i=0;i<points.length;i+=size){
      const chunk=points.slice(i,i+size);const indices=new Set([0,chunk.length-1]);let min=-1,max=-1;
      for(let j=0;j<chunk.length;j++){const value=number(chunk[j].value);if(value===null){indices.add(j);continue;}if(min<0||value<number(chunk[min].value))min=j;if(max<0||value>number(chunk[max].value))max=j;}
      if(min>=0)indices.add(min);if(max>=0)indices.add(max);
      for(const j of [...indices].sort((a,b)=>a-b))out.push(chunk[j]);
    }return out;
  }
  function nearest(points,x){let best=null,delta=Infinity;for(const point of points){const d=Math.abs(point.x-x);if(d<delta){delta=d;best=point;}}return best;}
  function programLine(record,index=0,axis='F') {
    const fields=Object.entries(record.fields||{}).map(([key,value])=>key+'='+JSON.stringify(value)).join(' ');
    return 'N'+String(index+1).padStart(5,'0')+' '+axis+format(record.x).padStart(8,' ')+' '+record.op.padEnd(9,' ')+' '+fields+(record.text?' ; '+record.text:'');
  }
  UI.debugModel=Object.freeze({normalize,extent,range,decimate,nearest,format,programLine,limits:LIMITS});

  UI.createDebugPanel=function createDebugPanel({document:doc=globalThis.document,adapter=null,title='Debug',view='overview',onError=()=>{},sprite,controlsHost=null}={}) {
    if(!doc?.createElement)throw new Error('A DOM document is required');
    if(controlsHost&&controlsHost.ownerDocument!==doc)throw new Error('Debug controls must share their panel document');
    const win=doc.defaultView,off=[],custom=new Map();
    let packet=normalize({version:1,title}),pending=null,frozen=false,disposed=false,visible=true,intersecting=true,request=0,page=0,hover=null,unsubscribe=null,connection=0,plugin=null;
    const selected=new Set();let selectAll=true;
    const make=(tag,cls,content)=>{const node=doc.createElement(tag);if(cls)node.className=cls;if(content!==undefined)node.textContent=content;return node;};
    const listen=(node,event,callback,options)=>{node.addEventListener(event,callback,options);off.push(()=>node.removeEventListener(event,callback,options));};
    const colorProbe=make('span');colorProbe.hidden=true;
    const root=make('section','ui-debug ui-chrome');root.dataset.uiComponent='debug';root.setAttribute('aria-label',title);
    const head=make('header','ui-debug-head ui-toolbar'),caption=make('strong','ui-truncate',title),sample=make('output','ui-debug-sample');
    const toolbar=make('div','ui-actions ui-inline');toolbar.dataset.uiLabel='always';
    function action(label,icon){const node=make('button','',label);node.type='button';UI.adoptAction?.(node,{label,icon,sprite});return node;}
    function field(label,control){const node=make('label','ui-field');node.append(make('span','ui-label',label),control);return node;}
    const modes=make('select');modes.setAttribute('aria-label','Debug view');
    const modeLabels={overview:'Overview',scope:'All curves',lanes:'Channel lanes',metrics:'State matrix',program:'Machine listing',raw:'Raw packet',overwhelm:'Overwhelm'};
    for(const [id,label]of Object.entries(modeLabels)){const option=make('option','',label);option.value=id;modes.append(option);}modes.value=modeLabels[view]?view:'overview';
    const freeze=action('Freeze','pause'),copy=action('Copy snapshot','copy');freeze.setAttribute('aria-pressed','false');
    toolbar.append(field('View',modes),freeze,copy);head.append(caption,sample,toolbar);
    const filters=make('div','ui-debug-filters ui-toolbar'),search=make('input');search.type='search';search.placeholder='Filter channels / trace';search.setAttribute('aria-label','Filter debug data');
    const group=make('select');group.setAttribute('aria-label','Debug channel group');
    const scale=make('select');scale.setAttribute('aria-label','Graph scale');for(const [id,label]of [['normalized','Per-channel range'],['raw','Shared raw range']]){const option=make('option','',label);option.value=id;scale.append(option);}
    const channelsMenu=make('details','ui-disclosure'),channelsSummary=make('summary','','Channels'),channelsBody=make('div','ui-debug-channels');channelsMenu.append(channelsSummary,channelsBody);
    const all=action('All','layers'),none=action('None','close');const selectionActions=make('div','ui-actions');selectionActions.append(all,none);channelsBody.append(selectionActions);
    const channelOptions=make('div','ui-debug-channel-options');channelsBody.append(channelOptions);
    filters.append(field('Find',search),field('Group',group),field('Scale',scale),channelsMenu);
    const body=make('div','ui-debug-body'),metrics=make('section','ui-debug-metrics'),metricsTitle=make('strong','','Evaluated state'),grid=make('dl','ui-debug-grid');metrics.append(metricsTitle,grid);
    const graphs=make('section','ui-debug-graphs'),graphTitle=make('strong','','Driver curves'),canvas=make('canvas','ui-debug-plot');canvas.tabIndex=0;canvas.setAttribute('role','img');canvas.setAttribute('aria-label','Debug curves. Left and right arrows inspect samples.');
    const readout=make('output','ui-debug-readout'),legend=make('div','ui-debug-legend');graphs.append(graphTitle,canvas,readout,legend);
    const trace=make('section','ui-debug-trace'),traceTitle=make('strong','','Machine listing · diagnostic records, not executable G-code'),listing=make('pre','ui-debug-program');listing.tabIndex=0;listing.setAttribute('aria-label','Debug machine listing');trace.append(traceTitle,listing);
    const raw=make('pre','ui-debug-raw');raw.tabIndex=0;raw.setAttribute('aria-label','Normalized raw debug packet');
    body.append(metrics,graphs,trace,raw);
    const foot=make('footer','ui-debug-foot'),status=make('output','ui-debug-status'),prev=action('Previous page','chevron-left'),next=action('Next page','chevron-right'),pagination=make('div','ui-actions');pagination.append(prev,next);
    foot.append(status,pagination);
    const externalControls=controlsHost?make('div','ui-debug ui-chrome'):null;
    if(externalControls){externalControls.setAttribute('aria-label',title+' tools');externalControls.append(head,filters);controlsHost.append(externalControls);root.append(body,foot,colorProbe);}
    else root.append(head,filters,body,foot,colorProbe);
    const nodes=new Map();let channelSignature='',groupSignature='',dirty=true;
    function report(error){status.textContent=String(error?.message||error);onError(error);}
    function shownChannels(){const term=search.value.toLowerCase();return packet.channels.filter(channel=>(selectAll||selected.has(channel.id))&&(!group.value||channel.group===group.value)&&(!term||[channel.id,channel.label,channel.group].some(value=>value.toLowerCase().includes(term))));}
    function mark(){dirty=true;if(disposed||request||!visible||!intersecting||doc.hidden||!root.isConnected)return;request=win.requestAnimationFrame(()=>{request=0;if(!disposed&&visible&&!doc.hidden)paint();});}
    function syncOptions(){
      const groups=[...new Set(packet.channels.map(channel=>channel.group))];const sig=JSON.stringify(groups);
      if(sig!==groupSignature){const value=group.value;group.replaceChildren();for(const name of ['',...groups]){const option=make('option','',name||'All groups');option.value=name;group.append(option);}group.value=groups.includes(value)?value:'';groupSignature=sig;}
      const cs=JSON.stringify(packet.channels.map(channel=>[channel.id,channel.label]));
      if(cs!==channelSignature){
        channelOptions.replaceChildren();for(const channel of packet.channels){const label=make('label','ui-check'),input=make('input');input.type='checkbox';input.value=channel.id;input.checked=selectAll||selected.has(channel.id);label.append(input,make('span','ui-truncate',channel.label));label.title=channel.id;channelOptions.append(label);}channelSignature=cs;
      }
      for(const input of channelOptions.querySelectorAll('input'))input.checked=selectAll||selected.has(input.value);
      channelsSummary.textContent='Channels · '+(selectAll?packet.channels.length:selected.size);
    }
    function paintMetrics(channels){
      grid.querySelector('.ui-debug-empty')?.remove();
      const rows=channels.slice(page*96,page*96+96),active=new Set(rows.map(channel=>channel.id));
      for(const [id,pair]of nodes)if(!active.has(id)){pair.term.remove();pair.value.remove();nodes.delete(id);}
      let cursor=grid.firstChild;
      for(const channel of rows){let pair=nodes.get(channel.id);if(!pair){pair={term:make('dt'),value:make('dd')};nodes.set(channel.id,pair);}
        const label=channel.label+(channel.unit?' ['+channel.unit+']':'');pair.term.textContent=label;pair.term.title=channel.id+' · '+channel.basis;
        const value=format(channel.value);pair.value.dataset.changed=String(pair.value.textContent!==''&&pair.value.textContent!==value);pair.value.textContent=value;pair.value.title=value;
        for(const node of [pair.term,pair.value]){if(node!==cursor)grid.insertBefore(node,cursor);cursor=node.nextSibling;}
      }
      if(!rows.length&&!grid.firstChild)grid.append(make('span','ui-meta ui-debug-empty','No matching channels'));
    }
    function paintGraph(channels){
      const numeric=channels.filter(channel=>channel.kind!=='text'&&channel.samples.length),lanes=modes.value==='lanes';
      const series=lanes?numeric.slice(page*24,page*24+24):numeric;
      const rect=canvas.getBoundingClientRect(),dpr=Math.min(2,win.devicePixelRatio||1),width=Math.max(1,rect.width),height=lanes?Math.max(140,series.length*32+28):Math.max(120,rect.height);
      if(lanes)canvas.style.height=height+'px';else canvas.style.removeProperty('height');
      canvas.width=Math.round(width*dpr);canvas.height=Math.round(height*dpr);
      const c=canvas.getContext('2d');if(!c)return;c.scale(dpr,dpr);const style=win.getComputedStyle(root);
      const colors=new Map();
      const token=(name,fallback)=>{if(!colors.has(name)){colorProbe.style.color='var(--ui-debug-'+name+', var(--ui-'+fallback+'))';colors.set(name,win.getComputedStyle(colorProbe).color);}return colors.get(name);};
      c.font='10px '+(style.getPropertyValue('--ui-font-mono').trim()||'monospace');
      const [minX,maxX]=extent(series),left=lanes?125:8,right=8,top=16,bottom=20,plotWidth=Math.max(1,width-left-right),plotHeight=Math.max(1,height-top-bottom);
      const xOf=x=>left+(x-minX)/(maxX-minX)*plotWidth;
      c.strokeStyle=token('line','line');c.lineWidth=1;
      for(let i=0;i<=4;i++){const x=left+plotWidth*i/4;c.beginPath();c.moveTo(x,top);c.lineTo(x,height-bottom);c.stroke();}
      const ranges=series.map(range);let rawMin=Math.min(...ranges.map(r=>r[0])),rawMax=Math.max(...ranges.map(r=>r[1]));
      for(let index=0;index<series.length;index++){
        const channel=series[index],[minY,maxY]=scale.value==='raw'?[rawMin,rawMax]:ranges[index],offset=lanes?top+index*32:top,h=lanes?24:plotHeight;
        const yOf=y=>offset+h-(y-minY)/(maxY-minY)*h;
        c.strokeStyle=token('channel-'+(index%4+1),['accent','good','warning','text'][index%4]);c.lineWidth=lanes?1.1:1;c.globalAlpha=series.length>40&&!lanes ? .65 : 1;
        c.setLineDash(channel.kind==='boolean'?[4,3]:index%3===1?[7,2]:[]);c.beginPath();let previous=null;
        for(const point of decimate(channel.samples,Math.round(plotWidth*2))){const value=number(point.value);if(value===null){previous=null;continue;}const x=xOf(point.x),y=yOf(value);if(previous){if(channel.kind==='boolean')c.lineTo(x,previous.y);c.lineTo(x,y);}else c.moveTo(x,y);previous={x,y};}c.stroke();c.setLineDash([]);c.globalAlpha=1;
        if(lanes){c.fillStyle=token('muted','muted');c.fillText(channel.label.slice(0,19),4,offset+14);}
      }
      c.fillStyle=token('muted','muted');c.fillText(format(minX)+' '+packet.axis.unit,left,height-4);const end=format(maxX)+' '+packet.axis.unit;c.fillText(end,width-right-c.measureText(end).width,height-4);
      const at=hover??packet.cursor;
      if(finite(at)&&at>=minX&&at<=maxX){c.strokeStyle=token('text','text');c.beginPath();c.moveTo(xOf(at),top);c.lineTo(xOf(at),height-bottom);c.stroke();}
      if(!series.length)c.fillText('No supplied samples. Current values remain available in State matrix.',8,36);
      canvas._debugAxis={minX,maxX,left,plotWidth,series};
      graphTitle.textContent=(lanes?'Channel lanes':'Driver curves')+' · '+series.length+' / '+numeric.length;
      const inspected=hover===null?[]:series.slice(0,8).map(channel=>{const p=nearest(channel.samples,hover);return channel.label+'='+format(p?.value)+(channel.unit?' '+channel.unit:'')+' @'+format(p?.x);});
      readout.textContent=hover===null?(scale.value==='raw'?'Shared raw scale; inspect units before comparing.':'Per-channel normalization; native ranges shown below.'):'Nearest supplied samples · '+inspected.join(' · ');
      const key=series.map(channel=>channel.label+' ['+range(channel).map(format).join('…')+(channel.unit?' '+channel.unit:'')+']').join('   ');
      legend.textContent=key;legend.title=key;
    }
    function paint(){
      if(!dirty)return;dirty=false;syncOptions();const mode=modes.value,channels=shownChannels(),term=search.value.toLowerCase();
      const records=packet.traces.filter(record=>!term||programLine(record).toLowerCase().includes(term));
      const count=mode==='program'?records.length:mode==='lanes'?channels.filter(channel=>channel.kind!=='text'&&channel.samples.length).length:channels.length,per=mode==='program'?128:mode==='lanes'?24:96;
      page=Math.max(0,Math.min(page,Math.max(0,Math.ceil(count/per)-1)));
      root.dataset.debugView=mode;caption.textContent=packet.title||title;sample.textContent=(frozen?'FROZEN · ':'')+packet.axis.label+' '+format(packet.cursor)+' '+packet.axis.unit;
      metrics.hidden=!['overview','metrics','overwhelm'].includes(mode);graphs.hidden=!['overview','scope','lanes','overwhelm'].includes(mode);trace.hidden=!['program','overwhelm'].includes(mode);raw.hidden=mode!=='raw';
      if(!metrics.hidden)paintMetrics(channels);if(!graphs.hidden)paintGraph(channels);
      if(!trace.hidden){const rows=mode==='program'?records.slice(page*128,(page+1)*128):records.slice(-96);listing.textContent=rows.map((record,index)=>programLine(record,mode==='program'?page*128+index:Math.max(0,records.length-96)+index,packet.axis.unit==='s'?'T':'F')).join('\n')||'No trace records supplied.';}
      if(!raw.hidden){const serialized=JSON.stringify(packet,null,2);raw.textContent=serialized.slice(0,524288)+(serialized.length>524288?'\n[View truncated at 512 KiB; Copy snapshot includes the normalized packet.]':'');}
      status.textContent=[packet.status,channels.length+'/'+packet.channels.length+' channels',records.length+' records','page '+(page+1)+'/'+Math.max(1,Math.ceil(count/per))].filter(Boolean).join(' · ');
      prev.disabled=page===0;next.disabled=(page+1)*per>=count;pagination.hidden=['scope','raw'].includes(mode);
      if(plugin)try{plugin.update?.(packet,{channels,format});}catch(error){report(error);}
    }
    function setView(id){if(!modeLabels[id]&&!custom.has(id))throw new Error('Unknown debug view: '+id);plugin?.destroy?.();plugin=null;body.querySelector('.ui-debug-custom')?.remove();modes.value=id;page=0;hover=null;if(custom.has(id)){const container=make('section','ui-debug-custom');body.append(container);plugin=custom.get(id).mount(container,{document:doc,format});}mark();}
    function update(input){if(disposed)return;const nextPacket=normalize(input);if(frozen){pending=nextPacket;return;}if(nextPacket.epoch!==packet.epoch){page=0;hover=null;selected.clear();selectAll=true;}packet=nextPacket;mark();}
    function setFrozen(value){frozen=Boolean(value);freeze.setAttribute('aria-pressed',String(frozen));UI.setActionLabel?.(freeze,frozen?'Resume':'Freeze',{icon:frozen?'play':'pause',ariaLabel:frozen?'Resume':'Freeze',title:frozen?'Resume debug updates':'Freeze this debug snapshot',labelStates:['Freeze','Resume'],sprite});if(!frozen&&pending){const p=pending;pending=null;update(p);}mark();}
    function setVisible(value){visible=Boolean(value);root.hidden=!visible;if(externalControls)externalControls.hidden=!visible;if(!visible&&request){win.cancelAnimationFrame(request);request=0;}if(visible)mark();}
    function connect(source){unsubscribe?.();unsubscribe=null;const id=++connection;let received=false;if(!source)return;const receive=value=>{if(!disposed&&id===connection)try{update(value);}catch(error){report(error);}};const fail=error=>{if(!disposed&&id===connection)report(error);};try{if(source.subscribe)unsubscribe=source.subscribe(value=>{received=true;receive(value);})||null;Promise.resolve(source.snapshot?.()).then(value=>{if(value&&!received)receive(value);},fail);}catch(error){fail(error);}}
    listen(modes,'change',()=>setView(modes.value));listen(search,'input',()=>{page=0;mark();});listen(group,'change',()=>{page=0;mark();});listen(scale,'change',mark);
    listen(freeze,'click',()=>setFrozen(!frozen));listen(prev,'click',()=>{page--;mark();});listen(next,'click',()=>{page++;mark();});
    listen(all,'click',()=>{selectAll=true;selected.clear();page=0;mark();});listen(none,'click',()=>{selectAll=false;selected.clear();page=0;mark();});
    listen(channelOptions,'change',event=>{if(!event.target.matches('input'))return;if(selectAll){for(const channel of packet.channels)selected.add(channel.id);selectAll=false;}event.target.checked?selected.add(event.target.value):selected.delete(event.target.value);page=0;mark();});
    listen(copy,'click',async()=>{try{if(!win.navigator.clipboard?.writeText)throw new Error('Clipboard unavailable in this context');await win.navigator.clipboard.writeText(JSON.stringify(packet,null,2));status.textContent='Normalized snapshot copied';}catch(error){report(error);}});
    listen(canvas,'pointermove',event=>{const axis=canvas._debugAxis;if(!axis)return;hover=axis.minX+Math.max(0,Math.min(1,(event.clientX-canvas.getBoundingClientRect().left-axis.left)/axis.plotWidth))*(axis.maxX-axis.minX);mark();});listen(canvas,'pointerleave',()=>{hover=null;mark();});
    listen(canvas,'keydown',event=>{const axis=canvas._debugAxis;if(!axis||!['ArrowLeft','ArrowRight','Home','End','Escape'].includes(event.key))return;event.preventDefault();const step=(axis.maxX-axis.minX)/100;hover=event.key==='Escape'?null:event.key==='Home'?axis.minX:event.key==='End'?axis.maxX:Math.max(axis.minX,Math.min(axis.maxX,(hover??packet.cursor??axis.minX)+(event.key==='ArrowRight'?step:-step)));mark();});
    listen(doc,'visibilitychange',()=>{if(doc.hidden&&request){win.cancelAnimationFrame(request);request=0;}else mark();});
    const resize=win.ResizeObserver?new win.ResizeObserver(mark):null;resize?.observe(root);
    const intersection=win.IntersectionObserver?new win.IntersectionObserver(entries=>{intersecting=entries.at(-1)?.isIntersecting!==false;if(intersecting)mark();}):null;intersection?.observe(root);
    const api={element:root,update,connect,setView,setFrozen,setVisible,refresh:mark,
      getState:()=>({view:modes.value,frozen,visible,epoch:packet.epoch,channels:packet.channels.length,cursor:packet.cursor}),
      registerView(spec){if(!spec?.id||typeof spec.mount!=='function'||modeLabels[spec.id]||custom.has(spec.id))throw new Error('A debug view needs a unique ID and mount callback');custom.set(spec.id,spec);const option=make('option','',text(spec.label||spec.id));option.value=spec.id;modes.append(option);return()=>{if(modes.value===spec.id)setView('overview');custom.delete(spec.id);option.remove();};},
      destroy(){if(disposed)return;disposed=true;connection++;unsubscribe?.();plugin?.destroy?.();resize?.disconnect();intersection?.disconnect();if(request)win.cancelAnimationFrame(request);for(const remove of off)remove();root.remove();externalControls?.remove();pending=null;nodes.clear();custom.clear();}
    };
    if(adapter)connect(adapter);mark();return api;
  };
})();
