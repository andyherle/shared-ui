#!/usr/bin/env node
// No private checkout, socket, executor, Codex session or browser is needed to
// inspect the six-owner SOURCE registration and honest candidate blockers.
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import {REVIEW_REGISTRY,checkMountCompatibility} from './review-registration.mjs';

export function sourceRegistrationReport(){
  return {
    protocol:REVIEW_REGISTRY.protocol,
    consumers:REVIEW_REGISTRY.owners.length,
    maxOwnedFixtureChildren:REVIEW_REGISTRY.maxOwnedFixtureChildren,
    execution:'BLOCKED: no verified OS isolation or browser execution evidence',
    owners:REVIEW_REGISTRY.owners.map(owner=>({
      app:owner.id,repository:owner.repository,priority:owner.priority,
      profiles:owner.profiles.map(profile=>({
        profile:profile.name,pack:profile.pack,port:profile.port,
        manifestMode:profile.manifestMode,reviewRoute:profile.reviewRoute
      })),
      baseline:{...owner.readiness.baseline},
      candidate:{...owner.readiness.candidate,
        admission:checkMountCompatibility(null,owner,owner.readiness.candidate).state,
        admissionReason:checkMountCompatibility(null,owner,owner.readiness.candidate).reason??
          'Source-ready native path only; no real app/browser/OS execution'},
      mount:owner.mount
    }))
  };
}
const direct=process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url);
if(direct){
  if(process.argv.length!==2){
    process.stderr.write('Usage: node scripts/review-owners.mjs (read-only, no process start)\n');
    process.exitCode=2;
  }else process.stdout.write(JSON.stringify(sourceRegistrationReport(),null,2)+'\n');
}
