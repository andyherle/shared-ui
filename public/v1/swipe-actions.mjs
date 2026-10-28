// Optional gesture affordance only: no requests, persistence or application state.
// Apps handle ui:swipe by activating an existing native control. Buttons remain
// the keyboard/screen-reader alternative. Call the returned function on teardown.
export function mountSwipeActions(root) {
  if (!root?.addEventListener) throw new TypeError('A feed root is required');
  const doc = root.ownerDocument;
  const win = doc.defaultView;
  const listeners = [];
  let active = null, suppressClick = null;
  const on = (target, type, fn, options) => {
    target.addEventListener(type, fn, options);
    listeners.push(() => target.removeEventListener(type, fn, options));
  };
  const reset = () => {
    if (!active) return;
    const {row, id} = active;
    active = null;
    row.style.removeProperty('--ui-swipe-offset');
    delete row.dataset.uiSwipeIntent;
    delete row.dataset.uiSwipeReady;
    if (row.hasPointerCapture?.(id)) row.releasePointerCapture(id);
  };
  on(root, 'pointerdown', event => {
    if (active) { reset(); return; }
    if (event.pointerType !== 'touch' || !event.isPrimary) return;
    const row = event.target.closest('[data-ui-swipe]');
    if (!row || !root.contains(row) || row.matches('[aria-busy="true"],[data-ui-swipe-disabled]')) return;
    if (event.clientX < 24 || event.clientX > win.innerWidth - 24) return;
    if (event.target.closest('a,button,input,textarea,select,img,video,canvas,[contenteditable],pre,[data-ui-no-swipe]')) return;
    const summary = event.target.closest('summary');
    if (summary && !summary.hasAttribute('data-ui-swipe-start')) return;
    if (doc.getSelection()?.type === 'Range') return;
    active = {row, id: event.pointerId, x: event.clientX, y: event.clientY, dx: 0, dy: 0, direction: ''};
  });
  on(root, 'pointermove', event => {
    if (!active || event.pointerId !== active.id) return;
    const dx = event.clientX - active.x, dy = event.clientY - active.y;
    if (!active.direction) {
      if (Math.max(Math.abs(dx), Math.abs(dy)) < 12) return;
      if (Math.abs(dx) < Math.abs(dy) * 1.6) { reset(); return; }
      const direction = dx > 0 ? 'right' : 'left';
      if (!active.row.getAttribute('data-ui-swipe-' + direction)) { reset(); return; }
      active.direction = direction;
      active.row.setPointerCapture?.(event.pointerId);
    }
    if ((dx > 0 ? 'right' : 'left') !== active.direction || Math.abs(dy) > 48) { reset(); return; }
    active.dx = dx; active.dy = dy;
    active.row.dataset.uiSwipeIntent = active.direction;
    active.row.style.setProperty('--ui-swipe-offset', Math.max(-100, Math.min(100, dx)) + 'px');
    if (Math.abs(dx) >= 80) active.row.dataset.uiSwipeReady = '';
    else delete active.row.dataset.uiSwipeReady;
  });
  on(root, 'pointerup', event => {
    if (!active || event.pointerId !== active.id) return;
    const {row, direction, x, y} = active;
    const dx = event.clientX - x, dy = event.clientY - y;
    const commit = direction && Math.abs(dx) >= 80 && Math.abs(dy) <= 48 && Math.abs(dx) >= Math.abs(dy) * 1.6 && (dx > 0 ? 'right' : 'left') === direction;
    reset();
    if (commit && row.isConnected && !row.matches('[aria-busy="true"],[data-ui-swipe-disabled]')) {
      suppressClick = {row, until: Date.now() + 500};
      row.dispatchEvent(new win.CustomEvent('ui:swipe', {bubbles: true, detail: {direction}}));
    }
  });
  on(root, 'click', event => {
    if (!suppressClick || Date.now() > suppressClick.until || !suppressClick.row.contains(event.target)) return;
    suppressClick = null; event.preventDefault(); event.stopPropagation();
  }, true);
  on(root, 'pointercancel', reset);
  // Touch starts with implicit capture on the hit element. Its bubbling loss
  // during transfer to the row is not cancellation of the row's gesture.
  on(root, 'lostpointercapture', event => {
    if (active && event.target === active.row && event.pointerId === active.id) reset();
  });
  on(win, 'blur', reset);
  on(doc, 'visibilitychange', () => { if (doc.hidden) reset(); });
  return () => { reset(); listeners.splice(0).forEach(remove => remove()); };
}
