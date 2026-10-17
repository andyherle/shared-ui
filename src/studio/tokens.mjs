import fs from 'node:fs';
import {fileURLToPath} from 'node:url';
import {COMPONENTS} from './registry.mjs';
import {freeze, object, requireThat} from './validation.mjs';

const colorNames = 'prose-code-fill prose-code-ink bg surface surface-raised surface-soft text muted subtle line line-strong control accent accent-hover accent-soft primary on-primary good bad warning note note-text scrim shadow-color media playhead-color playhead-outline';
const lengthNames = 'composition-gap composition-aside control-height field-height body-size control-size h1 h2 h3 h4 h5 h6 radius radius-small gap range-thumb control-inset range-width tag-height playhead-width focus-offset popout-width popout-height popout-space grid-min grid-gap aside main switch-width switch-height switch-thumb switch-inset resize-target tag-size tag-radius form-column';
const expressionNames = 'font font-mono control-font control-padding field-padding tag-font tag-padding fill';
const contentNames = 'app-color card-fill card-ink swatch-value';
export const TOKEN_TYPES = freeze(Object.fromEntries([
  ...colorNames.split(' ').map(name => ['--ui-' + name, {type: 'color', editable: true}]),
  ...lengthNames.split(' ').map(name => ['--ui-' + name, {type: 'length', editable: true}]),
  ...expressionNames.split(' ').map(name => ['--ui-' + name, {type: 'expression', editable: false}]),
  ...contentNames.split(' ').map(name => ['--ui-' + name, {type: 'color', editable: false, reason: 'Authored content belongs to the owning application.'}]),
  ['--ui-control-weight', {type: 'number', min: 100, max: 900, editable: true}],
  ['--ui-graphic-scale', {type: 'number', min: 0.01, max: 100, editable: false, reason: 'Viewport scale belongs to the owning application.'}]
]));
const semantic = new Set(('bg surface surface-raised surface-soft text muted subtle line line-strong control accent accent-hover accent-soft primary on-primary good bad warning note note-text scrim shadow-color media body-size font font-mono h1 h2 h3 h4 h5 h6 gap radius radius-small').split(' ').map(name => '--ui-' + name));

// A bounded lexical inventory of our own CSS, including nested rule context.
// It is not a parser or compliance claim for arbitrary application source.
export function inventoryCSS(source, file = 'src/controls.css') {
  const declarations = [], uses = [], contexts = [];
  let start = 0, quote = '', escaped = false, comment = false, parentheses = 0;
  const record = end => {
    const statement = source.slice(start, end).replace(/\/\*[\s\S]*?\*\//g, match => match.replace(/[^\n]/g, ' '));
    const raw = statement.trim();
    const colon = raw.indexOf(':');
    if (colon < 0) return;
    const property = raw.slice(0, colon).trim(), value = raw.slice(colon + 1).trim();
    const offset = start + statement.length - statement.trimStart().length;
    const location = {file, line: source.slice(0, offset).split('\n').length, context: [...contexts]};
    if (/^--ui-[a-z0-9-]+$/.test(property)) declarations.push({id: property, value, ...location});
    const unquoted = value.replace(/"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'/g, '');
    for (const match of unquoted.matchAll(/var\(\s*(--ui-[a-z0-9-]+)/g)) uses.push({id: match[1], property, ...location});
  };
  for (let i = 0; i < source.length; i++) {
    const char = source[i], next = source[i + 1];
    if (comment) { if (char === '*' && next === '/') { comment = false; i++; } continue; }
    if (quote) { if (escaped) escaped = false; else if (char === '\\') escaped = true; else if (char === quote) quote = ''; continue; }
    if (char === '/' && next === '*') { comment = true; i++; continue; }
    if (char === '"' || char === "'") { quote = char; continue; }
    if (char === '(') { parentheses++; continue; }
    if (char === ')') { parentheses--; requireThat(parentheses >= 0, 'Unbalanced CSS parentheses'); continue; }
    if (parentheses) continue;
    if (char === '{') { contexts.push(source.slice(start, i).replace(/\/\*[\s\S]*?\*\//g, '').trim()); start = i + 1; }
    if (char === ';') { record(i); start = i + 1; }
    if (char === '}') { record(i); requireThat(contexts.length > 0, 'Unbalanced CSS braces'); contexts.pop(); start = i + 1; }
  }
  requireThat(!quote && !comment && !parentheses && !contexts.length, 'Incomplete CSS input');
  return {declarations, uses};
}
function rootDeclaration(declaration, context) {
  if (declaration.context[0] !== '@layer ui.tokens') return false;
  const scopes = declaration.context.slice(1).map(scope => scope.replace(/\s/g, ''));
  if (scopes[0] === '@media(pointer:coarse)') {
    if (context.pointer !== 'coarse') return false;
    scopes.shift();
  }
  if (scopes.length !== 1) return false;
  const selector = scopes[0];
  if (['[data-ui]', ':where([data-ui],[data-ui-density])', '[data-ui],[data-ui][data-ui-density],[data-ui]:where([data-ui-density])'].includes(selector)) return true;
  if (selector === `[data-ui=${context.pack}]`) return true;
  return selector === `[data-ui][data-ui-density=${context.density}],[data-ui]:where([data-ui-density=${context.density}])`;
}
function literal(value, type) { return type === 'number' ? Number(value) : value; }
export function validateTokenValue(value, descriptor, id) {
  if (value && typeof value === 'object') {
    object(value, id, ['ref']); requireThat(typeof value.ref === 'string' && value.ref.length <= 160, `Invalid ${id} reference`); return;
  }
  if (descriptor.type === 'color') requireThat(typeof value === 'string' && /^#(?:[a-f\d]{3}|[a-f\d]{4}|[a-f\d]{6}|[a-f\d]{8})$/i.test(value), `${id} needs a hexadecimal color`);
  else if (descriptor.type === 'length') {
    requireThat(typeof value === 'string' && /^(?:0|(?:\d+(?:\.\d+)?|\.\d+)(?:px|rem|em|%|vw|vh|dvh))$/.test(value) && parseFloat(value) <= 10000, `${id} needs a non-negative CSS length with a supported unit`);
  } else if (descriptor.type === 'number') requireThat(typeof value === 'number' && Number.isFinite(value) && value >= (descriptor.min ?? 0) && value <= (descriptor.max ?? 10000), `${id} is outside its numeric range`);
  else requireThat(false, `${id} requires a renderer and cannot be edited as a literal`);
}

/** Resolve typed aliases with origins. Unavailable contextual defaults stay unavailable. */
export function resolveTokenGraph(definitions, overrides = {}, {scope = 'document'} = {}) {
  object(definitions, 'token definitions'); object(overrides, 'token overrides');
  for (const [id, value] of Object.entries(overrides)) {
    requireThat(Object.hasOwn(definitions, id) && definitions[id].editable, `Token is not editable: ${id}`);
    validateTokenValue(value, definitions[id], id);
  }
  const output = Object.create(null), visiting = new Set();
  const resolve = id => {
    requireThat(Object.hasOwn(definitions, id), `Unknown token reference: ${id}`);
    if (Object.hasOwn(output, id)) return output[id];
    requireThat(!visiting.has(id), `Token alias cycle at ${id}`);
    visiting.add(id);
    const definition = definitions[id], overridden = Object.hasOwn(overrides, id);
    const value = overridden ? overrides[id] : definition.value;
    const origin = overridden ? {scope, token: id} : definition.origin;
    let result = {id, type: definition.type, origin, chain: [id], available: value !== undefined};
    if (value !== undefined) {
      validateTokenValue(value, definition, id);
      if (value && typeof value === 'object') {
        const target = resolve(value.ref);
        requireThat(target.type === definition.type, `Token type mismatch: ${id} → ${value.ref}`);
        const authored = overridden || origin?.scope === 'document' || origin?.scope?.startsWith('node:');
        requireThat(target.available || !authored, `Token reference needs a renderer: ${value.ref}`);
        if (target.available) validateTokenValue(target.value, definition, id);
        result = {...result, available: target.available, ...(target.available ? {value: target.value} : {}), chain: [id, ...target.chain], inheritedFrom: target.origin};
      } else result.value = value;
    }
    visiting.delete(id); output[id] = result; return result;
  };
  for (const id of Object.keys(definitions)) resolve(id);
  return output;
}

/** No source migration: project the existing JSON and CSS declarations for tooling. */
export function createTokenCatalogue({tokens, controls, pack = 'postvisual', mode = 'dark', density = 'default', pointer = 'fine'}) {
  requireThat(['postvisual', 'personal'].includes(pack), 'Unknown pack');
  requireThat(['light', 'dark'].includes(mode), 'Unknown mode');
  requireThat(['default', 'compact', 'dense', 'comfortable'].includes(density), 'Unknown density');
  requireThat(['fine', 'coarse'].includes(pointer), 'Unknown pointer');
  const context = {pack, mode, density, pointer};
  const inventory = inventoryCSS(controls), byId = new Map(), definitions = {};
  const entry = id => {
    requireThat(Object.hasOwn(TOKEN_TYPES, id), `Unregistered shared token: ${id}`);
    if (!byId.has(id)) byId.set(id, {id, ...TOKEN_TYPES[id], layer: semantic.has(id) ? 'semantic' : 'component', declarations: [], uses: [], consumers: COMPONENTS.filter(c => c.tokens.includes(id)).map(c => c.id)});
    return byId.get(id);
  };
  for (const [packName, values] of Object.entries(tokens)) for (const [variant, declarations] of Object.entries(values)) {
    for (const [name, value] of Object.entries(declarations)) {
      const item = entry('--ui-' + name);
      const declaration = {value, file: 'src/tokens.json', pointer: `/${packName}/${variant}/${name}`};
      item.declarations.push(declaration);
      if (packName === pack && (variant === 'defaults' || variant === mode)) item.selected = declaration;
    }
  }
  for (const declaration of inventory.declarations) {
    const item = entry(declaration.id); item.declarations.push(declaration);
    if (rootDeclaration(declaration, context)) item.selected = declaration;
  }
  for (const use of inventory.uses) entry(use.id).uses.push(use);
  for (const item of byId.values()) {
    const source = item.selected;
    const definition = {...TOKEN_TYPES[item.id], layer: item.layer, origin: source ? {...source, scope: 'source'} : {scope: 'renderer'}};
    if (source && definition.type !== 'expression') {
      const alias = source.value.match(/^var\(\s*(--ui-[a-z0-9-]+)\s*\)$/);
      if (alias) definition.value = {ref: alias[1]};
      else {
        const primitiveId = 'primitive.' + item.id.slice(5);
        const value = literal(source.value, item.type);
        try {
          validateTokenValue(value, definition, item.id);
          definitions[primitiveId] = {...definition, value, editable: false, layer: 'primitive'};
          definition.value = {ref: primitiveId};
        } catch {
          // The source can use valid CSS expressions beyond the draft literal
          // vocabulary. Retain their origin without claiming a computed value.
        }
      }
    }
    definitions[item.id] = definition;
    delete item.selected;
  }
  const resolved = resolveTokenGraph(definitions);
  for (const item of byId.values()) item.resolution = resolved[item.id].available ? 'source-default' : 'requires-renderer';
  return freeze({schemaVersion: 1, context, tokens: [...byId.values()].sort((a, b) => a.id.localeCompare(b.id)), definitions, resolved,
    coverage: {sources: ['src/tokens.json', 'src/controls.css'], computedStyles: false, note: 'Scoped component declarations, fallbacks and compound CSS remain inspect-only until a renderer supplies their effective values.'}});
}
export function loadTokenCatalogue(context = {}) {
  return createTokenCatalogue({tokens: JSON.parse(fs.readFileSync(fileURLToPath(new URL('../tokens.json', import.meta.url)), 'utf8')),
    controls: fs.readFileSync(fileURLToPath(new URL('../controls.css', import.meta.url)), 'utf8'), ...context});
}
export function resolveScopedTokens(catalogue, documentOverrides = {}, nodeOverrides = {}, nodeId) {
  const document = resolveTokenGraph(catalogue.definitions, documentOverrides);
  // Preserve document aliases so a node override also changes dependent aliases.
  const definitions = Object.fromEntries(Object.entries(catalogue.definitions).map(([id, definition]) => [id,
    Object.hasOwn(documentOverrides, id) ? {...definition, value: documentOverrides[id], origin: document[id].origin} : definition]));
  return resolveTokenGraph(definitions, nodeOverrides, {scope: nodeId ? `node:${nodeId}` : 'node'});
}
