import path from 'node:path';

const NAME = /^[a-z0-9][a-z0-9_\- .]*\.wav$/i;

export function isInside(folder, root) {
  const rel = path.relative(root, folder);
  return rel === '' || (!rel.startsWith('..') && !path.isAbsolute(rel));
}

export function checkName(name) {
  if (typeof name !== 'string' || path.basename(name) !== name || !NAME.test(name)) {
    throw new Error(`Bad file name: ${name}`);
  }
  return name;
}
