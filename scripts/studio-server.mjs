#!/usr/bin/env node
import fs from 'node:fs';
import http from 'node:http';
import {randomBytes} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {authorized, errorResult, localOptions, localRequest, readJSON, secureHeaders, sendJSON, serviceFromOptions} from '../src/studio/local.mjs';

// Exact asset routes: no filesystem path, private store, or repository mount.
const assets = new Map([
  ['/', ['../src/studio/editor.html', 'text/html']],
  ['/editor.mjs', ['../src/studio/editor.mjs', 'text/javascript']],
  ['/renderer.mjs', ['../src/studio/renderer.mjs', 'text/javascript']],
  ['/editor.css', ['../src/studio/editor.css', 'text/css']],
  ['/preview.html', ['../src/studio/preview.html', 'text/html']],
  ['/preview.mjs', ['../src/studio/preview.mjs', 'text/javascript']],
  ['/appearance.html', ['../src/appearance/studio.html', 'text/html']],
  ['/appearance-demo.html', ['../src/appearance/demo.html', 'text/html']],
  ...['schema.mjs', 'controller.mjs', 'persistence.mjs', 'editor.mjs', 'studio-persistence.mjs',
      'studio-page.mjs', 'demo-registry.mjs', 'demo.mjs', 'editor.css'].map(name =>
        ['/appearance/' + name, ['../src/appearance/' + name, name.endsWith('.css') ? 'text/css' : 'text/javascript']]),
  ...['styles.css', 'runtime.js', 'icons.svg'].map(name => [`/v1/${name}`, [`../public/v1/${name}`, name.endsWith('css') ? 'text/css' : name.endsWith('svg') ? 'image/svg+xml' : 'text/javascript']])
]);
export async function startStudio({service, port = 41913, token = randomBytes(32).toString('hex')}) {
  if (!/^[A-Za-z0-9_-]{32,}$/.test(token)) throw new Error('Studio needs a strong token');
  const server = http.createServer(async (request, response) => {
    secureHeaders(response);
    if (!localRequest(request, server.address().port)) return sendJSON(response, 403, {error: {message: 'Local origin required'}});
    if (request.url === '/api' && request.method === 'POST') {
      if (!authorized(request, token)) return sendJSON(response, 401, {error: {message: 'Open the launch link from the local Studio process.'}});
      try {
        const result = service.dispatch(await readJSON(request));
        return sendJSON(response, 200, {result});
      } catch (error) { return sendJSON(response, error.status ?? (error.code === 'REVISION_CONFLICT' ? 409 : error.code === 'FORBIDDEN' ? 403 : 400), error.status ? {error: {message: error.message}} : errorResult(error)); }
    }
    const asset = assets.get(request.url);
    if (!asset || request.method !== 'GET') return sendJSON(response, 404, {error: {message: 'Not found'}});
    try {
      if (request.url === '/preview.html') {
        response.removeHeader('X-Frame-Options');
        response.setHeader('Content-Security-Policy', "default-src 'none'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self'; frame-ancestors 'self'; base-uri 'none'; form-action 'none'");
      }
      const body = fs.readFileSync(new URL(asset[0], import.meta.url));
      response.writeHead(200, {'Content-Type': asset[1] + '; charset=utf-8'}); response.end(body);
    } catch { sendJSON(response, 503, {error: {message: 'Studio assets are unavailable. Run npm run check in the source checkout.'}}); }
  });
  server.requestTimeout = 15000; server.headersTimeout = 10000;
  await new Promise((resolve, reject) => { server.once('error', reject); server.listen(port, '127.0.0.1', resolve); });
  return {server, token, url: `http://127.0.0.1:${server.address().port}/`, close: () => new Promise(resolve => {server.close(resolve); server.closeAllConnections();})};
}
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  try {
    const options = localOptions(process.argv.slice(2));
    const app = await startStudio({service: serviceFromOptions(options), port: +(options['--port'] ?? 41913)});
    process.stdout.write(`Shared UI Studio (${options['--write'] ? 'draft editing' : 'read only'})\n${app.url}#${app.token}\n`);
    for (const signal of ['SIGINT', 'SIGTERM']) process.once(signal, () => app.close().then(() => process.exit(0)));
  } catch (error) { process.stderr.write(error.message + '\n'); process.exitCode = 2; }
}
