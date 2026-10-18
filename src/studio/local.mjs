import fs from 'node:fs';
import {timingSafeEqual} from 'node:crypto';
import {createAuthoringService, DEMO_VIEWS} from './service.mjs';
import {requireThat} from './validation.mjs';

export function localOptions(args, extra = []) {
  const options = {};
  const valued = ['--store', '--views', '--port'];
  const allowed = [...valued, '--demo', '--write', '--publish', ...extra];
  for (let i = 0; i < args.length; i++) {
    const flag = args[i];
    requireThat(allowed.includes(flag) && !Object.hasOwn(options, flag), `Unknown or repeated option: ${flag}`);
    if (valued.includes(flag)) {
      requireThat(args[i + 1] && !args[i + 1].startsWith('--'), `Missing ${flag} value`);
      options[flag] = args[++i];
    } else options[flag] = true;
  }
  requireThat(options['--store'], '--store requires an absolute private directory');
  requireThat(!options['--publish'] || options['--write'], '--publish requires --write');
  requireThat(Boolean(options['--demo']) !== Boolean(options['--views']), 'Choose --demo or --views <private registrations.json>');
  if (options['--port']) requireThat(/^\d+$/.test(options['--port']) && +options['--port'] <= 65535, 'Invalid port');
  return options;
}
export function serviceFromOptions(options) {
  return createAuthoringService({directory: options['--store'], writable: !!options['--write'], publish: !!options['--publish'],
    views: options['--demo'] ? DEMO_VIEWS : JSON.parse(fs.readFileSync(options['--views'], 'utf8'))});
}
export function errorResult(error) {
  // Filesystem errors can contain private absolute paths. Do not send those to a client.
  const known = ['INVALID_INPUT', 'INVALID_ARGUMENT', 'VALIDATION_ERROR', 'REVISION_CONFLICT', 'OPERATION_REUSED', 'STORE_BUSY', 'NOT_FOUND', 'FORBIDDEN', 'UNDO_CONFLICT', 'INCOMPATIBLE_BINDING', 'READ_ONLY_VIEW', 'SOURCE_CONFLICT', 'RELEASE_CONFLICT', 'PUBLICATION_UNCERTAIN'];
  return {error: {code: error.code ?? 'OPERATION_FAILED', message: known.includes(error.code) ? error.message : 'Studio could not complete the request. Check the local service and retry.', details: error.details ?? {}}};
}
export function secureHeaders(response) {
  response.setHeader('Cache-Control', 'no-store');
  response.setHeader('X-Content-Type-Options', 'nosniff');
  response.setHeader('Referrer-Policy', 'no-referrer');
  response.setHeader('Cross-Origin-Resource-Policy', 'same-origin');
  response.setHeader('X-Frame-Options', 'DENY');
  response.setHeader('Content-Security-Policy', "default-src 'none'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'; frame-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'none'");
}
export function localRequest(request, port) {
  const host = `127.0.0.1:${port}`;
  return request.headers.host === host && (!request.headers.origin || request.headers.origin === `http://${host}`) &&
    !['cross-site', 'same-site'].includes(request.headers['sec-fetch-site']);
}
export function authorized(request, token) {
  const expected = Buffer.from(`Bearer ${token}`), actual = Buffer.from(request.headers.authorization ?? '');
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}
export async function readJSON(request, limit = 4 * 1024 * 1024) {
  if (request.headers['content-type']?.split(';')[0] !== 'application/json') throw Object.assign(new Error('Use application/json'), {status: 415});
  if (Number(request.headers['content-length']) > limit) throw Object.assign(new Error('Request too large'), {status: 413});
  let size = 0; const chunks = [];
  for await (const chunk of request) {
    size += chunk.length;
    if (size > limit) throw Object.assign(new Error('Request too large'), {status: 413});
    chunks.push(chunk);
  }
  try { return JSON.parse(Buffer.concat(chunks).toString('utf8')); }
  catch { throw Object.assign(new Error('Invalid JSON'), {status: 400}); }
}
export function sendJSON(response, status, value) {
  response.writeHead(status, {'Content-Type': 'application/json; charset=utf-8'}); response.end(JSON.stringify(value));
}
