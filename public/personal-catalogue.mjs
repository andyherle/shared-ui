
import {createCardInteractions} from './v1/card-interactions.mjs';
const root=document.querySelector('#catalogue-cards'),menu=document.querySelector('#catalogue-card-menu'),toggle=document.querySelector('#catalogue-card-toggle'),status=document.querySelector('#catalogue-card-status');let selected;
const cards=createCardInteractions(root,{toggle,menu,onMenu(card){selected=card;}});
menu.addEventListener('click',event=>{const button=event.target.closest('button');if(!button)return;cards.close(true);if(button.dataset.demoAction==='dismiss'){selected.remove();status.textContent='Sample card dismissed.';toggle.focus();document.querySelector('#catalogue-count').textContent=root.children.length;cards.refresh();}else status.textContent=selected.querySelector('h3').textContent+' Synthetic catalogue example. Your reply stays in this browser view.';});
window.addEventListener('pagehide',event=>{if(!event.persisted)cards.dispose();});

for(const button of document.querySelectorAll('[data-theme-toggle]'))button.addEventListener('click',()=>{const theme=document.documentElement.dataset.theme==='dark'?'light':'dark';document.documentElement.dataset.theme=theme;try{localStorage.setItem('shared-personal-theme',theme)}catch{}});
