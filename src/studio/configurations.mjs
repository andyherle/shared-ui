import {createReleaseManager, hash} from './releases.mjs';
import {PACKS, resolvePacks} from '../packs.mjs';
import {TOKEN_TYPES, validateTokenValue} from './tokens.mjs';
import {compareDocuments} from './document.mjs';
import {canonical, identifier, integer, json, object, requireThat, string} from './validation.mjs';

const scopes = ['defaults', 'light', 'dark'];
const empty = () => ({defaults: {}, light: {}, dark: {}});
export function createConfigurations({store, writable, releases = createReleaseManager()}) {
  function sourceRecord(id, source) {
    requireThat(PACKS.includes(id), 'Unknown configuration', 'NOT_FOUND');
    const definition = source.tokens[id];
    return {name: id === 'personal' ? 'Personal' : 'Postvisual', pack: id, revision: 0,
      definition: json(definition), baseHash: hash(source.tokens[id]), snapshots: {}, receipts: {}, validations: {}, publications: []};
  }
  function get(state, id, source) {
    identifier(id, 'configuration ID');
    const record = state.configurations?.[id] ?? sourceRecord(id, source);
    object(record, 'configuration', ['name', 'pack', 'revision', 'definition', 'baseHash', 'snapshots', 'receipts', 'validations', 'publications']);
    requireThat(PACKS.includes(record.pack), 'Invalid release target'); integer(record.revision, 'revision'); string(record.name, 'name');
    return record;
  }
  function resolve(state, id, source, visiting = new Set()) {
    requireThat(!visiting.has(id), 'Configuration mirror cycle'); visiting.add(id);
    const record = get(state, id, source), definition = record.definition;
    if (!definition.mirror) {visiting.delete(id); return json(definition);}
    const inherited = resolve(state, definition.mirror, source, visiting);
    visiting.delete(id);
    return Object.fromEntries(scopes.map(scope => [scope, {...inherited[scope], ...definition.overrides[scope]}]));
  }
  function validateValues(values, template) {
    object(values, 'configuration values', scopes);
    for (const scope of scopes) {
      object(values[scope], scope);
      requireThat(Object.keys(values[scope]).sort().join(',') === Object.keys(template[scope]).sort().join(','), 'Configuration must retain the shared token contract');
      for (const [token, value] of Object.entries(values[scope])) {
        requireThat(typeof value === 'string', 'Configuration values must be literal shared tokens');
        validateTokenValue(value, TOKEN_TYPES['--ui-' + token], token);
      }
    }
  }
  function candidate(state, id, source) {
    const record = get(state, id, source), values = resolve(state, id, source);
    validateValues(values, resolvePacks(source.tokens)[record.pack]);
    // A private mirror can refer to a draft, but a public mirror always refers to a pack.
    let definition = values, related = {};
    if (record.definition.mirror) {
      const parent = get(state, record.definition.mirror, source);
      requireThat(parent.pack !== record.pack, 'A public mirror must follow the other pack');
      related = {[parent.pack]: resolve(state, record.definition.mirror, source)};
      definition = {mirror: parent.pack, overrides: json(record.definition.overrides)};
    }
    const compiled = releases.compile(record.pack, definition, related);
    const before = resolvePacks(source.tokens), after = resolvePacks(compiled.tokens);
    return {record, values, definition, related, compiled, affectedPacks: PACKS.filter(pack => canonical(before[pack]) !== canonical(after[pack]))};
  }
  function read(state, id, source) {
    const record = get(state, id, source), values = resolve(state, id, source);
    const dependencies = [];
    let current = record;
    while (current.definition.mirror) {const next = current.definition.mirror; requireThat(!dependencies.includes(next), 'Mirror cycle'); dependencies.push(next); current = get(state, next, source);}
    return {configurationId: id, ...json(record), values, dependencies, effectiveHash: hash(values), sourceHash: source.fingerprint,
      activityHash: hash({validations: record.validations, publications: record.publications, receipts: Object.entries(record.receipts).map(([id, receipt]) => [id, receipt.result.status ?? null])}),
      sourceValues: resolvePacks(source.tokens)[record.pack], sourceChanged: record.baseHash !== hash(source.tokens[record.pack]),
      dirty: canonical(record.definition) !== canonical(source.tokens[record.pack]) || canonical(values) !== canonical(resolvePacks(source.tokens)[record.pack])};
  }
  function command(args) {
    const {configurationId: id, expectedRevision, operationId, command: operation} = args;
    identifier(id); identifier(operationId); integer(expectedRevision, 'expected revision');
    object(operation, 'configuration command');
    const fields = {duplicate: ['sourceId', 'sourceRevision', 'name', 'pack'], 'set-value': ['scope', 'token', 'value'], 'reset-value': ['scope', 'token'],
      rename: ['name'], snapshot: ['snapshotId', 'name'], restore: ['snapshotId'], mirror: ['sourceId'], detach: [], 'reset-source': []};
    requireThat(Object.hasOwn(fields, operation.type), 'Unknown configuration command'); object(operation, 'configuration command', ['type', ...fields[operation.type]]);
    const digest = hash(args);
    return store.transact(state => {
      state.configurations ??= {};
      const source = releases.source(), exists = Object.hasOwn(state.configurations, id) || PACKS.includes(id);
      const old = exists ? get(state, id, source) : null;
      if (old?.receipts[operationId]) {const receipt = old.receipts[operationId]; requireThat(receipt.digest === digest, 'Operation ID reused', 'OPERATION_REUSED'); return {changed: false, result: {...receipt.result, replayed: true}};}
      requireThat((old?.revision ?? 0) === expectedRevision, 'Configuration changed since it was read', 'REVISION_CONFLICT', {actualRevision: old?.revision ?? 0});
      let record = old ? json(old) : null;
      if (operation.type === 'duplicate') {
        requireThat(!exists && Object.keys(state.configurations).length < 100, 'Choose a new configuration ID');
        const original = get(state, operation.sourceId, source);
        requireThat(operation.sourceRevision === original.revision, 'Source configuration changed', 'REVISION_CONFLICT');
        string(operation.name, 'name'); requireThat(PACKS.includes(operation.pack), 'Choose a release target');
        record = {...sourceRecord(operation.pack, source), name: operation.name, definition: resolve(state, operation.sourceId, source)};
      } else {
        requireThat(record, 'Unknown configuration', 'NOT_FOUND');
        switch (operation.type) {
          case 'set-value': case 'reset-value': {
            requireThat(scopes.includes(operation.scope), 'Unknown value scope');
            const values = resolve(state, id, source); requireThat(Object.hasOwn(values[operation.scope], operation.token), 'Unknown configuration token');
            if (operation.type === 'set-value') {
              requireThat(typeof operation.value === 'string', 'Use a literal token value'); validateTokenValue(operation.value, TOKEN_TYPES['--ui-' + operation.token], operation.token);
              (record.definition.mirror ? record.definition.overrides : record.definition)[operation.scope][operation.token] = operation.value;
            } else if (record.definition.mirror) delete record.definition.overrides[operation.scope][operation.token];
            else record.definition[operation.scope][operation.token] = resolvePacks(source.tokens)[record.pack][operation.scope][operation.token];
            break;
          }
          case 'rename': string(operation.name, 'name'); record.name = operation.name; break;
          case 'mirror': identifier(operation.sourceId); requireThat(get(state, operation.sourceId, source).pack !== record.pack, 'A mirror must follow a configuration of the other pack'); record.definition = {mirror: operation.sourceId, overrides: empty()}; break;
          case 'detach': record.definition = resolve(state, id, source); break;
          case 'reset-source': record.definition = json(source.tokens[record.pack]); record.baseHash = hash(source.tokens[record.pack]); break;
          case 'snapshot':
            identifier(operation.snapshotId); string(operation.name, 'snapshot name');
            requireThat(!record.snapshots[operation.snapshotId] && Object.keys(record.snapshots).length < 100, 'Snapshot exists or limit reached');
            record.snapshots[operation.snapshotId] = {name: operation.name, definition: json(record.definition), values: resolve(state, id, source), revision: record.revision}; break;
          case 'restore':
            requireThat(record.snapshots[operation.snapshotId], 'Unknown snapshot', 'NOT_FOUND');
            // Restoring freezes exact saved values; re-link explicitly to follow a live parent again.
            record.definition = json(record.snapshots[operation.snapshotId].values); break;
        }
      }
      record.revision++; state.configurations[id] = record;
      const values = resolve(state, id, source); validateValues(values, resolvePacks(source.tokens)[record.pack]);
      requireThat(Object.keys(record.receipts).length < 10000, 'Operation receipt limit reached');
      const result = {configurationId: id, revision: record.revision, operationId, replayed: false};
      record.receipts[operationId] = {digest, result}; return {changed: true, result};
    });
  }
  async function validate(args) {
    const {configurationId: id, expectedRevision, operationId} = args, source = releases.source(), state = store.read();
    const plan = candidate(state, id, source), digest = hash(args);
    const prior = plan.record.validations[operationId];
    if (prior) {requireThat(prior.digest === digest, 'Operation ID reused', 'OPERATION_REUSED'); return {...prior.result, replayed: true};}
    requireThat(plan.record.revision === expectedRevision, 'Configuration changed', 'REVISION_CONFLICT');
    requireThat(plan.record.baseHash === hash(source.tokens[plan.record.pack]), 'Source configuration changed; reset to source or duplicate a fresh configuration', 'SOURCE_CONFLICT');
    const checked = await releases.validate(plan.record.pack, plan.definition, plan.related);
    return store.transact(state => {
      state.configurations ??= {}; const current = get(state, id, releases.source());
      if (current.validations[operationId]) {const prior = current.validations[operationId]; requireThat(prior.digest === digest, 'Operation ID reused', 'OPERATION_REUSED'); return {changed: false, result: {...prior.result, replayed: true}};}
      requireThat(current.revision === expectedRevision && hash(resolve(state, id, releases.source())) === hash(plan.values), 'Configuration or mirror source changed during validation', 'REVISION_CONFLICT');
      const result = {configurationId: id, revision: expectedRevision, validationId: operationId, effectiveHash: hash(plan.values), affectedPacks: plan.affectedPacks, ...checked};
      requireThat(Object.keys(current.validations).length < 100, 'Validation receipt limit reached; duplicate this configuration');
      current.validations[operationId] = {digest, result}; state.configurations[id] = current; return {changed: true, result};
    });
  }
  async function publish(args) {
    requireThat(releases.canPublish, 'Restart Studio with --write --publish to grant publishing', 'FORBIDDEN');
    const {configurationId: id, expectedRevision, validationId, operationId} = args, digest = hash(args);
    const start = store.transact(state => {
      const source = releases.source(), record = get(state, id, source), receipt = record.receipts[operationId];
      if (receipt) {
        requireThat(receipt.digest === digest, 'Operation ID reused', 'OPERATION_REUSED');
        if (receipt.result.status === 'pushed') return {changed: false, result: {done: {...receipt.result, replayed: true}}};
      }
      requireThat(!Object.values(state.configurations ?? {}).some(item => Object.entries(item.receipts).some(([key, value]) => ['publishing', 'retry-required'].includes(value.result.status) && (item !== record || key !== operationId))), 'Another publication is in progress; recover its operation first', 'STORE_BUSY');
      requireThat(record.revision === expectedRevision, 'Configuration changed', 'REVISION_CONFLICT');
      const validation = record.validations[validationId]?.result; requireThat(validation, 'Validate this configuration before publishing');
      requireThat(validation.revision === expectedRevision && validation.effectiveHash === hash(resolve(state, id, source)), 'Configuration or mirror changed since validation', 'REVISION_CONFLICT');
      requireThat(validation.affectedPacks.length, 'This configuration already matches source');
      const plan = candidate(state, id, source);
      record.receipts[operationId] = {digest, request: json(args), result: {status: 'publishing', configurationId: id, operationId}};
      return {changed: true, result: {definition: plan.definition, related: plan.related, pack: record.pack, validation}};
    });
    if (start.done) return start.done;
    try {
      const publication = await releases.push({pack: start.pack, values: start.definition, related: start.related, validation: start.validation, operationId});
      return store.transact(state => {
        const record = get(state, id, releases.source());
        const result = {configurationId: id, revision: expectedRevision, operationId, ...publication};
        record.receipts[operationId] = {digest, result}; record.publications.push(result);
        if (record.revision === expectedRevision) record.baseHash = hash(releases.source().tokens[record.pack]);
        return {changed: true, result};
      });
    } catch (error) {
      // Keep the exact request recoverable even when a push outcome is uncertain.
      const recovered = store.transact(state => {const record = get(state, id, releases.source()); if (record.receipts[operationId].result.status === 'pushed') return {changed: false, result: record.receipts[operationId].result};
        record.receipts[operationId].result.status = ['SOURCE_CONFLICT', 'RELEASE_CONFLICT', 'FORBIDDEN', 'VALIDATION_ERROR', 'INVALID_INPUT'].includes(error.code) ? 'failed' : 'retry-required'; return {changed: true, result: {}};});
      if (recovered.status === 'pushed') return {...recovered, replayed: true};
      throw error;
    }
  }
  return {canPublish: releases.canPublish, dispatch(method, args) {
    if (['configuration.command', 'configuration.validate', 'configuration.publish'].includes(method)) requireThat(writable, 'This connection is read only', 'FORBIDDEN');
    if (method === 'configuration.command') return command(args);
    if (method === 'configuration.validate') return validate(args);
    if (method === 'configuration.publish') return publish(args);
    const state = store.read(), source = releases.source();
    if (method === 'configurations.list') return {configurations: [...new Set([...PACKS, ...Object.keys(state.configurations ?? {})])].map(id => {
      const value = read(state, id, source); return {configurationId: id, name: value.name, pack: value.pack, revision: value.revision, mirror: value.definition.mirror ?? null, dirty: value.dirty};
    })};
    if (method === 'configuration.read') return read(state, args.configurationId, source);
    if (method === 'configuration.compare') {
      const record = read(state, args.configurationId, source), saved = args.snapshotId ? record.snapshots[args.snapshotId] : null;
      requireThat(!args.snapshotId || saved, 'Unknown comparison snapshot', 'NOT_FOUND');
      return {configurationId: args.configurationId, revision: record.revision, before: saved?.values ?? record.sourceValues, after: record.values,
        changes: compareDocuments(saved?.values ?? record.sourceValues, record.values)};
    }
    if (method === 'configuration.preview') {
      const plan = candidate(state, args.configurationId, source);
      const baseline = args.snapshotId ? plan.record.snapshots[args.snapshotId]?.values : resolvePacks(source.tokens)[plan.record.pack];
      requireThat(baseline, 'Unknown comparison snapshot', 'NOT_FOUND');
      return {configurationId: args.configurationId, revision: plan.record.revision, css: plan.compiled.css, release: plan.compiled.release,
        beforeCSS: releases.compile(plan.record.pack, baseline).css,
        cssBytes: plan.compiled.cssBytes, gzipBytes: plan.compiled.gzipBytes, affectedPacks: plan.affectedPacks};
    }
  }};
}
