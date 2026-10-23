import fs from 'node:fs/promises';
import path from 'node:path';
import { checkName } from './paths.js';

const jobs = new Map(), owners = new WeakMap();
let nextId = 0;
function job(sender, id) {
  const value = jobs.get(id);
  if (!value || value.sender !== sender) throw new Error('Stem export is no longer open');
  return value;
}
export async function beginStems(sender, root, names) {
  if (!Array.isArray(names) || !names.length || names.length > 8 || new Set(names).size !== names.length || names.some(n => !checkName(n).endsWith('.wav'))) throw new Error('Invalid stem names');
  let owner = owners.get(sender);
  if (!owner) {
    owner = { closed: !!sender.isDestroyed?.() }; owners.set(sender, owner);
    sender.once('destroyed', () => {
      owner.closed = true;
      for (const [key, value] of jobs) if (value.sender === sender && !value.finishing) abortStems(sender, key).catch(console.error);
    });
  }
  if (owner.closed) throw new Error('Stem export window is closed');
  await fs.mkdir(root, { recursive: true });
  const dir = await fs.mkdtemp(path.join(root, '.stems-')), id = ++nextId;
  const value = { sender, owner, root, dir, files: new Map() };
  try {
    for (const name of names) {
      if (owner.closed) throw new Error('Stem export window is closed');
      value.files.set(name, { handle: await fs.open(path.join(dir, name), 'wx'), bytes: 0 });
    }
    if (owner.closed) throw new Error('Stem export window is closed');
  } catch (error) {
    await discard(value); throw error;
  }
  jobs.set(id, value);
  return id;
}
export async function appendStem(sender, id, name, bytes) {
  const file = job(sender, id).files.get(name);
  if (!file || !file.handle || !(bytes instanceof Uint8Array) || bytes.length > 1048576) throw new Error('Invalid stem chunk');
  await file.handle.writeFile(bytes); file.bytes += bytes.length;
}
export async function finishStems(sender, id) {
  const value = job(sender, id);
  value.finishing = true;
  try {
    if ([...value.files.values()].some(file => file.bytes < 44)) throw new Error('Stem export is incomplete');
    let alignment;
    for (const [name, file] of value.files) {
      const handle = await fs.open(path.join(value.dir, name), 'r'), header = Buffer.alloc(256);
      try { await handle.read(header, 0, header.length, 0); } finally { await handle.close(); }
      if (header.toString('ascii', 0, 4) !== 'RIFF' || header.toString('ascii', 8, 12) !== 'WAVE' || header.readUInt32LE(4) + 8 !== file.bytes) throw new Error('Invalid stem WAV');
      let at = 12, format, data, loop = '';
      while (at + 8 <= header.length) {
        const tag = header.toString('ascii', at, at + 4), size = header.readUInt32LE(at + 4);
        if (tag === 'fmt ') format = header.subarray(at + 8, at + 24).toString('hex');
        if (tag === 'smpl') loop = header.subarray(at + 8, at + 8 + size).toString('hex');
        if (tag === 'data') { data = size; if (at + 8 + size + (size & 1) !== file.bytes) throw new Error('Incomplete stem WAV'); break; }
        at += 8 + size + (size & 1);
      }
      if (!format || data === undefined) throw new Error('Invalid stem WAV');
      const current = format + ':' + data + ':' + loop;
      if (alignment !== undefined && current !== alignment) throw new Error('Stem timing differs');
      alignment = current;
    }
    for (const file of value.files.values()) { await file.handle.close(); file.handle = null; }
    let n = 1, target, reservation;
    while (true) {
      if (value.owner.closed) throw new Error('Stem export window is closed');
      target = path.join(value.root, 'stems_' + String(n++).padStart(3, '0'));
      if (await fs.access(target).then(() => true, () => false)) continue;
      try { reservation = await fs.open(target + '.reserve', 'wx'); break; }
      catch (error) { if (error.code !== 'EEXIST') throw error; }
    }
    try {
      if (value.owner.closed) throw new Error('Stem export window is closed');
      await fs.rename(value.dir, target);
    }
    finally { await reservation.close(); await fs.unlink(target + '.reserve'); }
    jobs.delete(id);
    return target;
  } finally {
    value.finishing = false;
    if (value.owner.closed && jobs.has(id)) await abortStems(sender, id);
  }
}
export async function abortStems(sender, id) {
  const value = job(sender, id); jobs.delete(id);
  await discard(value);
}
async function discard(value) {
  for (const [name, file] of value.files) {
    if (file.handle) await file.handle.close();
    await fs.unlink(path.join(value.dir, name));
  }
  await fs.rmdir(value.dir);
}
