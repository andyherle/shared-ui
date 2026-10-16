import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import http from 'node:http';
import {Client} from '@modelcontextprotocol/client';
import {StdioClientTransport} from '@modelcontextprotocol/client/stdio';
import {StreamableHTTPClientTransport} from '@modelcontextprotocol/client';
import {createAuthoringService, DEMO_VIEWS, METHODS} from '../../../src/studio/service.mjs';
import {startStudio} from '../../../scripts/studio-server.mjs';
import {startMCPHTTP} from '../server.mjs';
const fixture = () => JSON.parse(fs.readFileSync(new URL('../../../test/fixtures/studio-document.json', import.meta.url)));
function harness(t) {
  const directory = fs.mkdtempSync(path.join(fs.realpathSync(os.tmpdir()), 'studio-mcp-'));
  t.after(() => fs.rmSync(directory, {recursive: true, force: true}));
  return {directory, service: createAuthoringService({directory, views: DEMO_VIEWS, writable: true})};
}
async function connectStdio(t, directory, writable = true, options = {}) {
  const client = new Client({name: 'studio-integration-test', version: '1.0.0'}, options);
  const transport = new StdioClientTransport({command: process.execPath,
    args: [new URL('../server.mjs', import.meta.url).pathname, '--store', directory, '--demo', ...(writable ? ['--write'] : [])], stderr: 'pipe'});
  await client.connect(transport); t.after(() => client.close()); return client;
}
const call = (client, method, args = {}) => client.callTool({name: 'studio_' + method.replaceAll('.', '_'), arguments: args});
test('official SDK stdio discovers the contract, edits, replays, and reports conflicts across the editor', async t => {
  const {directory, service} = harness(t), client = await connectStdio(t, directory);
  const {tools} = await client.listTools(); assert.equal(tools.length, Object.keys(METHODS).length);
  assert.ok(tools.find(tool => tool.name === 'studio_document_command').inputSchema.properties.command.oneOf.length >= 18);
  const create = {documentId: 'review', expectedRevision: 0, operationId: 'create', command: {type: 'create', document: fixture()}};
  let result = await call(client, 'document.command', create); assert.equal(result.isError, undefined); assert.equal(result.structuredContent.revision, 1);
  const editor = await startStudio({service, port: 0}); t.after(editor.close);
  const response = await fetch(editor.url + 'api', {method: 'POST', headers: {'Content-Type': 'application/json', Authorization: `Bearer ${editor.token}`},
    body: JSON.stringify({method: 'document.command', args: {documentId: 'review', expectedRevision: 1, operationId: 'human', command: {type: 'set-props', nodeId: 'save', props: {label: 'Human edit'}}}})});
  assert.equal(response.status, 200);
  result = await call(client, 'document.command', {documentId: 'review', expectedRevision: 1, operationId: 'stale', command: {type: 'rename', name: 'Stale'}});
  assert.equal(result.isError, true); assert.equal(result.structuredContent.error.code, 'REVISION_CONFLICT');
  result = await call(client, 'document.command', create); assert.equal(result.structuredContent.replayed, true);
  assert.equal((await call(client, 'document.read', {documentId: 'review'})).structuredContent.document.nodes.save.props.label, 'Human edit');
  await client.close(); const restarted = await connectStdio(t, directory);
  assert.equal((await call(restarted, 'document.command', create)).structuredContent.replayed, true);
});
test('read-only stdio never advertises or executes writes', async t => {
  const {directory} = harness(t), client = await connectStdio(t, directory, false);
  assert.ok(!(await client.listTools()).tools.some(tool => tool.name === 'studio_document_command'));
  const result = await call(client, 'document.command', {}); assert.equal(result.isError, true);
  assert.equal(fs.existsSync(path.join(directory, 'studio.json')), false);
});
test('2025-era stdio clients retain initialization and tool compatibility', async t => {
  const {directory} = harness(t), client = await connectStdio(t, directory, true, {supportedProtocolVersions: ['2025-11-25']});
  assert.equal((await client.listTools()).tools.length, Object.keys(METHODS).length);
  assert.equal((await call(client, 'views.list')).structuredContent.views[0].appId, 'studio-demo');
});
test('authenticated Streamable HTTP uses the same SDK contract and rejects public origins', async t => {
  const {service} = harness(t), token = 'synthetic-test-token-'.repeat(4);
  const app = await startMCPHTTP({service, token, port: 0}); t.after(app.close);
  assert.equal((await fetch(app.url)).status, 401);
  assert.equal((await fetch(app.url, {headers: {Authorization: `Bearer ${token}`, Origin: 'https://untrusted.example'}})).status, 403);
  const rebound = await new Promise(resolve => http.get(app.url, {headers: {Authorization: `Bearer ${token}`, Host: 'untrusted.example'}}, response => {response.resume(); resolve(response.statusCode);}));
  assert.equal(rebound, 403);
  const client = new Client({name: 'studio-http-test', version: '1.0.0'});
  await client.connect(new StreamableHTTPClientTransport(new URL(app.url), {requestInit: {headers: {Authorization: `Bearer ${token}`}}})); t.after(() => client.close());
  assert.equal((await client.listTools()).tools.length, Object.keys(METHODS).length);
  const result = await call(client, 'document.command', {documentId: 'review', expectedRevision: 0, operationId: 'create', command: {type: 'create', document: fixture()}});
  assert.equal(result.structuredContent.revision, 1);
  assert.equal(service.dispatch({method: 'document.read', args: {documentId: 'review'}}).revision, 1);
  const legacy = new Client({name: 'studio-legacy-http-test', version: '1.0.0'}, {supportedProtocolVersions: ['2025-11-25']});
  await legacy.connect(new StreamableHTTPClientTransport(new URL(app.url), {requestInit: {headers: {Authorization: `Bearer ${token}`}}})); t.after(() => legacy.close());
  assert.equal((await call(legacy, 'document.read', {documentId: 'review'})).structuredContent.revision, 1);
});
