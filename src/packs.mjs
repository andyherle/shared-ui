// Two public pack identities; mirrors inherit values, never markup or behavior.
export const PACKS = ['postvisual', 'personal'];
export function resolvePacks(input) {
  if (!input || Object.keys(input).sort().join(',') !== [...PACKS].sort().join(',')) throw new Error('Expected Postvisual and Personal packs');
  const output = {}, visiting = new Set();
  function resolve(id) {
    if (output[id]) return output[id];
    if (visiting.has(id)) throw new Error('Pack mirror cycle');
    visiting.add(id);
    const pack = input[id];
    let value;
    if (pack.mirror) {
      if (!PACKS.includes(pack.mirror) || Object.keys(pack).some(key => !['mirror', 'overrides'].includes(key))) throw new Error('Invalid pack mirror');
      const inherited = resolve(pack.mirror), overrides = pack.overrides ?? {};
      if (Object.keys(overrides).some(key => !['defaults', 'light', 'dark'].includes(key))) throw new Error('Invalid mirror scope');
      value = Object.fromEntries(['defaults', 'light', 'dark'].map(scope => [scope, {...inherited[scope], ...overrides[scope]}]));
    } else value = structuredClone(pack);
    visiting.delete(id); output[id] = value; return value;
  }
  for (const id of PACKS) resolve(id);
  return output;
}
