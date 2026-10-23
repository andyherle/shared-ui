import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {REGISTRY, listComponents} from './registry.mjs';
import {loadTokenCatalogue, resolveScopedTokens} from './tokens.mjs';
import {COMMANDS, applyCommand, compareDocuments, validateCommand, validateDocument, validateViews} from './document.mjs';
import {openStore} from './store.mjs';
import {tokenImpact} from './impact.mjs';
import {createConfigurations} from './configurations.mjs';
import {createReleaseManager} from './releases.mjs';
import {canonical, freeze, ID_PATTERN, identifier, integer, json, object, requireThat, string} from './validation.mjs';

export const DEMO_VIEWS = freeze([{appId: 'studio-demo', viewId: 'review', adapter: 'document', bindings: {save: 'action', cancel: 'action', title: 'value', enabled: 'boolean', source: 'navigation'}}]);
const id = {type: 'string', pattern: ID_PATTERN};
const method = (description, properties = {}, required = [], permission = 'read') => ({description, permission,
  inputSchema: {type: 'object', properties, required, additionalProperties: false}});
const configRef = {configurationId: id};
const configWrite = {...configRef, expectedRevision: {type: 'integer', minimum: 0}, operationId: id};
const configCommand = (type, properties = {}) => ({type: 'object', properties: {type: {const: type}, ...properties}, required: ['type', ...Object.keys(properties)], additionalProperties: false});
export const METHODS = freeze({
  describe: method('Describe the shared authoring contract.'),
  'configurations.list': method('List Postvisual, its Personal mirror and independent configuration drafts.'),
  'configuration.read': method('Read effective values, mirror inheritance, snapshots and publication receipts.', configRef, ['configurationId']),
  'configuration.compare': method('Compare effective configuration values with source or an exact snapshot.', {...configRef, snapshotId: id}, ['configurationId']),
  'configuration.preview': method('Compile the exact draft and linked packs for a private native preview. Does not publish.', {...configRef, snapshotId: id}, ['configurationId']),
  'configuration.command': method('Edit, duplicate, mirror, snapshot or restore a configuration with revision checks.', {...configWrite, command: {oneOf: [
    configCommand('duplicate', {sourceId: id, sourceRevision: {type: 'integer', minimum: 0}, name: {type: 'string'}, pack: {enum: ['postvisual', 'personal']}}),
    configCommand('set-value', {scope: {enum: ['defaults', 'light', 'dark']}, token: {type: 'string'}, value: {type: 'string'}}),
    configCommand('reset-value', {scope: {enum: ['defaults', 'light', 'dark']}, token: {type: 'string'}}),
    configCommand('rename', {name: {type: 'string'}}), configCommand('mirror', {sourceId: id}), configCommand('detach'), configCommand('reset-source'),
    configCommand('snapshot', {snapshotId: id, name: {type: 'string'}}), configCommand('restore', {snapshotId: id})
  ]}}, ['configurationId', 'expectedRevision', 'operationId', 'command'], 'write'),
  'configuration.validate': method('Run full shared tests and build in isolation; save an exact revision and source validation receipt.', configWrite, ['configurationId', 'expectedRevision', 'operationId'], 'write'),
  'configuration.publish': method('Push the exact validated configuration to origin/main for the existing Pages workflow. Requires local --publish permission. Retry uncertain outcomes with identical arguments.', {...configWrite, validationId: id}, ['configurationId', 'expectedRevision', 'operationId', 'validationId'], 'publish'),
  'components.list': method('Search the complete registered library independently of app usage.', {text: {type: 'string'}, family: {type: 'string'}, pack: {enum: ['postvisual', 'personal']}, status: {type: 'string'}, authorable: {type: 'boolean'}}),
  'tokens.list': method('Inspect source tokens and their declared component consumers.', {pack: {enum: ['postvisual', 'personal']}, mode: {enum: ['light', 'dark']}, density: {enum: ['default', 'compact', 'dense', 'micro', 'comfortable']}, pointer: {enum: ['fine', 'coarse']}}),
  'views.list': method('List explicitly registered views and their adapter permissions.'),
  'documents.list': method('List saved working documents.'),
  'document.read': method('Read working content or one exact saved version.', {documentId: id, versionId: id}, ['documentId']),
  'document.tokens': method('Resolve draft token inheritance for the exact document/version and optional node.', {documentId: id, versionId: id, nodeId: id}, ['documentId']),
  'document.impact': method('Trace potential token dependencies, declared component consumers and scoped draft nodes. Does not claim live application usage or computed pixel changes.', {documentId: id, versionId: id, nodeId: id, token: {type: 'string'}}, ['documentId', 'token']),
  'document.compare': method('Compare a saved version with working content or another saved version.', {documentId: id, beforeVersionId: id, afterVersionId: id, includeDocuments: {type: 'boolean'}}, ['documentId', 'beforeVersionId']),
  'document.prepare': method('Return a local proposal scoped to the selected document.', {documentId: id, beforeVersionId: id}, ['documentId', 'beforeVersionId']),
  'document.command': method('Apply one validated, revision-checked command.', {documentId: id, expectedRevision: {type: 'integer', minimum: 0}, operationId: id, command: {oneOf: Object.values(COMMANDS).map(item => item.schema)}}, ['documentId', 'expectedRevision', 'operationId', 'command'], 'write')
});
export const SERVICE_CONTRACT = freeze({schemaVersion: 1, registry: REGISTRY, commands: COMMANDS,
  methods: METHODS,
  capabilities: {read: true, write: 'explicit local permission', publish: 'explicit local --publish permission', appSourceMutation: false, configurationWorkspace: true,
    nativeDocumentPreview: true, liveApplicationPreview: false, transport: 'adapter-owned'}});
const icons = Object.keys(JSON.parse(fs.readFileSync(fileURLToPath(new URL('../icons.json', import.meta.url)), 'utf8')));

export function createAuthoringService({directory, views, writable = false, publish = false, releases}) {
  requireThat(!publish || writable, 'Publishing requires draft write permission');
  views = freeze(validateViews(json(views)));
  const store = openStore(directory, {writable}), catalogues = new Map();
  const configurations = createConfigurations({store, writable, releases: releases ?? createReleaseManager({publish})});
  let catalogueSource;
  const catalogueFor = (context = {}) => {
    const source = createHash('sha256').update(fs.readFileSync(new URL('../tokens.json', import.meta.url))).update(fs.readFileSync(new URL('../controls.css', import.meta.url))).digest('hex');
    if (source !== catalogueSource) {catalogues.clear(); catalogueSource = source;}
    const key = JSON.stringify([context.pack, context.mode, context.density, context.pointer]);
    if (!catalogues.has(key)) catalogues.set(key, loadTokenCatalogue(context));
    return catalogues.get(key);
  };
  function validate(document) {
    object(document, 'document');
    return validateDocument(document, {views, icons, catalogue: catalogueFor({pack: document.pack, mode: document.mode, density: document.density})});
  }
  function validateState(state) {
    object(state, 'document state', ['document', 'versions']); validate(state.document); object(state.versions, 'versions');
    requireThat(Object.keys(state.versions).length <= 100, 'Saved version limit exceeded');
    for (const [id, saved] of Object.entries(state.versions)) {
      identifier(id, 'version ID'); object(saved, 'saved version', ['name', 'archived', 'document', 'sourceRevision']);
      string(saved.name, 'version name'); requireThat(typeof saved.archived === 'boolean', 'Invalid archived state'); integer(saved.sourceRevision, 'version source revision', 1);
      validate(saved.document);
      requireThat(canonical(saved.document.target) === canonical(state.document.target), 'Saved version belongs to another view');
      requireThat(saved.document.kind === state.document.kind, 'Saved version belongs to another document kind');
    }
  }
  function recordFrom(state, id) {
    identifier(id, 'document ID'); requireThat(Object.hasOwn(state.documents, id), `Unknown document: ${id}`, 'NOT_FOUND');
    const record = state.documents[id];
    object(record, 'document record', ['revision', 'state', 'undo', 'receipts']);
    integer(record.revision, 'revision', 1); validateState(record.state); object(record.receipts, 'operation receipts');
    requireThat(Object.keys(record.receipts).length <= 10000, 'Operation history limit exceeded');
    if (record.undo !== null) {
      object(record.undo, 'undo', ['operationId', 'state']); identifier(record.undo.operationId, 'undo operation'); validateState(record.undo.state);
    }
    return record;
  }
  function summary(id, record) { return {documentId: id, revision: record.revision, target: record.state.document.target, scope: {kind: record.state.document.kind, documentId: id}}; }
  function read({documentId, versionId}) {
    const record = recordFrom(store.read(), documentId);
    if (versionId !== undefined) {
      identifier(versionId, 'version ID'); const saved = record.state.versions[versionId]; requireThat(saved, 'Unknown saved version', 'NOT_FOUND');
      return {...summary(documentId, record), version: {id: versionId, name: saved.name, archived: saved.archived, sourceRevision: saved.sourceRevision}, document: saved.document};
    }
    return {...summary(documentId, record), document: record.state.document,
      versions: Object.entries(record.state.versions).map(([id, saved]) => ({id, name: saved.name, archived: saved.archived, sourceRevision: saved.sourceRevision})),
      undo: record.undo ? {operationId: record.undo.operationId, expectedRevision: record.revision,
        direction: record.receipts[record.undo.operationId]?.result.undo?.direction ?? 'undo'} : null};
  }
  function compare({documentId, beforeVersionId, afterVersionId, includeDocuments = false}) {
    const record = recordFrom(store.read(), documentId);
    const saved = id => { identifier(id, 'version ID'); requireThat(Object.hasOwn(record.state.versions, id), 'Unknown saved version', 'NOT_FOUND'); return record.state.versions[id].document; };
    const before = saved(beforeVersionId), after = afterVersionId === undefined ? record.state.document : saved(afterVersionId);
    return {...summary(documentId, record), beforeVersionId, afterVersionId: afterVersionId ?? null, changes: compareDocuments(before, after),
      ...(includeDocuments ? {beforeDocument: before, afterDocument: after} : {})};
  }
  function command(request) {
    request = json(request); object(request, 'request', ['documentId', 'expectedRevision', 'operationId', 'command']);
    identifier(request.documentId, 'document ID'); identifier(request.operationId, 'operation ID'); integer(request.expectedRevision, 'expected revision');
    request.command = validateCommand(request.command);
    const digest = createHash('sha256').update(canonical(request)).digest('hex');
    return store.transact(state => {
      const exists = Object.hasOwn(state.documents, request.documentId);
      const record = exists ? recordFrom(state, request.documentId) : null;
      const receipt = record?.receipts[request.operationId];
      if (receipt) {
        requireThat(receipt.digest === digest, 'This operation ID was used with a different request', 'OPERATION_REUSED');
        return {result: {...receipt.result, replayed: true}, changed: false};
      }
      const revision = record?.revision ?? 0;
      requireThat(request.expectedRevision === revision, 'Document changed since it was read', 'REVISION_CONFLICT', {expectedRevision: request.expectedRevision, actualRevision: revision});
      const {command: operation} = request;
      let next;
      if (operation.type === 'create' || operation.type === 'duplicate') {
        requireThat(!record, 'Document already exists'); requireThat(Object.keys(state.documents).length < 1000, 'Store document limit exceeded');
        let document;
        if (operation.type === 'duplicate') {
          const source = recordFrom(state, operation.sourceDocumentId);
          requireThat(operation.sourceRevision === source.revision, 'Source document changed since it was read', 'REVISION_CONFLICT', {expectedRevision: operation.sourceRevision, actualRevision: source.revision});
          const saved = source.state.versions[operation.versionId]; requireThat(saved && !saved.archived, 'Saved version is missing or archived');
          document = json(saved.document); document.name = operation.name;
        } else document = operation.document;
        next = {document, versions: {}};
      } else {
        requireThat(record, 'Document does not exist', 'NOT_FOUND');
        if (operation.type === 'undo') {
          requireThat(record.undo?.operationId === operation.operationId, 'Undo must target the latest change', 'UNDO_CONFLICT');
          next = json(record.undo.state);
        } else {
          next = applyCommand(record.state, operation);
          if (operation.type === 'save-version') next.versions[operation.versionId].sourceRevision = revision;
        }
      }
      validateState(next);
      if (record) requireThat(canonical(next.document.target) === canonical(record.state.document.target) && next.document.kind === record.state.document.kind, 'An edit cannot retarget a document or change its kind');
      requireThat(revision < Number.MAX_SAFE_INTEGER, 'Revision limit exceeded');
      const updated = {revision: revision + 1, state: next, receipts: record?.receipts ?? {},
        undo: record ? {operationId: request.operationId, state: record.state} : null};
      const affectedNode = operation.nodeId ?? operation.node?.id;
      const affectedVersion = operation.type.endsWith('-version') ? operation.versionId : null;
      const result = {...summary(request.documentId, updated), operationId: request.operationId, replayed: false,
        affectedScope: {level: affectedNode ? 'node' : affectedVersion ? 'version' : 'document',
          ...(affectedNode ? {nodeId: affectedNode} : {}), ...(operation.parentId ? {parentId: operation.parentId} : {}),
          ...(operation.token ? {token: operation.token} : {}), ...(affectedVersion ? {versionId: affectedVersion} : {})},
        undo: updated.undo ? {operationId: request.operationId, expectedRevision: updated.revision,
          direction: operation.type === 'undo' && (record.receipts[record.undo.operationId]?.result.undo?.direction ?? 'undo') === 'undo' ? 'redo' : 'undo'} : null};
      requireThat(Object.keys(updated.receipts).length < 10000, 'Operation history limit exceeded');
      updated.receipts[request.operationId] = {digest, result}; state.documents[request.documentId] = updated;
      return {result, changed: true};
    });
  }
  return Object.freeze({
    dispatch(input) {
      const request = json(input); object(request, 'service request', ['method', 'args']);
      requireThat(Object.hasOwn(METHODS, request.method), 'Unknown service method');
      const schema = METHODS[request.method].inputSchema;
      const args = request.args ?? {}; object(args, 'method arguments', Object.keys(schema.properties));
      for (const key of schema.required) requireThat(Object.hasOwn(args, key), `Missing method argument: ${key}`);
      for (const [key, value] of Object.entries(args)) {
        const descriptor = schema.properties[key];
        if (descriptor.pattern) identifier(value, key);
        else if (descriptor.enum) requireThat(descriptor.enum.includes(value), `Invalid ${key}`);
        else if (descriptor.type === 'string') requireThat(typeof value === 'string' && value.length <= 500, `Invalid ${key}`);
        else if (descriptor.type === 'boolean') requireThat(typeof value === 'boolean', `Invalid ${key}`);
        else if (descriptor.type === 'integer') integer(value, key, descriptor.minimum);
      }
      if (request.method.startsWith('configuration.') || request.method === 'configurations.list') return configurations.dispatch(request.method, args);
      let result;
      switch (request.method) {
        case 'describe': result = {...SERVICE_CONTRACT, icons, permissions: {write: writable, publish: writable && configurations.canPublish}}; break;
        case 'components.list': result = {schemaVersion: 1, components: listComponents(args)}; break;
        case 'tokens.list': result = catalogueFor(args); break;
        case 'views.list': result = {views}; break;
        case 'documents.list': {
          const state = store.read(); result = {documents: Object.keys(state.documents).map(id => {
            const record = recordFrom(state, id); return {...summary(id, record), name: record.state.document.name};
          })}; break;
        }
        case 'document.read': result = read(args); break;
        case 'document.tokens': {
          const content = read(args), document = content.document, node = args.nodeId ? document.nodes[args.nodeId] : null;
          requireThat(!args.nodeId || node, 'Unknown node', 'NOT_FOUND');
          const catalogue = catalogueFor({pack: document.pack, mode: document.mode, density: document.density});
          result = {documentId: content.documentId, revision: content.revision, target: document.target,
            scope: {...content.scope, ...(args.nodeId ? {nodeId: args.nodeId} : {})}, version: content.version ?? null,
            context: catalogue.context, resolved: resolveScopedTokens(catalogue, document.tokens, node?.tokens ?? {}, args.nodeId),
            coverage: catalogue.coverage}; break;
        }
        case 'document.compare': result = compare(args); break;
        case 'document.impact': {
          const content = read(args), document = content.document;
          result = {documentId: content.documentId, revision: content.revision, target: document.target, version: content.version ?? null,
            ...tokenImpact(document, catalogueFor({pack: document.pack, mode: document.mode, density: document.density}), args.token, args.nodeId)}; break;
        }
        case 'document.prepare': {
          const comparison = compare(args);
          result = {...comparison, status: 'local-proposal', publishes: false, repositories: [],
            coverage: {scope: 'selected document only', liveConsumers: false, sourceMigration: false},
            affectedNodes: [...new Set(comparison.changes.filter(change => change.path.startsWith('/nodes/')).map(change => change.path.split('/')[2]))],
            changedTokens: [...new Set(comparison.changes.filter(change => change.path.startsWith('/tokens/')).map(change => change.path.split('/')[2]))]}; break;
        }
        case 'document.command': result = command(args); break;
      }
      return json(result, 32 * 1024 * 1024);
    }
  });
}
