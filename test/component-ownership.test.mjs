import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
test('each shared control factory has one source owner, avoiding silent replacement',()=>{
 const source=fs.readFileSync(new URL('../src/components.js',import.meta.url),'utf8'),owners=new Set();
 for(const [,name]of source.matchAll(/\bUI\.(create\w+)\s*=/g)){assert.ok(!owners.has(name),'Duplicate factory '+name);owners.add(name);}
});
