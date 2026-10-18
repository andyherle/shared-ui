#!/usr/bin/env node
import http from 'node:http';
import {fileURLToPath} from 'node:url';
import {Server, createMcpHandler} from '@modelcontextprotocol/server';
import {serveStdio} from '@modelcontextprotocol/server/stdio';
import {toNodeHandler} from '@modelcontextprotocol/node';
import {METHODS} from '../../src/studio/service.mjs';
import {authorized, errorResult, localOptions, localRequest, secureHeaders, sendJSON, serviceFromOptions} from '../../src/studio/local.mjs';

export function createMCPServer(service) {
  const permissions = service.dispatch({method: 'describe'}).permissions;
  const available = Object.entries(METHODS).filter(([, entry]) => entry.permission === 'read' || permissions[entry.permission]);
  const names = new Map(available.map(([method]) => ['studio_' + method.replaceAll('.', '_'), method]));
  const server = new Server({name: 'shared-ui-studio', version: '0.1.0'}, {capabilities: {tools: {}},
    instructions: 'Read the exact document or configuration before editing. Commands require its current revision and a unique operation ID. Retry uncertain writes with identical arguments. Personal mirrors Postvisual; configuration publication requires an exact validation receipt and explicit local publish permission. A pushed release still awaits the Pages workflow. Application source is outside this service.'});
  server.setRequestHandler('tools/list', () => ({tools: available.map(([method, entry]) => ({
    name: 'studio_' + method.replaceAll('.', '_'), description: entry.description, inputSchema: entry.inputSchema,
    annotations: {readOnlyHint: entry.permission === 'read', destructiveHint: entry.permission !== 'read', idempotentHint: true, openWorldHint: entry.permission === 'publish'}
  }))}));
  server.setRequestHandler('tools/call', async request => {
    const method = names.get(request.params.name);
    try {
      if (!method) throw Object.assign(new Error('Unknown or unavailable Studio tool'), {code: 'FORBIDDEN'});
      const result = await service.dispatch({method, args: request.params.arguments ?? {}});
      return {content: [{type: 'text', text: JSON.stringify(result)}], structuredContent: result};
    } catch (error) {
      const result = errorResult(error);
      return {isError: true, content: [{type: 'text', text: JSON.stringify(result)}], structuredContent: result};
    }
  });
  return server;
}
export async function startMCPHTTP({service, token, port = 41914}) {
  if (!token || !/^[A-Za-z0-9_-]{32,}$/.test(token)) throw new Error('Set STUDIO_MCP_TOKEN to a random token of at least 32 URL-safe characters');
  const handler = createMcpHandler(() => createMCPServer(service), {maxRequestBodySize: 4 * 1024 * 1024});
  const handle = toNodeHandler(handler);
  const server = http.createServer(async (request, response) => {
    secureHeaders(response);
    if (!localRequest(request, server.address().port)) return sendJSON(response, 403, {error: 'Local origin required'});
    if (request.url !== '/mcp') return sendJSON(response, 404, {error: 'Not found'});
    if (!authorized(request, token)) return sendJSON(response, 401, {error: 'Bearer token required'});
    await handle(request, response);
  });
  server.requestTimeout = 15000; server.headersTimeout = 10000;
  await new Promise((resolve, reject) => {server.once('error', reject); server.listen(port, '127.0.0.1', resolve);});
  return {server, url: `http://127.0.0.1:${server.address().port}/mcp`, close: async () => {
    await handler.close(); await new Promise(resolve => {server.close(resolve); server.closeAllConnections();});
  }};
}
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  try {
    const options = localOptions(process.argv.slice(2), ['--http']);
    const service = serviceFromOptions(options);
    const running = options['--http'] ? await startMCPHTTP({service, port: +(options['--port'] ?? 41914), token: process.env.STUDIO_MCP_TOKEN}) : serveStdio(() => createMCPServer(service));
    if (options['--http']) process.stderr.write(`Shared UI Studio MCP: ${running.url}\n`);
    for (const signal of ['SIGINT', 'SIGTERM']) process.once(signal, () => running.close().then(() => process.exit(0)));
  } catch (error) {process.stderr.write(error.message + '\n'); process.exitCode = 2;}
}
