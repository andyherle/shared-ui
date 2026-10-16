/* Opt-in development tooling. Never bundled into the automatic CSS channel. */
export const AUDIT_SCHEMA_VERSION = 1;
const MAX_ELEMENTS = 10000;
import { AUDIT_CONTRACTS } from './studio/registry.mjs';
export { AUDIT_CONTRACTS };

function text(value, name, limit = 512) {
  if (typeof value !== 'string' || !value.trim() || value.length > limit)
    throw new TypeError(`${name} must be a non-empty string of at most ${limit} characters`);
  return value;
}
function integer(value, name) {
  if (!Number.isSafeInteger(value) || value < 0) throw new TypeError(`${name} must be a non-negative integer`);
  return value;
}
function object(value, name) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new TypeError(`${name} must be an object`);
  return value;
}

function locator(element, scope) {
  if (element === scope) return '$scope';
  const parts = [];
  for (let node = element; node && node !== scope && node.nodeType === 1; node = node.parentElement) {
    let position = 1;
    for (let peer = node.previousElementSibling; peer; peer = peer.previousElementSibling)
      if (peer.localName === node.localName) position++;
    parts.unshift(`${node.localName}:nth-of-type(${position})`);
  }
  return parts.join(' > ');
}

/** Capture structural facts only. No text, values, URLs, HTML, styles or screenshots. */
export function collectSchemaSnapshot(scope, { appId, viewId } = {}) {
  text(appId, 'appId', 120); text(viewId, 'viewId', 120);
  if (!scope || typeof scope.querySelectorAll !== 'function') throw new TypeError('A DOM scope is required');
  const selector = AUDIT_CONTRACTS.map(contract => contract.selector).join(',');
  const candidates = [...(scope.matches?.(selector) ? [scope] : []), ...scope.querySelectorAll(selector)];
  const elements = candidates.slice(0, MAX_ELEMENTS).map(element => {
    const contracts = AUDIT_CONTRACTS.filter(contract => element.matches(contract.selector));
    const attributes = {}, counts = {};
    for (const contract of contracts) {
      for (const attribute of Object.keys(contract.attributes || {})) {
        if (element.hasAttribute(attribute)) attributes[attribute] = element.getAttribute(attribute).slice(0, 128);
      }
      for (const check of contract.checks) counts[check.id] = element.querySelectorAll(check.selector).length;
    }
    return { id: locator(element, scope), tag: element.localName,
      roles: contracts.map(contract => contract.id), attributes, counts };
  });
  return { schemaVersion: AUDIT_SCHEMA_VERSION, appId, viewId, elements,
    coverage: { matched: candidates.length, captured: elements.length, truncated: candidates.length > MAX_ELEMENTS } };
}

function validateSnapshot(snapshot) {
  object(snapshot, 'snapshot');
  if (snapshot.schemaVersion !== AUDIT_SCHEMA_VERSION) throw new TypeError('Unsupported audit snapshot schema');
  text(snapshot.appId, 'appId', 120); text(snapshot.viewId, 'viewId', 120);
  if (!Array.isArray(snapshot.elements) || snapshot.elements.length > MAX_ELEMENTS) throw new TypeError('Invalid element list');
  const seen = new Set();
  for (const element of snapshot.elements) {
    object(element, 'element'); text(element.id, 'element.id', 16384); text(element.tag, 'element.tag', 128);
    if (seen.has(element.id)) throw new TypeError('Duplicate element identifier');
    seen.add(element.id);
    object(element.attributes, 'attributes'); object(element.counts, 'counts');
    if (!Array.isArray(element.roles) || !element.roles.length || new Set(element.roles).size !== element.roles.length)
      throw new TypeError('Invalid component roles');
    for (const role of element.roles) {
      const contract = AUDIT_CONTRACTS.find(item => item.id === role);
      if (!contract) throw new TypeError(`Unsupported component role: ${role}`);
      for (const check of contract.checks) integer(element.counts[check.id], check.id);
      for (const attribute of Object.keys(contract.attributes || {})) {
        if (Object.hasOwn(element.attributes, attribute) &&
          (typeof element.attributes[attribute] !== 'string' || element.attributes[attribute].length > 128))
          throw new TypeError(`Invalid ${attribute}`);
      }
    }
  }
  const coverage = object(snapshot.coverage, 'coverage');
  integer(coverage.matched, 'coverage.matched'); integer(coverage.captured, 'coverage.captured');
  if (coverage.captured !== snapshot.elements.length || coverage.matched < coverage.captured ||
      coverage.truncated !== (coverage.matched > coverage.captured)) throw new TypeError('Inconsistent audit coverage');
}

/** Pure, warning-only assessment. Malformed input is an operation error, not a UI finding. */
export function auditSchemaSnapshot(snapshot) {
  validateSnapshot(snapshot);
  const findings = [];
  const add = (element, component, rule, expected, observed) => {
    const identity = [snapshot.appId, snapshot.viewId, element.id, rule, expected, observed];
    findings.push({ fingerprint: 'ui-schema-v1:' + encodeURIComponent(JSON.stringify(identity)),
      appId: snapshot.appId, viewId: snapshot.viewId, elementId: element.id, component,
      rule, severity: 'warning', evidence: 'dom-structure', expected, observed });
  };
  for (const element of snapshot.elements) for (const role of element.roles) {
    const contract = AUDIT_CONTRACTS.find(item => item.id === role);
    if (contract.tags && !contract.tags.includes(element.tag))
      add(element, role, `${role}-native-tag`, `Native ${contract.tags.join(', ')} element.`, element.tag);
    for (const [attribute, values] of Object.entries(contract.attributes || {})) {
      if (Object.hasOwn(element.attributes, attribute) && !values.includes(element.attributes[attribute]))
        add(element, role, `${role}-variant`, `${attribute} absent or one of: ${values.join(', ')}.`, element.attributes[attribute]);
    }
    for (const check of contract.checks) {
      const count = element.counts[check.id];
      if (count < check.min || check.max !== undefined && count > check.max)
        add(element, role, check.id, check.expected, String(count));
    }
  }
  return { schemaVersion: AUDIT_SCHEMA_VERSION, appId: snapshot.appId, viewId: snapshot.viewId,
    coverage: { matched: snapshot.coverage.matched, captured: snapshot.coverage.captured,
      truncated: snapshot.coverage.truncated, contracts: AUDIT_CONTRACTS.map(item => item.id),
      notChecked: ['unregistered controls', 'computed paint and tokens', 'accessibility tree',
        'layout and interaction', 'iframes and shadow roots outside the supplied scope', 'source provenance'] },
    findings };
}

function validDate(value, name) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new TypeError(`Invalid ${name}`);
  const date = new Date(value + 'T00:00:00.000Z');
  if (!Number.isFinite(date.getTime()) || date.toISOString().slice(0, 10) !== value) throw new TypeError(`Invalid ${name}`);
  return value;
}

/** Exact, expiring exceptions remain in the report; no wildcard suppression. */
export function applyAuditExceptions(report, exceptions = [], { today = new Date().toISOString().slice(0, 10) } = {}) {
  if (report?.schemaVersion !== AUDIT_SCHEMA_VERSION || !Array.isArray(report.findings)) throw new TypeError('Invalid audit report');
  validDate(today, 'today');
  if (!Array.isArray(exceptions) || exceptions.length > MAX_ELEMENTS) throw new TypeError('Invalid exceptions');
  const byFingerprint = new Map();
  for (const exception of exceptions) {
    object(exception, 'exception'); text(exception.fingerprint, 'fingerprint', 65536); text(exception.reason, 'reason', 1000);
    validDate(exception.expires, 'exception expiry');
    if (byFingerprint.has(exception.fingerprint)) throw new TypeError('Duplicate audit exception');
    byFingerprint.set(exception.fingerprint, exception);
  }
  const findings = report.findings.map(finding => {
    const exception = byFingerprint.get(finding.fingerprint);
    return { ...finding, suppressed: Boolean(exception && exception.expires >= today),
      ...(exception ? { exception: { reason: exception.reason, expires: exception.expires,
        expired: exception.expires < today } } : {}) };
  });
  return { ...report, findings, summary: { total: findings.length,
    active: findings.filter(finding => !finding.suppressed).length,
    suppressed: findings.filter(finding => finding.suppressed).length } };
}
