// Native-card behavior shared by both packs. Apps retain content, actions and state.
export function createCardInteractions(root, {cards = 'details.ui-card', toggle, menu, onMenu} = {}) {
  const doc = root.ownerDocument, view = doc.defaultView, listeners = [];
  let timer, touch, anchor, suppressClick = false, frame;
  const on = (el, type, fn, options) => { el.addEventListener(type, fn, options); listeners.push(()=>el.removeEventListener(type,fn,options)); };
  const oldPopover=menu?.getAttribute('popover');
  if(menu)menu.setAttribute('popover','manual');
  const rows = () => [...root.querySelectorAll(cards)];
  const cancel = () => {view.clearTimeout(timer);touch=null;};
  const refresh = () => {
    if (!toggle) return;
    const items=rows(), expanded=items.some(c=>c.open);
    toggle.disabled=!items.length;
    toggle.setAttribute('aria-expanded',String(expanded));
    toggle.title=expanded?'Collapse all cards':'Expand all cards';
  };
  const close = (restore=false) => {if(menu?.matches(':popover-open'))menu.hidePopover();if(restore)anchor?.focus({preventScroll:true});};
  const show = (card, x, y) => {
    if(!menu || doc.hidden)return;
    cancel(); close(); anchor=card.querySelector(':scope > summary');
    onMenu?.(card,menu);menu.showPopover();
    const rect=anchor.getBoundingClientRect();
    menu.style.left=Math.max(8,Math.min(x??rect.left,view.innerWidth-menu.offsetWidth-8))+'px';
    menu.style.top=Math.max(8,Math.min(y??rect.bottom,view.innerHeight-menu.offsetHeight-8))+'px';
    menu.querySelector('button:not(:disabled),a[href]')?.focus({preventScroll:true});
  };
  on(root,'click',e=>{
    if(suppressClick){suppressClick=false;e.preventDefault();return;}
    const summary=e.target.closest('summary');
    if(!summary || !summary.parentElement.matches(cards) || e.target.closest('button,a,input,select,textarea'))return;
    const card=summary.parentElement, before=summary.getBoundingClientRect().top;
    // Toggle the same native element synchronously; no scroll-into-view or reconstruction.
    e.preventDefault();card.open=!card.open;refresh();
    view.cancelAnimationFrame(frame);frame=view.requestAnimationFrame(()=>{
      const delta=summary.getBoundingClientRect().top-before;
      if(Math.abs(delta)>.5)view.scrollBy(0,delta);
    });
  });
  on(root,'toggle',refresh,true);
  if(toggle)on(toggle,'click',()=>{const open=!rows().some(c=>c.open);for(const card of rows())card.open=open;refresh();});
  if(menu) {
    // Manual top layer avoids native pointerup dismissal immediately after contextmenu.
    on(doc,'pointerdown',e=>{if(!menu.contains(e.target))close();},true);
    on(doc,'focusin',e=>{if(!suppressClick&&!menu.contains(e.target))close();});
    on(root,'contextmenu',e=>{const card=e.target.closest(cards);if(!card||e.target.closest('input,textarea,[contenteditable],a'))return;e.preventDefault();show(card,e.clientX,e.clientY);});
    on(root,'keydown',e=>{if(e.key==='ContextMenu'||e.key==='F10'&&e.shiftKey){const card=e.target.closest(cards);if(card){e.preventDefault();show(card);}}});
    on(root,'pointerdown',e=>{suppressClick=false;if(e.pointerType!=='touch'||!e.target.closest('summary')||e.target.closest('button,a,input,textarea'))return;const card=e.target.closest(cards);if(!card)return;cancel();touch={x:e.clientX,y:e.clientY};timer=view.setTimeout(()=>{suppressClick=true;show(card,e.clientX,e.clientY);},550);},{passive:true});
    on(root,'pointermove',e=>{if(touch&&Math.hypot(e.clientX-touch.x,e.clientY-touch.y)>10)cancel();},{passive:true});
    for(const type of ['pointerup','pointercancel'])on(root,type,cancel,{passive:true});
    on(menu,'keydown',e=>{
      const items=[...menu.querySelectorAll('button:not(:disabled),a[href]')],i=items.indexOf(doc.activeElement);
      if(e.key==='Escape'){e.preventDefault();close(true);}
      else if(['ArrowDown','ArrowUp','Home','End'].includes(e.key)){e.preventDefault();items[e.key==='Home'?0:e.key==='End'?items.length-1:(i+(e.key==='ArrowDown'?1:-1)+items.length)%items.length]?.focus();}
      else if(e.key==='Tab')close(true);
    });
    on(view,'resize',()=>close());on(view,'scroll',cancel,{passive:true});on(view,'wheel',()=>close(),{passive:true});
    on(doc,'visibilitychange',()=>{if(doc.hidden){cancel();close();}});
  }
  refresh();
  return {refresh,open:show,close,dispose(){cancel();close();view.cancelAnimationFrame(frame);listeners.forEach(off=>off());if(menu){if(oldPopover===null)menu.removeAttribute('popover');else menu.setAttribute('popover',oldPopover);}}};
}
