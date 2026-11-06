// Local, explicitly granted release adapter. Never shipped in public/ or consumers.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {spawn, execFileSync} from 'node:child_process';
import {buildCSS, buildSite, manifest} from '../../scripts/build.mjs';
import {gzipSync} from 'node:zlib';
import {canonical, requireThat} from './validation.mjs';
import {PACKS} from '../packs.mjs';

const defaultRoot = fileURLToPath(new URL('../../', import.meta.url));
export const hash = value => createHash('sha256').update(typeof value === 'string' ? value : canonical(value)).digest('hex');
const inputs = ['src', 'scripts', 'test', 'docs', '.github', 'public/assets', 'package.json', 'package-lock.json', 'AGENTS.md', 'README.md', 'studio', 'style-lab'];
function files(root, names = inputs) {
  const result = [];
  function visit(relative) {
    const absolute = path.join(root, relative);
    if (!fs.existsSync(absolute)) return;
    const stat = fs.lstatSync(absolute);
    requireThat(!stat.isSymbolicLink(), 'Release inputs cannot be symbolic links');
    if (stat.isDirectory()) for (const name of fs.readdirSync(absolute).sort()) visit(path.join(relative, name));
    else {requireThat(stat.isFile(), 'Release inputs must be ordinary files'); result.push(relative);}
  }
  for (const name of names) visit(name);
  return result;
}
function git(root, args, options = {}) {
  return execFileSync('git', ['-C', root, ...args], {encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'], timeout: 30000, maxBuffer: 8 * 1024 * 1024, ...options}).trim();
}
async function runCheck(root) {
  await new Promise((resolve, reject) => {
    const child = spawn(process.platform === 'win32' ? 'npm.cmd' : 'npm', ['run', 'check'], {cwd: root, stdio: ['ignore', 'pipe', 'pipe']});
    let tail = '', timedOut = false;
    const collect = bytes => {tail = (tail + bytes).slice(-6000);};
    child.stdout.on('data', collect); child.stderr.on('data', collect);
    const timer = setTimeout(() => {timedOut = true; child.kill('SIGTERM');}, 120000);
    child.once('error', error => {clearTimeout(timer); reject(error);});
    child.once('close', code => {clearTimeout(timer); if (code === 0) resolve(); else reject(Object.assign(new Error(timedOut ? 'Release validation timed out' : 'Release checks failed'), {code: 'VALIDATION_ERROR', details: {output: tail}}));});
  });
}
export function createReleaseManager({root = defaultRoot, publish = false, check = runCheck} = {}) {
  root = fs.realpathSync(root);
  function source() {
    const tokens = JSON.parse(fs.readFileSync(path.join(root, 'src/tokens.json'), 'utf8'));
    const controls = fs.readFileSync(path.join(root, 'src/controls.css'), 'utf8');
    const fingerprint = hash(files(root).map(name => [name, hash(fs.readFileSync(path.join(root, name)).toString('base64'))]));
    let head = null; try {head = git(root, ['rev-parse', 'HEAD']);} catch {}
    return {tokens, controls, fingerprint, head};
  }
  function compile(pack, values, related = {}) {
    requireThat(Object.keys(related).every(id => PACKS.includes(id) && id !== pack), 'Invalid related release pack');
    const current = source(), tokens = {...current.tokens, ...related, [pack]: values}, css = buildCSS(tokens, current.controls);
    requireThat(Buffer.byteLength(css) <= 36864 && gzipSync(css,{level:9}).length <= 8192 && !/@import|url\s*\(/i.test(css), 'Styles must remain within 36 KiB raw / 8 KiB gzip without external resources');
    return {...current, tokens, css, release: manifest(css), cssBytes: Buffer.byteLength(css), gzipBytes: gzipSync(css,{level:9}).length};
  }
  async function validate(pack, values, related) {
    const candidate = compile(pack, values, related), temporary = fs.mkdtempSync(path.join(fs.realpathSync(os.tmpdir()), 'shared-ui-validation-'));
    try {
      for (const name of files(root)) {const target = path.join(temporary, name); fs.mkdirSync(path.dirname(target), {recursive: true}); fs.copyFileSync(path.join(root, name), target);}
      fs.writeFileSync(path.join(temporary, 'src/tokens.json'), JSON.stringify(candidate.tokens, null, 2) + '\n');
      buildSite(temporary); // Consumer tests read the generated baseline before npm's final build.
      await check(temporary);
      requireThat(source().fingerprint === candidate.fingerprint, 'Shared source changed during validation; validate again', 'SOURCE_CONFLICT');
      return {sourceHash: candidate.fingerprint, sourceHead: candidate.head, candidateHash: hash(candidate.tokens), release: candidate.release,
        cssBytes: candidate.cssBytes, gzipBytes: candidate.gzipBytes, checks: 'npm run check', checkedAt: new Date().toISOString()};
    } finally {fs.rmSync(temporary, {recursive: true, force: true});}
  }
  async function push({pack, values, related, validation, operationId}) {
    requireThat(publish, 'Restart Studio with --write --publish to grant release publishing', 'FORBIDDEN');
    const message = `Update ${pack} configuration\n\nStudio-Operation: ${operationId}\nStudio-Candidate: ${validation.candidateHash}`;
    // Recover the gap between a successful push/local fast-forward and its store receipt.
    const current = source();
    if (current.head && git(root, ['log', '-1', '--format=%B']) === message && git(root, ['rev-parse', 'HEAD^']) === validation.sourceHead) {
      const remote = git(root, ['remote', 'get-url', '--push', 'origin']);
      const remoteHead = git(root, ['ls-remote', remote, 'refs/heads/main']).split(/\s/)[0];
      requireThat(remoteHead === current.head, 'Publication recovery needs the original remote revision', 'RELEASE_CONFLICT');
      return {status: 'pushed', commit: current.head, branch: 'main', release: validation.release, checkoutUpdated: true,
        deployment: 'GitHub Pages workflow pending', workflowURL: 'https://github.com/andyherle/shared-ui/actions/workflows/pages.yml'};
    }
    const candidate = compile(pack, values, related);
    requireThat(candidate.fingerprint === validation.sourceHash && candidate.head === validation.sourceHead && hash(candidate.tokens) === validation.candidateHash,
      'Shared source changed since validation; validate again', 'SOURCE_CONFLICT');
    requireThat(git(root, ['status', '--porcelain', '--untracked-files=no']) === '', 'Commit source changes before publishing a configuration', 'RELEASE_CONFLICT');
    const extra = git(root, ['ls-files', '--others', '--exclude-standard']).split('\n').filter(Boolean);
    requireThat(extra.every(name => /(^|\/)\.DS_Store$|^public\/v1\/styles\.[a-f0-9]{64}\.css$/.test(name)), 'Untracked source files must be committed before publishing', 'RELEASE_CONFLICT');
    const remote = git(root, ['remote', 'get-url', '--push', 'origin']);
    requireThat(remote.length > 0 && !remote.startsWith('-'), 'Configure the origin release remote');
    const temporary = fs.mkdtempSync(path.join(fs.realpathSync(os.tmpdir()), 'shared-ui-release-'));
    const checkout = path.join(temporary, 'checkout');
    try {
      git(root, ['clone', '--no-hardlinks', '--quiet', '--no-checkout', root, checkout]);
      git(checkout, ['checkout', '--quiet', '--detach', validation.sourceHead]);
      fs.writeFileSync(path.join(checkout, 'src/tokens.json'), JSON.stringify(candidate.tokens, null, 2) + '\n');
      buildSite(checkout);
      await check(checkout);
      requireThat(source().fingerprint === validation.sourceHash && git(root, ['status', '--porcelain', '--untracked-files=no']) === '', 'Source changed while preparing publication', 'SOURCE_CONFLICT');
      git(checkout, ['add', '--', 'src/tokens.json', 'public']);
      const tree = git(checkout, ['write-tree']);
      // Fixed parent, tree, identity and time make interrupted retries recover the same commit.
      const env = {...process.env, GIT_AUTHOR_NAME: 'Shared UI Studio', GIT_AUTHOR_EMAIL: 'studio@shared-ui.local',
        GIT_COMMITTER_NAME: 'Shared UI Studio', GIT_COMMITTER_EMAIL: 'studio@shared-ui.local',
        GIT_AUTHOR_DATE: validation.checkedAt, GIT_COMMITTER_DATE: validation.checkedAt};
      const commit = git(checkout, ['commit-tree', tree, '-p', validation.sourceHead, '-m', message], {env});
      const remoteHead = git(root, ['ls-remote', remote, 'refs/heads/main']).split(/\s/)[0];
      requireThat([validation.sourceHead, commit].includes(remoteHead), 'Origin main changed; update source and validate again', 'RELEASE_CONFLICT');
      // Recheck the checkout immediately before the only remote write.
      // The commit has the validated head as its sole parent. The lease is a
      // compare-and-swap against that head, including concurrent remote rollbacks.
      if (remoteHead !== commit) {
        try {git(checkout, ['push', `--force-with-lease=refs/heads/main:${validation.sourceHead}`, remote, `${commit}:refs/heads/main`]);}
        catch {requireThat(false, 'Git push did not confirm its outcome. Check origin access, then retry the identical publication request.', 'PUBLICATION_UNCERTAIN');}
      }
      let checkoutUpdated = false;
      if (git(root, ['rev-parse', 'HEAD']) === validation.sourceHead && git(root, ['status', '--porcelain', '--untracked-files=no']) === '') {
        try {git(root, ['fetch', '--quiet', checkout, commit]); git(root, ['merge', '--ff-only', '--quiet', commit]); checkoutUpdated = true;} catch {}
      }
      return {status: 'pushed', commit, branch: 'main', release: validation.release, checkoutUpdated,
        deployment: 'GitHub Pages workflow pending', workflowURL: 'https://github.com/andyherle/shared-ui/actions/workflows/pages.yml'};
    } finally {fs.rmSync(temporary, {recursive: true, force: true});}
  }
  return {source, compile, validate, push, canPublish: publish};
}
