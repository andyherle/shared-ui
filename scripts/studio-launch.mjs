#!/usr/bin/env node
import os from 'node:os';
import path from 'node:path';
import {randomBytes} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {startStudio} from './studio-server.mjs';
import {localOptions, serviceFromOptions} from '../src/studio/local.mjs';
import {writeStudioConnection} from '../src/studio/connection.mjs';

// Foreground only: no LaunchAgent, login item, tunnel, or auto-restart.
const args = process.argv.slice(2);
const options = localOptions(args.length ? args : ['--store', path.join(os.homedir(), 'Library/Application Support/Shared UI Studio/drafts'), '--demo', '--write']);
const service = serviceFromOptions(options);
let editor, mcp;
try {
  const {startMCPHTTP} = await import('../tools/studio-mcp/server.mjs');
  const token = randomBytes(32).toString('hex');
  editor = await startStudio({service, port: +(options['--port'] ?? 41913)});
  mcp = await startMCPHTTP({service, token});
  const config = {editor: editor.url + '#' + editor.token, http: {url: mcp.url, authorization: 'Bearer ' + token},
    mcpServers: {'shared-ui-studio': {command: process.execPath, args: [fileURLToPath(new URL('../tools/studio-mcp/server.mjs', import.meta.url)), '--store', options['--store'], ...(options['--demo'] ? ['--demo'] : ['--views', options['--views']]), ...(options['--write'] ? ['--write'] : [])]}}};
  const {filename, tokenFile} = writeStudioConnection(options['--store'], config, token);
  console.log(`Shared UI Studio · foreground session\nOpen ${config.editor}\nMCP ${mcp.url}\nPrivate connection details: ${filename}\nPortal token file: ${tokenFile}\nStop with Ctrl-C. No background service was installed.`);
  let closing = false;
  async function close() {if (closing) return; closing = true; await Promise.all([editor.close(), mcp.close()]); process.exit(0);}
  for (const signal of ['SIGINT', 'SIGTERM']) process.once(signal, close);
} catch (error) {
  await Promise.all([editor?.close(), mcp?.close()]);
  console.error(error.code === 'ERR_MODULE_NOT_FOUND' ? 'Install the optional transport first: npm ci --prefix tools/studio-mcp --ignore-scripts' : error.message); process.exitCode = 2;
}
