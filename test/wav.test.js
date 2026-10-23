import { test } from 'node:test';
import assert from 'node:assert/strict';
import { encodeWav } from '../engine/wav.js';

function readWav(bytes) {
  const v = new DataView(bytes.buffer);
  const tag = (p) => String.fromCharCode(...bytes.subarray(p, p + 4));
  assert.equal(tag(0), 'RIFF');
  assert.equal(tag(8), 'WAVE');
  assert.equal(v.getUint32(4, true) + 8, bytes.length);
  const chunks = {};
  for (let p = 12; p < bytes.length; ) {
    const size = v.getUint32(p + 4, true);
    chunks[tag(p)] = { at: p + 8, size };
    p += 8 + size + (size & 1);
  }
  const f = chunks['fmt '].at;
  const fmt = {
    format: v.getUint16(f, true),
    channels: v.getUint16(f + 2, true),
    rate: v.getUint32(f + 4, true),
    byteRate: v.getUint32(f + 8, true),
    align: v.getUint16(f + 12, true),
    bits: v.getUint16(f + 14, true),
  };
  const d = chunks.data;
  const n = d.size / (fmt.bits / 8);
  const samples = Array.from({ length: n }, (_, i) => {
    const p = d.at + i * (fmt.bits / 8);
    if (fmt.bits === 16) return v.getInt16(p, true) / 32767;
    if (fmt.bits === 32) return v.getFloat32(p, true);
    return ((v.getUint8(p + 2) << 24) | (v.getUint8(p + 1) << 16) | (v.getUint8(p) << 8)) / 256 / 8388607;
  });
  return { fmt, chunks, samples, view: v };
}

const ramp = (n) => Float32Array.from({ length: n }, (_, i) => Math.sin(i * 0.37) * 0.8);

test('16-bit stereo header and interleaving', () => {
  const l = ramp(100);
  const r = l.map((x) => -x);
  const w = readWav(encodeWav([l, r], 44100));
  assert.deepEqual(w.fmt, { format: 1, channels: 2, rate: 44100, byteRate: 176400, align: 4, bits: 16 });
  assert.equal(w.samples.length, 200);
  for (let i = 0; i < 100; i++) {
    assert.ok(Math.abs(w.samples[i * 2] - l[i]) <= 1.5 / 32767);
    assert.ok(Math.abs(w.samples[i * 2 + 1] - r[i]) <= 1.5 / 32767);
  }
});

test('24-bit round trip, including negatives and an odd data size', () => {
  const x = ramp(3);
  const w = readWav(encodeWav([x], 48000, { bitDepth: 24 }));
  assert.equal(w.fmt.bits, 24);
  assert.equal(w.chunks.data.size, 9);
  x.forEach((s, i) => assert.ok(Math.abs(w.samples[i] - s) <= 0.5 / 8388607 + 1e-12));
});

test('32-bit float is exact and has a fact chunk', () => {
  const x = ramp(50);
  const w = readWav(encodeWav([x], 48000, { bitDepth: 32 }));
  assert.equal(w.fmt.format, 3);
  assert.equal(w.view.getUint32(w.chunks.fact.at, true), 50);
  x.forEach((s, i) => assert.equal(w.samples[i], s));
});

test('clips out-of-range values and keeps silence silent', () => {
  const w = readWav(encodeWav([Float32Array.from([1.5, -2, 0, 0, 0])], 44100));
  assert.ok(w.samples[0] >= 32766 / 32767 && w.samples[0] <= 1);
  assert.ok(w.samples[1] <= -1);
  assert.deepEqual(w.samples.slice(2), [0, 0, 0]);
});

test('smpl chunk holds the loop points', () => {
  const w = readWav(encodeWav([ramp(1000)], 44100, { loop: { start: 0, end: 1000 } }));
  const s = w.chunks.smpl.at;
  assert.equal(w.chunks.smpl.size, 60);
  assert.equal(w.view.getUint32(s + 28, true), 1);
  assert.equal(w.view.getUint32(s + 44, true), 0);
  assert.equal(w.view.getUint32(s + 48, true), 1000);
  assert.equal(w.samples.length, 1001);
  assert.equal(w.samples[1000], w.samples[0]);
});

function godotLoop(begin, end, count, fixed) {
  const out = [];
  let o = 0;
  while (out.length < count) {
    if (o >= end) o = begin + (o - end);
    for (const stop = fixed ? end - 1 : end; o <= stop && out.length < count; o++) out.push(o);
  }
  return out;
}

test('loop repeats the buffer exactly in Godot, with and without its loop fix', () => {
  const l = ramp(300);
  const r = l.map((x) => x * 0.5);
  const w = readWav(encodeWav([l, r], 44100, { loop: { start: 120, end: 300 } }));
  assert.equal(w.samples.length, 602);
  const s = w.chunks.smpl.at;
  const [begin, end] = [w.view.getUint32(s + 44, true), w.view.getUint32(s + 48, true)];
  const frame = (i) => `${w.samples[i * 2]},${w.samples[i * 2 + 1]}`;
  for (const fixed of [false, true]) {
    const heard = godotLoop(begin, end, 1000, fixed).map(frame);
    heard.forEach((f, i) => assert.equal(f, frame(i < 300 ? i : 120 + ((i - 120) % 180)), `frame ${i}`));
  }
  assert.throws(() => encodeWav([l], 44100, { loop: { start: 0, end: 299 } }));
});

test('same input, same bytes', () => {
  assert.deepEqual(encodeWav([ramp(500)], 44100), encodeWav([ramp(500)], 44100));
});

test('rejects unsupported bit depths', () => {
  assert.throws(() => encodeWav([ramp(10)], 44100, { bitDepth: 8 }));
});
