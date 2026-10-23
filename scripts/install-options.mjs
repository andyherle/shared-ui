export function installOptions(args) {
  const seen = new Set(); let target, check = false;
  for (let index = 0; index < args.length; index++) {
    const flag = args[index];
    if (!['--target', '--check'].includes(flag) || seen.has(flag)) throw new Error('Unknown or repeated argument: ' + flag);
    seen.add(flag);
    if (flag === '--check') check = true;
    else {
      target = args[++index];
      if (!target?.trim() || target.startsWith('--')) throw new Error('Missing --target directory');
    }
  }
  if (!target) throw new Error('Pass --target with the generated asset directory');
  return {target, check};
}
