import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const module={exports:{}};
vm.runInNewContext(fs.readFileSync(new URL('../src/runtime.js',import.meta.url),'utf8'),{module,URL,queueMicrotask});
function fixture(){
 const view=new EventTarget(),form=new EventTarget(),button={disabled:false},field={value:'',validity:{valid:false},disabled:false};
 form.ownerDocument={defaultView:view};form.elements=[field,button];form.querySelectorAll=()=>[button];form.getAttribute=()=>null;
 let allowed=true;const guard=module.exports.createSubmitGuard(form,{canSubmit:()=>allowed&&field.value.trim()!==''});
 return {form,view,button,field,guard,setAllowed:value=>{allowed=value;guard.refresh();}};
}
test('empty answers cannot submit; selection and clearing preserve a stable native button',()=>{
 const f=fixture();assert.equal(f.button.disabled,true);
 const premature=new Event('submit',{cancelable:true});f.form.dispatchEvent(premature);assert.equal(premature.defaultPrevented,true);
 f.field.value='A';f.field.validity.valid=true;f.form.dispatchEvent(new Event('change'));assert.equal(f.button.disabled,false);
 const ready=new Event('submit',{cancelable:true});f.form.dispatchEvent(ready);assert.equal(ready.defaultPrevented,false);
 f.field.value='';f.form.dispatchEvent(new Event('input'));assert.equal(f.button.disabled,true);
 f.guard.dispose();
});
test('app pending state, native validity, restored drafts and disposal keep their ownership',async()=>{
 const f=fixture();f.field.value='Restored answer';f.guard.refresh();assert.equal(f.button.disabled,true);
 f.field.validity.valid=true;f.guard.refresh();assert.equal(f.button.disabled,false);
 f.setAllowed(false);assert.equal(f.button.disabled,true);f.setAllowed(true);assert.equal(f.button.disabled,false);
 f.form.dispatchEvent(new Event('reset'));f.field.value='';await Promise.resolve();assert.equal(f.button.disabled,true);
 f.guard.dispose();assert.equal(f.button.disabled,false);f.form.dispatchEvent(new Event('change'));assert.equal(f.button.disabled,false);
});
