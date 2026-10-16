/* Read-only loopback harness. Never mounts the authoring service. */
import fs from 'node:fs';
import {fileURLToPath} from 'node:url';
import {createStyleLabServer} from '../scripts/serve.mjs';
import {buildSite} from '../scripts/build.mjs';
buildSite();
const server = createStyleLabServer({watch: false}), catalogue = server.listeners('request')[0];
const files = new Set(['/test/studio-browser.html', '/test/schema-audit-browser.html', '/src/schema-audit.mjs', '/src/studio/registry.mjs', '/src/studio/validation.mjs']);
server.removeAllListeners('request');
server.on('request', (request, response) => {
  const port = server.address().port;
  if (![`127.0.0.1:${port}`, `localhost:${port}`].includes(request.headers.host)) { response.writeHead(403); response.end(); return; }
  if (!['GET', 'HEAD'].includes(request.method)) { response.writeHead(405); response.end(); return; }
  const pathname = new URL(request.url, 'http://localhost').pathname;
  if (!files.has(pathname)) { catalogue(request, response); return; }
  response.setHeader('Content-Type', pathname.endsWith('.mjs') ? 'text/javascript; charset=utf-8' : 'text/html; charset=utf-8');
  response.setHeader('Cache-Control', 'no-store'); response.setHeader('X-Content-Type-Options', 'nosniff');
  response.end(request.method === 'HEAD' ? undefined : fs.readFileSync(fileURLToPath(new URL('..' + pathname, import.meta.url))));
});
server.listen(Number(process.env.STUDIO_TEST_PORT ?? 41912), '127.0.0.1', () => console.log(`Studio browser checks: http://127.0.0.1:${server.address().port}/test/studio-browser.html`));
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => { server.close(); server.closeAllConnections(); });
