// Optional PDF.js renderer. Hosts own source authorization and bundle PDF.js locally.
export async function openPDF(stage, source, options = {}) {
  const signal = options.signal || new AbortController().signal;
  if (signal.aborted) return ()=>{};
  try {
    return await renderPDF(stage, source, {...options, signal});
  } catch (error) {
    if (signal.aborted) return ()=>{};
    // Some browser engines cannot run every PDF.js operation. Keep the same
    // authorized, version-pinned document inside the browser's PDF viewer.
    const url=options.fallbackUrl || (typeof source==='string' ? source : '');
    if (!url) throw error;
    const doc = stage.ownerDocument;
    const message = doc.createElement('p'); message.className='ui-meta';
    message.textContent='Using browser PDF preview. Open original or Download if it does not display.';
    const frame = doc.createElement('iframe'); frame.style.width='100%';frame.style.height='65vh';frame.style.border='0';
    frame.title=options.title || 'PDF document'; frame.src=url;
    const cleanup=()=>{frame.removeAttribute('src');frame.remove();signal.removeEventListener('abort',cleanup);};
    signal.addEventListener('abort',cleanup,{once:true});
    stage.replaceChildren(message,frame);
    return cleanup;
  }
}

async function renderPDF(stage, source, {signal, page: initialPage = 1, assetBase, sprite, loadLibrary} = {}) {
  const doc=stage.ownerDocument, view=doc.defaultView;
  const base=new URL(assetBase,doc.baseURI);
  const pdfjs = await (loadLibrary || (()=>import(new URL('pdf.min.mjs',base).href)))();
  if (signal.aborted) return ()=>{};
  pdfjs.GlobalWorkerOptions.workerSrc = new URL('pdf.worker.min.mjs',base).href;
  const data=source instanceof ArrayBuffer ? new Uint8Array(source.slice(0)) :
    ArrayBuffer.isView(source) ? new Uint8Array(source.buffer.slice(source.byteOffset,source.byteOffset+source.byteLength)) : null;
  const loading = pdfjs.getDocument({...data ? {data} : {url:source},
    cMapUrl:new URL('cmaps/',base).href,cMapPacked:true,
    standardFontDataUrl:new URL('standard_fonts/',base).href,wasmUrl:new URL('wasm/',base).href,
    isEvalSupported:false,enableXfa:false});
  let disposed = false, renderTask, observer, frame, zoomControl, sequence = 0;
  const cleanup = ()=>{
    if (disposed) return;
    disposed = true; sequence++; renderTask?.cancel(); observer?.disconnect();zoomControl?.dispose();
    signal.removeEventListener('abort',cleanup);view.removeEventListener('pagehide',onLeave);
    view.cancelAnimationFrame(frame); Promise.resolve(loading.destroy()).catch(()=>{}); stage.querySelectorAll('canvas').forEach(c=>{c.width=c.height=0;});
  };
  const onLeave=event=>{if(!event.persisted)cleanup();};
  signal.addEventListener('abort', cleanup, {once:true});view.addEventListener('pagehide',onLeave);
  try {
    const pdf = await loading.promise;
    if (disposed) return cleanup;
    let number = initialPage, zoom = 1;
    const controls = doc.createElement('div'); controls.className='ui-actions';
    const previous = doc.createElement('button'), next = doc.createElement('button');
    const field = doc.createElement('label'); field.className='ui-field';
    const caption = doc.createElement('span'); caption.className='ui-label'; caption.textContent=`Page / ${pdf.numPages}`;
    const input = doc.createElement('input'); input.type='number'; input.min='1'; input.max=String(pdf.numPages); input.value=String(number); input.setAttribute('aria-label','PDF page');
    field.append(caption,input);
    for (const [button,label,icon] of [[previous,'Previous page','arrow-left'],[next,'Next page','arrow-right']]) {
      button.type='button'; view.SharedUI.adoptAction(button,{label,icon,iconOnly:true,sprite});
    }
    const zoomGroup = doc.createElement('div'); zoomGroup.className='ui-actions ui-inline';zoomGroup.setAttribute('aria-label','PDF zoom');
    for (const direction of ['out','in']) {const button=doc.createElement('button');button.type='button';button.dataset.uiZoom=direction;zoomGroup.append(button);}
    const sheet = doc.createElement('div'); sheet.className='ui-stack';sheet.style.minWidth='0';sheet.style.maxWidth='100%';sheet.style.overflow='auto';
    const render = async()=>{
      const current=++sequence; renderTask?.cancel();
      if (number<1||number>pdf.numPages) throw new Error(`Recorded page ${number} is outside this ${pdf.numPages}-page document.`);
      const page=await pdf.getPage(number); if(disposed||current!==sequence)return;
      const base=page.getViewport({scale:1});
      const width=Math.max(240,stage.clientWidth||640)*zoom;
      const scale=Math.min(width*Math.min(view.devicePixelRatio||1,2)/base.width,4096/Math.max(base.width,base.height));
      const viewport=page.getViewport({scale});
      const canvas=doc.createElement('canvas');canvas.width=Math.ceil(viewport.width);canvas.height=Math.ceil(viewport.height);
      canvas.style.width=`${width}px`;canvas.style.height='auto';canvas.style.display='block';canvas.setAttribute('aria-label',`PDF page ${number} of ${pdf.numPages}`);canvas.setAttribute('role','img');
      renderTask=page.render({canvasContext:canvas.getContext('2d',{alpha:false}),viewport,annotationMode:pdfjs.AnnotationMode.ENABLE});
      await renderTask.promise;
      if(disposed||current!==sequence){canvas.width=canvas.height=0;return;}
      sheet.querySelectorAll('canvas').forEach(c=>{c.width=c.height=0;});sheet.replaceChildren(canvas);
      const text=await page.getTextContent();if(disposed||current!==sequence)return;
      const accessible=doc.createElement('p');accessible.className='ui-sr-only';accessible.textContent=text.items.map(i=>i.str||'').join(' ');sheet.append(accessible);
      input.value=String(number);previous.disabled=number<=1;next.disabled=number>=pdf.numPages;page.cleanup();
    };
    const update=()=>render().catch(error=>{if(error.name!=='RenderingCancelledException'&&!disposed){sheet.textContent=error.message;}});
    previous.addEventListener('click',()=>{number--;update();});next.addEventListener('click',()=>{number++;update();});
    input.addEventListener('change',()=>{number=Number(input.value);if(!Number.isInteger(number))number=1;update();});
    zoomControl=view.SharedUI.createZoom(zoomGroup,{min:.5,max:2,step:.25,value:1,onChange:value=>{zoom=value;update();},sprite});
    controls.append(previous,field,next,zoomGroup);stage.replaceChildren(controls,sheet);
    await render();
    let width=stage.clientWidth;
    observer=new view.ResizeObserver(()=>{if(!disposed&&width!==stage.clientWidth){width=stage.clientWidth;view.cancelAnimationFrame(frame);frame=view.requestAnimationFrame(update);}});observer.observe(stage);
    return cleanup;
  } catch(error) {cleanup();throw error;}
}
