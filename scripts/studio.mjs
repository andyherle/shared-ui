#!/usr/bin/env node
import fs from 'node:fs';
import {fileURLToPath} from 'node:url';
import {createAuthoringService, DEMO_VIEWS, SERVICE_CONTRACT} from '../src/studio/service.mjs';
import {requireThat} from '../src/studio/validation.mjs';

/** One JSON request on stdin; one JSON result. No listener or background process. */
export function runStudioCLI(args, {read = file => fs.readFileSync(file, 'utf8'), write = value => process.stdout.write(value + '\n'), error = value => process.stderr.write(value + '\n')} = {}) {
  try {
    const options = {};
    for (let index = 0; index < args.length; index++) {
      const flag = args[index]; requireThat(['--store', '--views', '--demo', '--write', '--publish', '--describe'].includes(flag) && !Object.hasOwn(options, flag), `Unknown or repeated option: ${flag}`);
      if (['--store', '--views'].includes(flag)) { const value = args[++index]; requireThat(value && !value.startsWith('--'), `Missing ${flag} value`); options[flag] = value; }
      else options[flag] = true;
    }
    if (options['--describe']) {
      requireThat(args.length === 1, '--describe does not take store options'); write(JSON.stringify(SERVICE_CONTRACT)); return 0;
    }
    requireThat(options['--store'], '--store requires an absolute private directory');
    requireThat(Boolean(options['--views']) !== Boolean(options['--demo']), 'Choose --views <registration.json> or --demo');
    const request = JSON.parse(read(0));
    const service = createAuthoringService({directory: options['--store'], writable: Boolean(options['--write']), publish: Boolean(options['--publish']),
      views: options['--demo'] ? DEMO_VIEWS : JSON.parse(read(options['--views']))});
    const result = service.dispatch(request);
    if (result?.then) return result.then(value => {write(JSON.stringify(value)); return 0;}, cause => {error(JSON.stringify({error: {code: cause.code ?? 'OPERATION_FAILED', message: cause.message}})); return 2;});
    write(JSON.stringify(result)); return 0;
  } catch (cause) {
    error(JSON.stringify({error: {code: cause.code ?? 'OPERATION_FAILED', message: cause.message, details: cause.details ?? {}}})); return 2;
  }
}
if (process.argv[1] === fileURLToPath(import.meta.url)) process.exitCode = await runStudioCLI(process.argv.slice(2));
