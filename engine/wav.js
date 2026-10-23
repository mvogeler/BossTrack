import { createRng } from './rng.js';

const PCM = 1;
const FLOAT = 3;

export function encodeWav(channels, sampleRate, { bitDepth = 16, loop = null, ditherSeed = 1, ditherRng = null } = {}) {
  if (![16, 24, 32].includes(bitDepth)) throw new Error(`Unsupported bit depth: ${bitDepth}`);
  const numCh = channels.length;
  const frames = channels[0].length;
  if (loop && loop.end !== frames) throw new Error(`Loop end ${loop.end} must be the buffer length ${frames}`);
  const bytes = bitDepth / 8;
  const float = bitDepth === 32;
  const fmtSize = float ? 18 : 16;
  const total = frames + (loop ? 1 : 0);
  const dataSize = total * numCh * bytes;
  const pad = dataSize & 1;
  const riffSize = 4 + (8 + fmtSize) + (float ? 12 : 0) + (loop ? 68 : 0) + 8 + dataSize + pad;

  const view = new DataView(new ArrayBuffer(8 + riffSize));
  let p = 0;
  const tag = (s) => {
    for (let i = 0; i < 4; i++) view.setUint8(p++, s.charCodeAt(i));
  };
  const u16 = (x) => {
    view.setUint16(p, x, true);
    p += 2;
  };
  const u32 = (x) => {
    view.setUint32(p, x, true);
    p += 4;
  };

  tag('RIFF');
  u32(riffSize);
  tag('WAVE');

  tag('fmt ');
  u32(fmtSize);
  u16(float ? FLOAT : PCM);
  u16(numCh);
  u32(sampleRate);
  u32(sampleRate * numCh * bytes);
  u16(numCh * bytes);
  u16(bitDepth);
  if (float) {
    u16(0);
    tag('fact');
    u32(4);
    u32(total);
  }

  if (loop) {
    tag('smpl');
    u32(60);
    for (const x of [0, 0, Math.round(1e9 / sampleRate), 60, 0, 0, 0]) u32(x);
    u32(1);
    u32(0);
    for (const x of [0, 0, loop.start, loop.end, 0, 0]) u32(x);
  }

  tag('data');
  u32(dataSize);
  const dataAt = p;
  const rng = ditherRng ?? createRng(ditherSeed);
  for (let i = 0; i < frames; i++) {
    for (let c = 0; c < numCh; c++) {
      const x = Math.max(-1, Math.min(1, channels[c][i]));
      if (float) {
        view.setFloat32(p, x, true);
      } else if (bitDepth === 16) {
        const s = x === 0 ? 0 : Math.round(x * 32767 + rng.next() - rng.next());
        view.setInt16(p, Math.max(-32768, Math.min(32767, s)), true);
      } else {
        const s = Math.round(x * 8388607);
        view.setUint8(p, s & 0xff);
        view.setUint8(p + 1, (s >> 8) & 0xff);
        view.setUint8(p + 2, (s >> 16) & 0xff);
      }
      p += bytes;
    }
  }
  const out = new Uint8Array(view.buffer);
  if (loop) {
    const align = numCh * bytes;
    out.copyWithin(p, dataAt + loop.start * align, dataAt + (loop.start + 1) * align);
  }

  return out;
}

export function* encodeWavChunks(channels, sampleRate, { bitDepth = 16, loop = null, ditherSeed = 1, gain = 1 } = {}) {
  if (!Number.isFinite(gain) || gain < 0) throw new Error('Invalid WAV gain');
  const frames = channels[0].length;
  if (loop && loop.end !== frames) throw new Error('Loop end must be the buffer length');
  const align = channels.length * bitDepth / 8;
  const dummy = encodeWav(channels.map(() => new Float32Array(loop ? 1 : 0)), sampleRate, { bitDepth, loop: loop ? { start: 0, end: 1 } : null });
  const view = new DataView(dummy.buffer);
  let at = 12, dataAt;
  while (at < dummy.length) {
    const tag = String.fromCharCode(...dummy.subarray(at, at + 4));
    const size = view.getUint32(at + 4, true);
    if (tag === 'fact') view.setUint32(at + 8, frames + (loop ? 1 : 0), true);
    if (tag === 'smpl') { view.setUint32(at + 52, loop.start, true); view.setUint32(at + 56, loop.end, true); }
    if (tag === 'data') { dataAt = at + 8; break; }
    at += 8 + size + (size & 1);
  }
  const dataSize = (frames + (loop ? 1 : 0)) * align;
  view.setUint32(4, dataAt - 8 + dataSize + (dataSize & 1), true);
  view.setUint32(dataAt - 4, dataSize, true);
  yield dummy.subarray(0, dataAt);
  const rng = createRng(ditherSeed);
  const headerSize = bitDepth === 32 ? 58 : 44;
  let guard;
  for (let start = 0; start < frames; start += 65536) {
    const end = Math.min(frames, start + 65536);
    const block = encodeWav(channels.map(ch => gain === 1 ? ch.subarray(start, end) : ch.subarray(start, end).map(value => value * gain)), sampleRate, { bitDepth, ditherRng: rng });
    const data = block.subarray(headerSize, headerSize + (end - start) * align);
    if (loop && loop.start >= start && loop.start < end) guard = data.slice((loop.start - start) * align, (loop.start - start + 1) * align);
    yield data;
  }
  if (loop) yield guard;
  if (dataSize & 1) yield new Uint8Array(1);
}

export async function* encodeWavStream(read, frames, sampleRate, { bitDepth = 16, loop = null, ditherSeed = 1, gain = 1 } = {}) {
  const shape = [{ length: frames }, { length: frames }];
  const header = encodeWavChunks(shape, sampleRate, { bitDepth, loop, gain }).next().value;
  yield header;
  const rng = createRng(ditherSeed);
  const align = 2 * bitDepth / 8;
  const headerSize = bitDepth === 32 ? 58 : 44;
  let guard;
  for (let at = 0; at < frames; at += 65536) {
    const size = Math.min(65536, frames - at);
    const channels = await read(at, size);
    if (channels.length !== 2 || channels.some(ch => ch.length !== size)) throw new Error('Incomplete stereo audio block');
    const encoded = encodeWav(gain === 1 ? channels : channels.map(ch => ch.map(x => x * gain)), sampleRate, { bitDepth, ditherRng: rng });
    const data = encoded.subarray(headerSize, headerSize + size * align);
    if (loop && loop.start >= at && loop.start < at + size) guard = data.slice((loop.start - at) * align, (loop.start - at + 1) * align);
    yield data;
  }
  if (loop) yield guard;
}
