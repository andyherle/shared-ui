import {openPDF} from './v1/pdf-preview.mjs';
const root=document.querySelector('#preview'),status=document.querySelector('#status');let controller;
for(const [id,label,icon]of [['open','Open preview','file'],['close','Close preview','close'],['narrow','Narrow','smartphone'],['wide','Wide','fullscreen'],['pack','Change pack','settings']])SharedUI.adoptAction(document.getElementById(id),{label,icon,sprite:'./v1/icons.svg'});
const sdk={GlobalWorkerOptions:{},AnnotationMode:{ENABLE:1},getDocument:()=>({destroy:()=>{},promise:Promise.resolve({numPages:3,getPage:async number=>({getViewport:({scale})=>({width:612*scale,height:792*scale}),render:({canvasContext:ctx,viewport})=>({cancel(){},promise:Promise.resolve().then(()=>{ctx.fillStyle='#fff';ctx.fillRect(0,0,viewport.width,viewport.height);ctx.fillStyle='#181a18';ctx.font=`${24*viewport.width/612}px sans-serif`;ctx.fillText(`Synthetic PDF page ${number}`,24,80);})}),getTextContent:async()=>({items:[{str:`Synthetic PDF page ${number}`}]}),cleanup(){}})})})};
document.querySelector('#open').onclick=async()=>{controller?.abort();controller=new AbortController();await openPDF(root,new ArrayBuffer(0),{assetBase:new URL('./pdfjs/',location.href).href,sprite:'./v1/icons.svg',signal:controller.signal,loadLibrary:async()=>sdk});status.textContent='Preview open';};
document.querySelector('#close').onclick=()=>{controller?.abort();root.replaceChildren();status.textContent='Preview closed';};
document.querySelector('#narrow').onclick=()=>root.style.width='320px';
document.querySelector('#wide').onclick=()=>root.style.width='1000px';
document.querySelector('#pack').onclick=()=>document.documentElement.dataset.ui=document.documentElement.dataset.ui==='personal'?'postvisual':'personal';
