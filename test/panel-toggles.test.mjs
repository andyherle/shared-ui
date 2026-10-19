import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import fs from 'node:fs';
test('independent native panels preserve content, bound selection and release listeners',()=>{
 class Node {attrs={};listeners={};hidden=false;disabled=false;setAttribute(k,v){this.attrs[k]=v;}addEventListener(k,f){this.listeners[k]=f;}removeEventListener(k){delete this.listeners[k];}focus(){this.focused=true;}}
 const UI={};vm.runInNewContext(fs.readFileSync(new URL('../src/components.js',import.meta.url),'utf8'),{window:{SharedUI:UI},document:{addEventListener(){}},WeakMap,Map,Set});
 const items=['timeline','calls','debug'].map(id=>({id,button:new Node(),panel:Object.assign(new Node(),{id})}));let changes=0;
 const panels=UI.createPanelToggles({items,selected:['timeline'],onChange(){changes++;}});
 items[1].button.listeners.click();assert.equal(panels.selected.join(','),'timeline,calls');assert.equal(items[1].panel.hidden,false);
 items[2].button.listeners.click();assert.equal(panels.selected.join(','),'calls,debug');assert.equal(items[0].panel.hidden,true);
 panels.show('debug');assert.equal(panels.selected.join(','),'calls,debug');assert.equal(items[2].button.attrs['aria-pressed'],'true');
 items[1].button.listeners.click();items[2].button.listeners.click();assert.equal(panels.selected.length,0);
 items[0].button.listeners.keydown({key:'End',preventDefault(){}});assert.equal(items[2].button.focused,true);
 panels.dispose();assert.equal(Object.keys(items[0].button.listeners).length,0);assert(changes>=5);
});
