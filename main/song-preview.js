import { validMix } from '../engine/song-mixer.js';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { mixParts } from '../engine/song-render.js';
import { normalizePreviewBlock } from '../engine/song-cache-mix.js';

const caches = new Map(), owners = new WeakMap();
let nextId = 0;
const BLOCK = 65536;
function cache(sender, id) {
  const value = caches.get(id);
  if (!value || value.sender !== sender) throw new Error('Preview is no longer available');
  return value;
}

async function discard(value) {
  await Promise.all([...value.parts.values()].map(p => p.handle.close()));
  await fs.rm(value.dir, { recursive: true });
}

function owner(sender) {
  if (!owners.has(sender)) {
    const value = { closed: sender.isDestroyed?.() ?? false };
    owners.set(sender, value);
    sender.once('destroyed', () => {
      value.closed = true;
      for (const [key, item] of caches) if (item.sender === sender) releasePreview(sender, key).catch(console.error);
    });
  }
  return owners.get(sender);
}

export async function beginPreview(sender, meta) {
  const state = owner(sender);
  if (state.closed) throw new Error('Preview window is closed');
  const { frames, sampleRate, loop, parts } = meta;
  if (!Number.isInteger(frames) || frames < 1 || frames > 28800000 ||
      ![44100, 48000].includes(sampleRate) || !Array.isArray(parts) || parts.length > 8 ||
      parts.some(p => typeof p.id !== 'string') || new Set(parts.map(p => p.id)).size !== parts.length ||
      (loop && (loop.start !== 0 || loop.end !== frames))) throw new Error('Invalid preview layout');
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'bosstrack-preview-'));
  const id = ++nextId;
  const value = { sender, dir, frames, sampleRate, loop, parts: new Map(), ready: false, gain: 1 };
  try {
    for (const [index, part] of parts.entries()) {
      const handle = await fs.open(path.join(dir, index + '.pcm'), 'w+');
      value.parts.set(part.id, { handle, written: 0 });
    }
    if (state.closed) throw new Error('Preview window is closed');
  } catch (err) { await discard(value); throw err; }
  caches.set(id, value);
  return id;
}

export async function appendPreview(sender, id, partId, start, channels) {
  const value = cache(sender, id), part = value.parts.get(partId);
  if (value.ready || !part || start !== part.written || !Array.isArray(channels) || channels.length !== 2 ||
      channels.some(ch => !(ch instanceof Float32Array)) || channels[0].length !== channels[1].length ||
      channels[0].length < 1 || channels[0].length > BLOCK || start + channels[0].length > value.frames)
    throw new Error('Invalid preview block');
  const pcm = new Float32Array(channels[0].length * 2);
  for (let i = 0; i < channels[0].length; i++) { pcm[i * 2] = channels[0][i]; pcm[i * 2 + 1] = channels[1][i]; }
  const bytes = Buffer.from(pcm.buffer);
  let written = 0;
  while (written < bytes.length) written += (await part.handle.write(bytes, written, bytes.length - written, start * 8 + written)).bytesWritten;
  part.written += channels[0].length;
}

export function finishPreview(sender, id, { gain = 1 } = {}) {
  const value = cache(sender, id);
  if (value.ready || [...value.parts.values()].some(p => p.written !== value.frames) ||
      !Number.isFinite(gain) || gain < 0 || gain > 1) throw new Error('Preview is incomplete');
  value.gain = gain;
  value.ready = true;
}

export async function readPreview(sender, id, start, count, mix = {}, partId = null) {
  const value = cache(sender, id);
  if (!value.ready || !Number.isInteger(start) || !Number.isInteger(count) || start < 0 || count < 1 ||
      count > BLOCK || start + count > value.frames || (partId !== null && !value.parts.has(partId)))
    throw new Error('Invalid preview read');
  const { muted = [], solo = [], gains = {}, pans = {} } = mix;
  if (!validMix({ muted, solo, gains, pans }, [...value.parts.keys()])) throw new Error('Invalid preview mix');
  const parts = [];
  const bytes = Buffer.alloc(count * 8);
  const pcm = new Float32Array(bytes.buffer, bytes.byteOffset, count * 2);
  for (const [key, part] of value.parts) {
    if (partId === null ? muted.includes(key) || (solo.length && !solo.includes(key)) : key !== partId) continue;
    let read = 0;
    while (read < bytes.length) {
      const result = await part.handle.read(bytes, read, bytes.length - read, start * 8 + read);
      if (!result.bytesRead) throw new Error('Preview audio is incomplete');
      read += result.bytesRead;
    }
    parts.push({ id: key, channels: normalizePreviewBlock(pcm, start, value) });
  }
  return partId === null ? mixParts(parts, mix, count) : parts[0].channels;
}

export async function releasePreview(sender, id) {
  const value = cache(sender, id);
  caches.delete(id);
  await discard(value);
}
