import {resolveScopedTokens} from './tokens.mjs';
import {COMPONENTS} from './registry.mjs';
import {requireThat} from './validation.mjs';

/** Declared dependencies, not a claim about computed pixels or live app usage. */
export function tokenImpact(document, catalogue, token, nodeId) {
  requireThat(Object.hasOwn(catalogue.definitions, token), 'Unknown token');
  requireThat(!nodeId || Object.hasOwn(document.nodes, nodeId), 'Unknown node', 'NOT_FOUND');
  const origin = nodeId ? document.nodes[nodeId].tokens : document.tokens;
  const graph = resolveScopedTokens(catalogue, document.tokens, nodeId ? origin : {}, nodeId);
  const related = new Set([token]);
  // Compound CSS and context-specific aliases are potential edges. Preserve that
  // distinction instead of presenting a lexical inventory as a browser trace.
  const edges = new Map();
  for (const item of catalogue.tokens) for (const use of item.uses) {
    if (use.property.startsWith('--ui-') && catalogue.definitions[use.property]) {
      if (!edges.has(item.id)) edges.set(item.id, new Set());
      edges.get(item.id).add(use.property);
    }
  }
  for (const [id, value] of Object.entries(graph)) for (const dependency of value.chain.slice(1)) {
    if (!edges.has(dependency)) edges.set(dependency, new Set());
    edges.get(dependency).add(id);
  }
  const queue = [token];
  while (queue.length) for (const id of edges.get(queue.shift()) ?? []) if (!related.has(id)) {related.add(id); queue.push(id);}
  const types = COMPONENTS.filter(item => item.tokens.some(id => related.has(id)));
  const nodes = [];
  const visit = (id, blocked = new Set(), inScope = !nodeId) => {
    const node = document.nodes[id];
    if (id === nodeId) {inScope = true; blocked = new Set();}
    else if (inScope) blocked = new Set([...blocked, ...Object.keys(node.tokens)]);
    if (inScope) {
      const component = types.find(item => item.id === node.componentId);
      const tokens = component?.tokens.filter(value => related.has(value) && !blocked.has(value)) ?? [];
      if (tokens.length) nodes.push({id, componentId: node.componentId, name: node.props.label || component.name, tokens});
    }
    for (const children of Object.values(node.slots)) for (const child of children) visit(child, blocked, inScope);
  };
  if (document.root) visit(document.root);
  return {token, scope: nodeId ? {nodeId} : {document: true}, value: graph[token],
    tokens: [...related].map(id => ({id, dependsOn: [...edges].filter(([, values]) => values.has(id)).map(([key]) => key).filter(key => related.has(key)), value: graph[id]?.value})),
    components: types.map(item => ({id: item.id, name: item.name, tokens: item.tokens.filter(id => related.has(id))})), nodes,
    coverage: {kind: 'declared-potential', computedStyles: false, liveConsumers: false,
      note: 'Current draft and shared declarations only. CSS states and aliases can narrow the visible effect; running apps are not connected.'}};
}
