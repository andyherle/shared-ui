import test from 'node:test';
import assert from 'node:assert/strict';
import { AUDIT_CONTRACTS, auditSchemaSnapshot, applyAuditExceptions } from '../src/schema-audit.mjs';
import { runAuditCLI } from '../scripts/audit-ui.mjs';

function snapshot({ appId = 'demo', viewId = 'inspector', bad = false } = {}) {
  return { schemaVersion: 1, appId, viewId,
    elements: [{ id: 'button:nth-of-type(1)', tag: bad ? 'div' : 'button', roles: ['action'],
      attributes: {}, counts: { 'action-label': 1, 'action-icon': 0 } }],
    coverage: { matched: 1, captured: 1, truncated: false } };
}
const report = () => auditSchemaSnapshot(snapshot({ bad: true }));
const exception = (overrides = {}) => ({ fingerprint: report().findings[0].fingerprint,
  reason: 'Legacy control awaiting its reviewed migration.', expires: '2026-10-20', ...overrides });

for (const contract of AUDIT_CONTRACTS) test(`${contract.id} contract and checks are immutable`, () => {
  assert.ok(Object.isFrozen(contract)); assert.ok(Object.isFrozen(contract.checks));
  assert.throws(() => { contract.id = 'changed'; });
});
test('valid adopted action has no findings', () => assert.deepEqual(auditSchemaSnapshot(snapshot()).findings, []));
test('non-native action is a warning with expected and observed facts', () => {
  const finding = report().findings[0];
  assert.equal(finding.rule, 'action-native-tag'); assert.equal(finding.severity, 'warning');
  assert.equal(finding.observed, 'div'); assert.match(finding.expected, /button/);
});
test('label, icon and variant violations are independent', () => {
  const input = snapshot(); input.elements[0].attributes['data-ui-variant'] = 'bespoke';
  input.elements[0].counts = { 'action-label': 0, 'action-icon': 1 };
  assert.deepEqual(auditSchemaSnapshot(input).findings.map(item => item.rule), ['action-variant', 'action-label', 'action-icon']);
});
test('native field and popout structural requirements are assessed', () => {
  const input = snapshot();
  input.elements = [
    { id: 'field', tag: 'label', roles: ['field'], attributes: {}, counts: { 'field-control': 0 } },
    { id: 'panel', tag: 'article', roles: ['popout'], attributes: {},
      counts: { 'popout-header': 1, 'popout-body': 0, 'popout-footer': 2 } }
  ]; input.coverage = { matched: 2, captured: 2, truncated: false };
  assert.deepEqual(auditSchemaSnapshot(input).findings.map(item => item.rule), ['field-control', 'popout-body', 'popout-footer']);
});
test('input is never mutated', () => {
  const input = snapshot({ bad: true }); const before = JSON.stringify(input);
  applyAuditExceptions(auditSchemaSnapshot(input), [exception()], { today: '2026-10-16' });
  assert.equal(JSON.stringify(input), before);
});
test('an explicit empty covered scope is distinct from complete catalogue coverage', () => {
  const input = snapshot(); input.elements = []; input.coverage = { matched: 0, captured: 0, truncated: false };
  const result = auditSchemaSnapshot(input);
  assert.equal(result.findings.length, 0); assert.ok(result.coverage.notChecked.includes('unregistered controls'));
  assert.deepEqual(result.coverage.contracts, ['action', 'field', 'review-workspace', 'popout', 'action-feedback']);
});
test('malformed snapshots are rejected rather than reported clean', () => {
  const invalid = [null, {}, { ...snapshot(), schemaVersion: 2 }];
  for (const edit of [
    input => { delete input.elements[0].counts['action-label']; },
    input => { input.elements[0].counts['action-label'] = -1; },
    input => { input.elements[0].roles = ['unknown']; },
    input => { input.elements[0].roles = ['action', 'action']; },
    input => { input.elements.push(structuredClone(input.elements[0])); },
    input => { input.coverage.matched = 0; },
    input => { input.coverage.truncated = true; },
    input => { input.elements[0].attributes['data-ui-variant'] = {}; }
  ]) { const input = snapshot(); edit(input); invalid.push(input); }
  for (const input of invalid) assert.throws(() => auditSchemaSnapshot(input), TypeError);
});
test('fingerprints separate app, view, element and changed evidence', () => {
  const first = report().findings[0].fingerprint;
  for (const edit of [
    input => { input.appId = 'other'; }, input => { input.viewId = 'other'; },
    input => { input.elements[0].id = 'other'; }, input => { input.elements[0].tag = 'span'; }
  ]) { const input = snapshot({ bad: true }); edit(input); assert.notEqual(auditSchemaSnapshot(input).findings[0].fingerprint, first); }
});
test('exact valid exceptions remain visible with a reason', () => {
  const result = applyAuditExceptions(report(), [exception()], { today: '2026-10-16' });
  assert.deepEqual(result.summary, { total: 1, active: 0, suppressed: 1 });
  assert.equal(result.findings[0].exception.reason, exception().reason);
});
test('expired exceptions become active warnings again', () => {
  const result = applyAuditExceptions(report(), [exception()], { today: '2026-10-21' });
  assert.equal(result.summary.active, 1); assert.equal(result.findings[0].exception.expired, true);
});
test('exceptions do not suppress a different application', () => {
  const result = applyAuditExceptions(auditSchemaSnapshot(snapshot({ appId: 'second', bad: true })), [exception()], { today: '2026-10-16' });
  assert.equal(result.summary.active, 1);
});
test('blank reasons, invalid dates and duplicate exceptions are rejected', () => {
  for (const exceptions of [[exception({ reason: '' })], [exception({ expires: '2026-02-30' })],
    [exception({ expires: 'forever' })], [exception(), exception()]])
    assert.throws(() => applyAuditExceptions(report(), exceptions), TypeError);
});
function cli(args, data = { first: snapshot({ bad: true }) }) {
  const output = [], errors = [];
  const code = runAuditCLI(args, { read: file => structuredClone(data[file]),
    write: value => output.push(JSON.parse(value)), error: value => errors.push(JSON.parse(value)), today: '2026-10-16' });
  return { code, output, errors };
}
test('CLI is advisory by default even with warnings', () => {
  const result = cli(['--snapshot', 'first']); assert.equal(result.code, 0);
  assert.equal(result.output[0].mode, 'advisory'); assert.equal(result.output[0].warnings, 1);
});
test('CI failure requires explicit opt-in', () => assert.equal(cli(['--snapshot', 'first', '--fail-on-warning']).code, 1));
test('CLI preserves independent app/view results', () => {
  const result = cli(['--snapshot', 'first', '--snapshot', 'second'], {
    first: snapshot({ bad: true }), second: snapshot({ appId: 'other', bad: false })
  }); assert.equal(result.code, 0); assert.equal(result.output[0].results.length, 2);
});
test('CLI rejects duplicate app/views instead of double-counting', () =>
  assert.equal(cli(['--snapshot', 'first', '--snapshot', 'first']).code, 2));
test('invalid input exits 2 and never prints a clean report', () => {
  for (const args of [[], ['--snapshot'], ['--snapshot', '--fail-on-warning'], ['--unknown'], ['--snapshot', 'missing']]) {
    const result = cli(args); assert.equal(result.code, 2); assert.equal(result.output.length, 0); assert.equal(result.errors.length, 1);
  }
});
test('truncated coverage is explicit and cannot pass an opted-in gate', () => {
  const input = snapshot(); input.coverage = { matched: 2, captured: 1, truncated: true };
  const result = cli(['--snapshot', 'first', '--fail-on-warning'], { first: input });
  assert.equal(result.code, 1); assert.equal(result.output[0].incomplete, true);
});
test('suppressed warnings can pass the opt-in gate', () => {
  const result = cli(['--snapshot', 'first', '--exceptions', 'exceptions', '--fail-on-warning'], {
    first: snapshot({ bad: true }), exceptions: [exception()]
  }); assert.equal(result.code, 0); assert.equal(result.output[0].results[0].summary.suppressed, 1);
});

test('action states outside their native button are flagged while button-owned feedback passes',()=>{
 const shot={schemaVersion:1,appId:'demo',viewId:'save',elements:[{id:'feedback',tag:'span',roles:['action-feedback'],attributes:{},counts:{'action-feedback-owner':0}}],coverage:{matched:1,captured:1,truncated:false}};
 assert.ok(auditSchemaSnapshot(shot).findings.some(item=>item.rule==='action-feedback-owner'));
 shot.elements[0].counts['action-feedback-owner']=1;assert.deepEqual(auditSchemaSnapshot(shot).findings,[]);
});
