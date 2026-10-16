import {createRenderer} from './renderer.mjs';
SharedUI.instance?.dispose();
const renderer = createRenderer(document.querySelector('main'), {onSelect: nodeId => parent.postMessage({type: 'studio-select', nodeId}, location.origin)});
function receive(event) {
  if (event.origin !== location.origin || event.source !== parent) return;
  if (event.data?.type === 'studio-render') renderer.render(event.data.document, event.data.options);
  if (event.data?.type === 'studio-selection') renderer.select(event.data.nodeId);
  if (event.data?.type === 'studio-scroll-to' && Number.isFinite(event.data.x) && Number.isFinite(event.data.y)) {
    if (window.scrollX !== event.data.x || window.scrollY !== event.data.y) {
      const x = window.scrollX, y = window.scrollY; syncing = true; window.scrollTo(event.data.x, event.data.y);
      if (x === window.scrollX && y === window.scrollY) syncing = false;
    }
  }
}
let syncing = false;
function scroll() {if (syncing) {syncing = false; return;} parent.postMessage({type: 'studio-scroll', x: window.scrollX, y: window.scrollY}, location.origin);}
window.addEventListener('scroll', scroll, {passive: true});
window.addEventListener('message', receive);
window.addEventListener('pagehide', () => {window.removeEventListener('message', receive); window.removeEventListener('scroll', scroll); renderer.dispose();}, {once: true});
parent.postMessage({type: 'studio-ready'}, location.origin);
