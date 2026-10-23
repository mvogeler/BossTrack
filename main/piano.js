import fs from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { INSTRUMENTS } from '../engine/song-instruments.js';

const cacheFolder = (id) => new URL('../../assets/' + INSTRUMENTS[id].cache + '/', import.meta.url);

export async function loadPiano(notes, id) {
  const instrument = INSTRUMENTS[id];
  if (!instrument?.sample) throw new Error('Unknown sampled instrument');
  const folder = cacheFolder(id);
  if (!Array.isArray(notes) || notes.length > 128 || notes.some((n) => !Number.isInteger(n) || n < instrument.range[0] || n > instrument.range[1])) {
    throw new Error(instrument.name + ' range is MIDI ' + instrument.range.join('–'));
  }
  let manifest;
  try { manifest = JSON.parse(await fs.readFile(new URL('manifest.json', folder), 'utf8')); }
  catch (err) {
    if (err.code !== 'ENOENT') throw err;
    throw new Error(instrument.name + ' cache is missing');
  }
  if (instrument.defaultArticulation) manifest.samples = manifest.samples.filter(s => s.articulation === instrument.defaultArticulation);
  const groups = [...new Set(manifest.samples.map(s => (s.articulation ?? '') + '/' + (s.velocity ?? '')))];
  const roots = new Set();
  for (const group of groups) {
    const layer = manifest.samples.filter(s => (s.articulation ?? '') + '/' + (s.velocity ?? '') === group);
    for (const midi of notes) roots.add(layer.reduce((best, s) => Math.abs(s.root - midi) < Math.abs(best.root - midi) ? s : best).root);
  }
  return Promise.all(manifest.samples.filter((s) => roots.has(s.root)).map(async (s) => {
    const bytes = await fs.readFile(new URL(s.file ?? s.root + '.f32', folder));
    const pcm = new Float32Array(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength));
    return { instrument: id, root: s.root,
      ...(s.articulation === undefined ? {} : { articulation: s.articulation, velocity: s.velocity, take: s.take }), ...(s.release === undefined ? {} : { release: s.release }), sampleRate: manifest.sampleRate, loop: s.loop,
      channels: Array.from({ length: s.channels }, (_, c) => pcm.slice(c * s.frames, (c + 1) * s.frames)) };
  }));
}

export const hasCache = id => fs.access(new URL('manifest.json', cacheFolder(id))).then(() => true, () => false);

export async function pianoIdentity(id) {
  if (!INSTRUMENTS[id]?.sample) throw new Error('Unknown sampled instrument');
  const folder = cacheFolder(id);
  const manifest = await fs.readFile(new URL('manifest.json', folder));
  const hash = createHash('sha256').update(manifest);
  for (const sample of JSON.parse(manifest).samples) hash.update(await fs.readFile(new URL(sample.file ?? sample.root + '.f32', folder)));
  return hash.digest('hex');
}
