import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {writeStudioConnection} from '../src/studio/connection.mjs';

function setup(t) {
  const directory = fs.mkdtempSync(path.join(fs.realpathSync(os.tmpdir()), 'studio-connection-'));
  t.after(() => fs.rmSync(directory, {recursive: true, force: true}));
  return directory;
}
const config = {http: {url: 'http://127.0.0.1:41914/mcp'}};
test('launch credentials rotate atomically at a stable private raw-token path', t => {
  const directory = setup(t), first = 'a'.repeat(64), second = 'b'.repeat(64);
  fs.chmodSync(directory, 0o755);
  const {filename, tokenFile} = writeStudioConnection(directory, config, first);
  const old = fs.openSync(tokenFile, 'r'); t.after(() => fs.closeSync(old));
  assert.deepEqual(writeStudioConnection(directory, config, second), {filename, tokenFile});
  assert.equal(fs.readFileSync(old, 'utf8'), first + '\n');
  assert.equal(fs.readFileSync(tokenFile, 'utf8'), second + '\n');
  assert.deepEqual(JSON.parse(fs.readFileSync(filename, 'utf8')).http, {...config.http, token_file: tokenFile});
  assert.equal(fs.statSync(directory).mode & 0o777, 0o700);
  for (const file of [filename, tokenFile]) assert.equal(fs.statSync(file).mode & 0o777, 0o600);
  assert.deepEqual(fs.readdirSync(directory).sort(), ['connection.json', 'mcp.token']);
});
test('unsafe credential destinations leave existing files intact', t => {
  for (const name of ['mcp.token', 'connection.json']) {
    for (const kind of ['symlink', 'hardlink', 'directory']) {
      const directory = setup(t), original = path.join(directory, 'original');
      fs.writeFileSync(original, 'keep');
      const destination = path.join(directory, name);
      if (kind === 'symlink') fs.symlinkSync(original, destination);
      else if (kind === 'hardlink') fs.linkSync(original, destination);
      else fs.mkdirSync(destination);
      assert.throws(() => writeStudioConnection(directory, config, 'c'.repeat(64)), /without links/);
      assert.equal(fs.readFileSync(original, 'utf8'), 'keep');
      assert.equal(fs.existsSync(path.join(directory, name === 'mcp.token' ? 'connection.json' : 'mcp.token')), false);
    }
  }
});
