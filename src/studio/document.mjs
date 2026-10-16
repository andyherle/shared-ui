import {getComponent} from './registry.mjs';
import {resolveScopedTokens, resolveTokenGraph} from './tokens.mjs';
import {SCHEMA_VERSION, ID_PATTERN, identifier, integer, json, object, requireThat, string, validateValue} from './validation.mjs';

export function validateViews(views) {
  requireThat(Array.isArray(views) && views.length <= 1000, 'Invalid view registrations');
  const seen = new Set();
  for (const view of views) {
    object(view, 'view', ['appId', 'viewId', 'adapter', 'bindings']);
    identifier(view.appId, 'appId'); identifier(view.viewId, 'viewId');
    requireThat(['document', 'audit-only'].includes(view.adapter), 'Unsupported view adapter');
    const key = `${view.appId}/${view.viewId}`; requireThat(!seen.has(key), 'Duplicate view registration'); seen.add(key);
    object(view.bindings, 'view bindings');
    for (const [id, type] of Object.entries(view.bindings)) {
      identifier(id, 'binding ID'); requireThat(['action', 'value', 'boolean', 'navigation'].includes(type), 'Unsupported binding type');
    }
  }
  return views;
}
export function validateDocument(input, {views, catalogue, icons}) {
  const document = json(input);
  object(document, 'document', ['schemaVersion', 'kind', 'name', 'target', 'pack', 'mode', 'density', 'root', 'nodes', 'tokens']);
  requireThat(document.schemaVersion === SCHEMA_VERSION, 'Unsupported document schema');
  requireThat(['composition', 'variation', 'tokens'].includes(document.kind), 'Unsupported document kind');
  string(document.name, 'document name');
  object(document.target, 'document target', ['appId', 'viewId']);
  identifier(document.target.appId, 'appId'); identifier(document.target.viewId, 'viewId');
  const view = views.find(item => item.appId === document.target.appId && item.viewId === document.target.viewId);
  requireThat(view, 'View is not registered');
  requireThat(view.adapter === 'document', 'This view is audit-only', 'READ_ONLY_VIEW');
  for (const key of ['pack', 'mode', 'density']) requireThat(document[key] === catalogue.context[key], `Invalid document ${key}`);
  object(document.nodes, 'nodes'); object(document.tokens, 'document tokens');
  const ids = Object.keys(document.nodes); requireThat(ids.length <= 500, 'Document node limit exceeded');
  resolveTokenGraph(catalogue.definitions, document.tokens);
  if (document.kind === 'tokens') requireThat(document.root === null && ids.length === 0, 'Token documents cannot contain layout nodes');
  else { identifier(document.root, 'root'); requireThat(Object.hasOwn(document.nodes, document.root), 'Missing root node'); }
  for (const [id, node] of Object.entries(document.nodes)) {
    identifier(id, 'node key'); object(node, 'node', ['id', 'componentId', 'props', 'tokens', 'bindings', 'slots', 'layout']);
    requireThat(node.id === id, 'Node ID must match its key');
    const component = getComponent(node.componentId);
    requireThat(component?.renderer.status === 'document-only', `Component has no document adapter: ${node.componentId}`);
    object(node.props, 'props'); object(node.tokens, 'node tokens'); object(node.bindings, 'bindings'); object(node.slots, 'slots');
    for (const [prop, value] of Object.entries(node.props)) {
      requireThat(Object.hasOwn(component.props, prop), `Unknown ${component.id} prop: ${prop}`);
      validateValue(value, component.props[prop], `${component.id}.${prop}`);
    }
    if (Object.hasOwn(component.props, 'label')) string(node.props.label, `${id} label`, 500);
    if (['action', 'icon-action', 'link', 'toggle'].includes(component.id)) string(node.props.icon, `${id} icon`, 80);
    if (node.props.icon !== undefined) requireThat(icons.includes(node.props.icon), `Unknown shared icon: ${node.props.icon}`);
    for (const [slot, ref] of Object.entries(node.bindings)) {
      requireThat(Object.hasOwn(component.bindings, slot), `Unsupported ${component.id} binding: ${slot}`, 'INCOMPATIBLE_BINDING');
      identifier(ref, 'binding reference');
      requireThat(Object.hasOwn(view.bindings, ref) && view.bindings[ref] === component.bindings[slot], `Incompatible binding: ${slot} → ${ref}`, 'INCOMPATIBLE_BINDING');
    }
    for (const token of Object.keys(node.tokens)) requireThat(component.tokens.includes(token), `Token is not declared by ${component.id}: ${token}`);
    resolveScopedTokens(catalogue, document.tokens, node.tokens, id);
    if (node.layout !== undefined) {
      object(node.layout, 'layout', ['kind']);
      requireThat(component.layouts?.includes(node.layout.kind), `Unsupported ${component.id} layout`);
    }
    for (const [slot, children] of Object.entries(node.slots)) {
      requireThat(Object.hasOwn(component.slots, slot), `Unsupported ${component.id} slot: ${slot}`);
      const contract = component.slots[slot];
      requireThat(Array.isArray(children) && children.length >= contract.min && children.length <= contract.max, `Invalid ${id}.${slot} child count`);
      for (const childId of children) {
        identifier(childId, 'child ID');
        const child = document.nodes[childId], childComponent = child && getComponent(child.componentId);
        requireThat(childComponent && contract.families.includes(childComponent.family), `Incompatible child in ${id}.${slot}`);
      }
    }
    for (const [slot, contract] of Object.entries(component.slots)) if (contract.min > 0) requireThat(node.slots[slot]?.length >= contract.min, `Missing required ${id}.${slot}`);
  }
  const visited = new Set();
  const visit = (id, depth) => {
    requireThat(depth < 64, 'Node tree is too deep');
    requireThat(!visited.has(id), 'Node cycle or multiple parents'); visited.add(id);
    for (const children of Object.values(document.nodes[id].slots)) for (const child of children) visit(child, depth + 1);
  };
  if (document.root !== null) visit(document.root, 0);
  requireThat(visited.size === ids.length, 'Unreachable nodes are not allowed');
  return document;
}

const idSchema = {type: 'string', pattern: ID_PATTERN};
const stringSchema = {type: 'string', minLength: 1, maxLength: 200};
const recordSchema = {type: 'object'};
const command = (description, properties, required = Object.keys(properties)) => ({description,
  schema: {type: 'object', properties: {type: {type: 'string'}, ...properties}, required: ['type', ...required], additionalProperties: false}});
// One projection supplies CLI/discovery and future editor/MCP adapters. The full
// document validator remains authoritative for registry-dependent constraints.
export const COMMANDS = {
  create: command('Create a working document for a registered document view.', {document: recordSchema}),
  duplicate: command('Duplicate an exact saved version into an independent document.', {sourceDocumentId: idSchema, sourceRevision: {type: 'integer', minimum: 1}, versionId: idSchema, name: stringSchema}),
  rename: command('Rename this working document.', {name: stringSchema}),
  'set-context': command('Choose one of the two packs, theme and density for this draft.', {pack: {enum: ['postvisual', 'personal']}, mode: {enum: ['light', 'dark']}, density: {enum: ['default', 'compact', 'dense', 'comfortable']}}),
  'remove-node': command('Remove a node and its descendants; required slots remain validated.', {nodeId: idSchema}),
  'set-props': command('Update declared props without changing bindings or node identity.', {nodeId: idSchema, props: recordSchema}),
  'set-bindings': command('Explicitly choose typed binding references from the registered view.', {nodeId: idSchema, bindings: recordSchema}),
  'set-token': command('Override one typed token at document scope or on one node.', {nodeId: idSchema, token: {type: 'string'}, value: {oneOf: [{type: 'string'}, {type: 'number'}, {type: 'object', properties: {ref: {type: 'string'}}, required: ['ref'], additionalProperties: false}]}}, ['token', 'value']),
  'reset-token': command('Remove one override and inherit its prior scope.', {nodeId: idSchema, token: {type: 'string'}}, ['token']),
  'insert-node': command('Insert a stable node and optional new descendants into a declared slot atomically.', {node: recordSchema, descendants: recordSchema, parentId: idSchema, slot: idSchema, index: {type: 'integer', minimum: 0}}, ['node', 'parentId', 'slot', 'index']),
  'move-node': command('Move a stable node between slots; index is measured after removal.', {nodeId: idSchema, parentId: idSchema, slot: idSchema, index: {type: 'integer', minimum: 0}}),
  'swap-node': command('Swap a component while preserving its identity, bindings, tokens and children.', {nodeId: idSchema, componentId: idSchema, props: recordSchema}, ['nodeId', 'componentId']),
  'set-layout': command('Choose a responsive layout declared by the component.', {nodeId: idSchema, layout: recordSchema}),
  'save-version': command('Save a named immutable snapshot without publishing.', {versionId: idSchema, name: stringSchema}),
  'rename-version': command('Rename a saved version without changing its snapshot.', {versionId: idSchema, name: stringSchema}),
  'archive-version': command('Hide a saved version from active choices.', {versionId: idSchema}),
  'unarchive-version': command('Return an archived version to active choices.', {versionId: idSchema}),
  'restore-version': command('Explicitly replace this working content with a saved snapshot.', {versionId: idSchema}),
  undo: command('Undo the latest change; undoing an undo redoes it.', {operationId: idSchema})
};
for (const [type, definition] of Object.entries(COMMANDS)) definition.schema.properties.type = {const: type};
// Freeze through the same helper used by the component registry.
import {freeze} from './validation.mjs';
freeze(COMMANDS);
export function validateCommand(input) {
  const value = json(input);
  requireThat(Object.hasOwn(COMMANDS, value?.type), 'Unknown command');
  const spec = COMMANDS[value.type];
  object(value, 'command', Object.keys(spec.schema.properties));
  for (const key of spec.schema.required) requireThat(Object.hasOwn(value, key), `Missing command field: ${key}`);
  for (const [key, field] of Object.entries(value)) {
    const schema = spec.schema.properties[key];
    if (schema.pattern) identifier(field, key);
    else if (schema.type === 'string') string(field, key, schema.maxLength ?? 200);
    else if (schema.type === 'integer') integer(field, key);
    else if (schema.type === 'object') object(field, key);
  }
  return value;
}
function node(document, id) {
  identifier(id, 'node ID'); requireThat(Object.hasOwn(document.nodes, id), `Unknown node: ${id}`); return document.nodes[id];
}
function version(state, id) {
  identifier(id, 'version ID'); requireThat(Object.hasOwn(state.versions, id), `Unknown version: ${id}`); return state.versions[id];
}
export function applyCommand(state, command) {
  const next = json(state), document = next.document;
  switch (command.type) {
    case 'rename': document.name = command.name; break;
    case 'set-context':
      for (const key of ['pack', 'mode', 'density']) document[key] = command[key];
      break;
    case 'remove-node': {
      requireThat(command.nodeId !== document.root, 'Cannot remove the document root');
      const remove = id => { for (const children of Object.values(node(document, id).slots)) for (const child of children) remove(child); delete document.nodes[id]; };
      remove(command.nodeId);
      for (const parent of Object.values(document.nodes)) for (const children of Object.values(parent.slots)) {
        const index = children.indexOf(command.nodeId); if (index !== -1) children.splice(index, 1);
      }
      break;
    }
    case 'set-props': Object.assign(node(document, command.nodeId).props, command.props); break;
    case 'set-bindings': node(document, command.nodeId).bindings = command.bindings; break;
    case 'set-token': case 'reset-token': {
      const overrides = command.nodeId ? node(document, command.nodeId).tokens : document.tokens;
      if (command.type === 'set-token') overrides[command.token] = command.value;
      else { requireThat(Object.hasOwn(overrides, command.token), 'Token has no override at this scope'); delete overrides[command.token]; }
      break;
    }
    case 'insert-node': case 'move-node': {
      if (command.type === 'move-node') {
        node(document, command.nodeId); requireThat(command.nodeId !== document.root, 'Cannot move the document root');
        for (const parent of Object.values(document.nodes)) for (const children of Object.values(parent.slots)) {
          const index = children.indexOf(command.nodeId); if (index !== -1) children.splice(index, 1);
        }
      } else {
        identifier(command.node.id, 'node ID'); requireThat(!Object.hasOwn(document.nodes, command.node.id), 'Node ID already exists');
        document.nodes[command.node.id] = command.node;
        for (const [id, descendant] of Object.entries(command.descendants ?? {})) {
          identifier(id, 'descendant ID'); requireThat(!Object.hasOwn(document.nodes, id), 'Descendant ID already exists');
          document.nodes[id] = descendant;
        }
      }
      const parent = node(document, command.parentId);
      requireThat(Object.hasOwn(getComponent(parent.componentId).slots, command.slot), 'Unknown destination slot');
      const children = parent.slots[command.slot] ??= [];
      integer(command.index, 'insertion index', 0, children.length);
      children.splice(command.index, 0, command.nodeId ?? command.node.id);
      break;
    }
    case 'swap-node': {
      const target = node(document, command.nodeId); target.componentId = command.componentId;
      if (command.props) target.props = command.props;
      break;
    }
    case 'set-layout': node(document, command.nodeId).layout = command.layout; break;
    case 'save-version':
      requireThat(!Object.hasOwn(next.versions, command.versionId), 'Version already exists');
      requireThat(Object.keys(next.versions).length < 100, 'Saved version limit exceeded');
      next.versions[command.versionId] = {name: command.name, archived: false, document: json(document)};
      break;
    case 'rename-version': version(next, command.versionId).name = command.name; break;
    case 'archive-version': version(next, command.versionId).archived = true; break;
    case 'unarchive-version': version(next, command.versionId).archived = false; break;
    case 'restore-version': {
      const saved = version(next, command.versionId); requireThat(!saved.archived, 'Unarchive the version before restoring it');
      next.document = json(saved.document); break;
    }
    default: requireThat(false, 'Command must be handled by the service');
  }
  return next;
}

/** Stable node IDs make moves distinguishable from edits to DOM positions. */
export function compareDocuments(before, after) {
  const changes = [];
  const escape = key => key.replaceAll('~', '~0').replaceAll('/', '~1');
  const walk = (left, right, path) => {
    if (JSON.stringify(left) === JSON.stringify(right)) return;
    if (left && right && typeof left === 'object' && typeof right === 'object' && !Array.isArray(left) && !Array.isArray(right)) {
      for (const key of [...new Set([...Object.keys(left), ...Object.keys(right)])].sort()) walk(left[key], right[key], `${path}/${escape(key)}`);
    } else changes.push({path, kind: left === undefined ? 'added' : right === undefined ? 'removed' : 'changed',
      ...(left === undefined ? {} : {before: left}), ...(right === undefined ? {} : {after: right})});
  };
  walk(before, after, ''); return changes;
}
