/* Local snapshot reporting; does not launch, stop, modify or publish an application. */
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { auditSchemaSnapshot, applyAuditExceptions } from '../src/schema-audit.mjs';

function readJSON(file) {
  const descriptor = fs.openSync(file, 'r');
  try {
    const stat = fs.fstatSync(descriptor);
    if (!stat.isFile() || stat.size > 8 * 1024 * 1024) throw new Error('Expected a JSON file no larger than 8 MiB');
    const bytes = Buffer.alloc(stat.size + 1);
    let length = 0;
    while (length < bytes.length) {
      const count = fs.readSync(descriptor, bytes, length, bytes.length - length, null);
      if (!count) break;
      length += count;
    }
    if (length > stat.size) throw new Error('Input changed while reading');
    return JSON.parse(bytes.subarray(0, length).toString('utf8'));
  } finally { fs.closeSync(descriptor); }
}

export function runAuditCLI(args, { read = readJSON, write = line => console.log(line),
  error = line => console.error(line), today } = {}) {
  try {
    const files = []; let exceptionsFile, failOnWarning = false;
    for (let index = 0; index < args.length; index++) {
      const argument = args[index];
      if (argument === '--snapshot' || argument === '--exceptions') {
        const file = args[++index];
        if (!file || file.startsWith('--')) throw new Error(`Missing value for ${argument}`);
        if (argument === '--snapshot') files.push(file);
        else { if (exceptionsFile) throw new Error('Only one exceptions file is supported'); exceptionsFile = file; }
      } else if (argument === '--fail-on-warning') failOnWarning = true;
      else throw new Error(`Unknown argument: ${argument}`);
    }
    if (!files.length || files.length > 100) throw new Error('Pass 1-100 --snapshot files');
    const exceptions = exceptionsFile ? read(exceptionsFile) : [];
    const identities = new Set();
    const results = files.map(file => {
      const report = auditSchemaSnapshot(read(file));
      const identity = JSON.stringify([report.appId, report.viewId]);
      if (identities.has(identity)) throw new Error('Duplicate app/view; assign each captured view a distinct viewId');
      identities.add(identity);
      return applyAuditExceptions(report, exceptions, { today });
    });
    const warnings = results.reduce((sum, report) => sum + report.summary.active, 0);
    const incomplete = results.some(report => report.coverage.truncated);
    write(JSON.stringify({ schemaVersion: 1, mode: failOnWarning ? 'explicit-ci-gate' : 'advisory',
      warnings, incomplete, results }, null, 2));
    return failOnWarning && (warnings || incomplete) ? 1 : 0;
  } catch (cause) {
    error(JSON.stringify({ error: cause.message, kind: 'audit-operation-failed' }));
    return 2;
  }
}
if (process.argv[1] === fileURLToPath(import.meta.url)) process.exitCode = runAuditCLI(process.argv.slice(2));
