// Single public registration catalogue for all six real app owners.
// This describes source interfaces, NOT a running app or OS sandbox approval.
import fs from 'node:fs';

const source=new URL('../fixtures/review-owners.v1.json',import.meta.url);
const ids=['staticref','aura','home','ledger','delivery','portal'];
const states=new Set(['prepared','blocked']);
const packs=new Set(['postvisual','personal']);
const modes=new Set(['checkout','runtime-loopback']);
const mounts=new Set(['native-detached','deferred','ssr-deferred']);
const SHA40=/^[a-f0-9]{40}$/;
const exactKeys=(o,allowed,label)=>{
  if(!o||typeof o!=='object'||Array.isArray(o)||Object.keys(o).some(k=>!allowed.includes(k)))
    throw new Error('Unknown '+label+' registration field');
};
export function reviewOriginRoute(route){
  if(typeof route!=='string'||!route.startsWith('/')||route.startsWith('//')||
    route.includes('\\')||/[\u0000-\u001f\u007f]/.test(route)||route.length>512)
    throw new Error('Unsafe fixture review route');
  let u,decoded;
  try{
    u=new URL(route,'http://127.0.0.1:8769');
    decoded=decodeURIComponent(u.pathname);
  }catch{throw new Error('Malformed fixture review route');}
  if(u.origin!=='http://127.0.0.1:8769'||decoded.split('/').includes('..')||
    decoded.includes('\\')||/[\u0000-\u001f\u007f]/.test(decoded))
    throw new Error('Review route cannot escape its loopback origin');
  return route;
}
function checkRecord(doc){
  exactKeys(doc,['schemaVersion','protocol','maxOwnedFixtureChildren','owners'],'root');
  if(doc.schemaVersion!==1||doc.protocol!=='shared-ui-review-registration-v1'||
    doc.maxOwnedFixtureChildren!==2||!Array.isArray(doc.owners)||doc.owners.length!==6)
    throw new Error('Registry must support exactly six consumers with two owned runtime slots');
  const names=new Set(),ports=new Set();
  for(const o of doc.owners){
    exactKeys(o,['id','repository','priority','profiles','mount','readiness'],'owner');
    if(!ids.includes(o.id)||names.has(o.id)||typeof o.repository!=='string'||
      !/^[a-zA-Z0-9._-]+\/[a-zA-Z0-9._-]+$/.test(o.repository)||!mounts.has(o.mount))
      throw new Error('Invalid unique consumer registration');
    names.add(o.id);
    if(!Array.isArray(o.profiles)||o.profiles.length<1||o.profiles.length>3)
      throw new Error('Every consumer needs one to three app-owned profiles');
    const local=new Set();
    for(const p of o.profiles){
      exactKeys(p,['name','port','pack','manifestMode','manifestPath','reviewRoute','seed'],'profile');
      if(typeof p.name!=='string'||!/^[a-z][a-z0-9-]{1,31}$/.test(p.name)||
        local.has(p.name)||!Number.isInteger(p.port)||p.port<1024||p.port>65535||
        ports.has(p.port)||!packs.has(p.pack)||!modes.has(p.manifestMode)||
        typeof p.manifestPath!=='string'||!p.manifestPath.trim()||
        !/^[A-Za-z0-9][A-Za-z0-9._/-]{1,180}$/.test(p.manifestPath)||
        p.manifestPath.split('/').includes('..')||
        (p.manifestMode==='checkout'&&p.manifestPath.startsWith('/'))||
        (p.manifestMode==='runtime-loopback'&&!p.manifestPath.startsWith('/'))||
        typeof p.seed!=='string'||!/^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/.test(p.seed))
        throw new Error('Unsafe or overlapping app-owned fixture profile');
      reviewOriginRoute(p.reviewRoute);local.add(p.name);ports.add(p.port);
    }
    exactKeys(o.readiness,['baseline','candidate'],'readiness');
    for(const axis of ['baseline','candidate']){
      const r=o.readiness[axis];
      exactKeys(r,['state','reason'],'readiness state');
      if(!states.has(r.state)||typeof r.reason!=='string'||r.reason.length<12||
        r.reason.length>300)
        throw new Error('Unexplained source readiness classification');
    }
  }
  if(names.size!==ids.length)throw new Error('Incomplete six-consumer registry');
  return doc;
}
const immutable=(item)=>{
  if(item&&typeof item==='object'){
    for(const val of Object.values(item))immutable(val);
    Object.freeze(item);
  }
  return item;
};
export const REVIEW_REGISTRY=immutable(checkRecord(JSON.parse(fs.readFileSync(source,'utf8'))));
export const REVIEW_IDS=Object.freeze([...ids]);
export function registrationFor(id){
  return REVIEW_REGISTRY.owners.find(o=>o.id===id)||null;
}
export function profileFor(registration,profileName){
  const chosen=profileName??registration?.profiles[0]?.name;
  return registration?.profiles.find(p=>p.name===chosen)||null;
}
export function readinessFor(app,registration,variant){
  const axis=variant==='baseline'?'baseline':'candidate';
  const original=registration.readiness[axis];
  const proposed=app?.readiness?.[axis];
  if(proposed===undefined)return original;
  exactKeys(proposed,['state','reason','sourceSha'],'app source readiness');
  if(!states.has(proposed.state)||typeof proposed.reason!=='string'||
    proposed.reason.length<12||proposed.reason.length>300||
    proposed.sourceSha!==app.sha||!SHA40.test(proposed.sourceSha))
    throw new Error('Source readiness changes require the exact app SHA and explanation');
  return proposed;
}
// SSR/native compatibility is owned by the application's original rendering
// path. No shared composition factory is copied and connected forms cannot move.
export function checkMountCompatibility(app,registration,readiness){
  if(readiness.state==='blocked')return {state:'blocked',reason:readiness.reason};
  if(registration.mount==='native-detached')return {state:'prepared',mode:'native-detached'};
  const evidence=app?.mountEvidence;
  if(!evidence)return {state:'blocked',
    reason:'Real native SSR/pre-mount candidate adapter and source regression not attested'};
  exactKeys(evidence,['strategy','sourceSha','testFile','instanceIds','nativeFormOwner','outerDialogHost','connectedNodesMoved'],'mount evidence');
  if(!['detached-before-first-mount','ssr-pre-hydration-tested'].includes(evidence.strategy)||
    evidence.sourceSha!==app.sha||!SHA40.test(evidence.sourceSha)||
    typeof evidence.testFile!=='string'||!/^([A-Za-z0-9_-]+\/)*[A-Za-z0-9_.-]+$/.test(evidence.testFile)||
    evidence.testFile.split('/').includes('..')||
    !Array.isArray(evidence.instanceIds)||!evidence.instanceIds.length||
    evidence.instanceIds.length>20||
    !evidence.instanceIds.every(x=>typeof x==='string'&&/^[a-z][a-z0-9.-]{1,79}$/.test(x))||
    evidence.nativeFormOwner!==true||evidence.outerDialogHost!==true||
    evidence.connectedNodesMoved!==false)
    throw new Error('SSR/pre-mount adapter cannot move connected forms or invent test provenance');
  return {state:'prepared',mode:evidence.strategy,instanceIds:[...evidence.instanceIds]};
}
