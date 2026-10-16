import fs from 'node:fs';
import path from 'node:path';
import {randomUUID} from 'node:crypto';
import {requireThat} from './validation.mjs';

// The service owns this directory. Consumers register mcp.token once, then
// reread it for each request; rotating a session never changes that path.
export function writeStudioConnection(directory, config, token) {
  requireThat(path.isAbsolute(directory), 'Connection directory must be absolute');
  requireThat(/^[A-Za-z0-9_-]{32,}$/.test(token), 'Connection needs a strong token');
  const info = fs.lstatSync(directory);
  requireThat(info.isDirectory() && !info.isSymbolicLink(), 'Connection directory must be a real directory');
  fs.chmodSync(directory, 0o700);
  const tokenFile = path.join(directory, 'mcp.token');
  const filename = path.join(directory, 'connection.json');
  const connection = {...config, http: {...config.http, token_file: tokenFile}};
  // Validate both destinations before replacing either. Never follow a link or
  // truncate a file that another process may currently be reading.
  for (const destination of [filename, tokenFile]) {
    try {
      const current = fs.lstatSync(destination);
      requireThat(current.isFile() && current.nlink === 1, 'Connection destination must be a regular file without links');
    } catch (error) { if (error.code !== 'ENOENT') throw error; }
  }
  function replace(destination, contents) {
    const temporary = path.join(directory, `.connection-${randomUUID()}.tmp`);
    let descriptor;
    try {
      descriptor = fs.openSync(temporary, fs.constants.O_WRONLY | fs.constants.O_CREAT | fs.constants.O_EXCL | fs.constants.O_NOFOLLOW, 0o600);
      fs.writeFileSync(descriptor, contents); fs.fsyncSync(descriptor);
      fs.closeSync(descriptor); descriptor = undefined;
      fs.renameSync(temporary, destination);
    } finally {
      if (descriptor !== undefined) fs.closeSync(descriptor);
      try { fs.unlinkSync(temporary); } catch (error) { if (error.code !== 'ENOENT') throw error; }
    }
  }
  replace(filename, JSON.stringify(connection, null, 2) + '\n');
  replace(tokenFile, token + '\n');
  const directoryFD = fs.openSync(directory, fs.constants.O_RDONLY | fs.constants.O_NOFOLLOW);
  try { fs.fsyncSync(directoryFD); } finally { fs.closeSync(directoryFD); }
  return {filename, tokenFile};
}
