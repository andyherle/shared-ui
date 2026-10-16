/* Shared development contracts; never included in the consumer runtime. */
export const SCHEMA_VERSION = 1;
export const ID_PATTERN = '^(?!(?:constructor|prototype)$)[a-z][a-z0-9-]{0,79}$';
export class StudioError extends Error {
  constructor(code, message, details = {}) { super(message); this.name = 'StudioError'; this.code = code; this.details = details; }
}
export function requireThat(condition, message, code = 'INVALID_INPUT', details) {
  if (!condition) throw new StudioError(code, message, details);
}
export function freeze(value) {
  if (value && typeof value === 'object') { Object.values(value).forEach(freeze); Object.freeze(value); }
  return value;
}
export function object(value, name, keys) {
  requireThat(value !== null && typeof value === 'object' && !Array.isArray(value) &&
    [Object.prototype, null].includes(Object.getPrototypeOf(value)), `${name} must be a plain object`);
  if (keys) for (const key of Object.keys(value)) requireThat(keys.includes(key), `Unknown ${name} property: ${key}`);
  return value;
}
export function identifier(value, name = 'identifier') {
  requireThat(typeof value === 'string' && new RegExp(ID_PATTERN).test(value), `Invalid ${name}`); return value;
}
export function string(value, name, max = 200) {
  requireThat(typeof value === 'string' && value.trim().length > 0 && value.length <= max, `Invalid ${name}`); return value;
}
export function integer(value, name, min = 0, max = Number.MAX_SAFE_INTEGER) {
  requireThat(Number.isSafeInteger(value) && value >= min && value <= max, `Invalid ${name}`); return value;
}
export function json(value, maxBytes = 4 * 1024 * 1024) {
  const walk = (item, depth) => {
    requireThat(depth <= 64, 'JSON nesting is too deep');
    if (item === null || typeof item === 'boolean' || typeof item === 'string') return;
    if (typeof item === 'number') { requireThat(Number.isFinite(item), 'JSON numbers must be finite'); return; }
    if (Array.isArray(item)) { for (const child of item) walk(child, depth + 1); return; }
    object(item, 'JSON');
    for (const [key, child] of Object.entries(item)) {
      requireThat(!['__proto__', 'prototype', 'constructor'].includes(key), 'Unsafe JSON key'); walk(child, depth + 1);
    }
  };
  walk(value, 0);
  const encoded = JSON.stringify(value);
  requireThat(new TextEncoder().encode(encoded).length <= maxBytes, 'JSON size limit exceeded');
  return JSON.parse(encoded);
}
export function canonical(value) {
  if (Array.isArray(value)) return '[' + value.map(canonical).join(',') + ']';
  if (value && typeof value === 'object') return '{' + Object.keys(value).sort().map(key => JSON.stringify(key) + ':' + canonical(value[key])).join(',') + '}';
  return JSON.stringify(value);
}
export function validateValue(value, descriptor, name) {
  const {type, values, min, max} = descriptor;
  if (type === 'string') requireThat(typeof value === 'string' && value.length <= (max ?? 500), `Invalid ${name}`);
  else if (type === 'boolean') requireThat(typeof value === 'boolean', `Invalid ${name}`);
  else if (type === 'number') requireThat(Number.isFinite(value) && (min === undefined || value >= min) && (max === undefined || value <= max), `Invalid ${name}`);
  else if (type === 'enum') requireThat(values.includes(value), `Unsupported ${name}: ${value}`);
  else requireThat(false, `Unknown property type: ${type}`);
}
