import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createKit } from '../engine/kit/index.js';

const sr = 44100;

function levelDb(x, freq) {
  let re = 0;
  let im = 0;
  for (let i = 0; i < x.length; i++) {
    re += x[i] * Math.cos((2 * Math.PI * freq * i) / sr);
    im += x[i] * Math.sin((2 * Math.PI * freq * i) / sr);
  }
  return 20 * Math.log10((2 * Math.hypot(re, im)) / x.length);
}

const rms = (x) => Math.sqrt(x.reduce((a, v) => a + v * v, 0) / x.length);
const upCrossings = (x) => x.reduce((c, v, i) => c + (i > 0 && x[i - 1] < 0 && v >= 0 ? 1 : 0), 0);

test('every shape runs at the right frequency and stays in range', () => {
  const k = createKit({ sampleRate: sr });
  for (const type of ['sine', 'tri', 'saw', 'square', 'pulse']) {
    const x = k.osc(1, 220, { type, pw: 0.3 });
    assert.ok(Math.abs(upCrossings(x) - 220) <= 1, `${type}: ${upCrossings(x)} cycles`);
    assert.ok(x.every((v) => Math.abs(v) <= 1.1), type);
  }
  assert.throws(() => k.osc(0.1, 220, { type: 'organ' }));
});

test('polyBLEP saw aliases far less than a naive saw', () => {
  const f = 5000;
  const blep = createKit({ sampleRate: sr }).osc(1, f, { type: 'saw' });
  const naive = Float32Array.from(blep, (_, i) => 2 * ((f * i) / sr % 1) - 1);
  const fund = levelDb(blep, f);
  assert.ok(Math.abs(fund - levelDb(naive, f)) < 1, 'same fundamental');
  assert.ok(levelDb(naive, 900) - levelDb(blep, 900) > 10, 'alias at least 10 dB lower');
});

test('frequency can be a curve', () => {
  const k = createKit({ sampleRate: sr });
  const x = k.osc(1, k.curve.sweep(1, 100, 400, 'lin'));
  assert.ok(Math.abs(upCrossings(x) - 250) <= 1);
});

test('noise colors tilt the right way', () => {
  const k = createKit({ sampleRate: sr, seed: 2 });
  const hf = (x) => rms(x.subarray(1).map((v, i) => v - x[i])) / rms(x);
  const [white, pink, brown, blue] = ['white', 'pink', 'brown', 'blue'].map((c) => k.noise(1, c));
  assert.ok(hf(brown) < hf(pink) && hf(pink) < hf(white) && hf(white) < hf(blue));
  for (const x of [white, pink, brown, blue]) assert.ok(rms(x) > 0.1 && rms(x) < 0.7, `rms ${rms(x)}`);
});

test('crackle density and noise determinism', () => {
  const x = createKit({ sampleRate: sr }).noise(2, 'crackle', { density: 100 });
  const spikes = x.filter((v) => v !== 0).length;
  assert.ok(spikes > 160 && spikes < 240, `spikes ${spikes}`);
  const a = createKit({ sampleRate: sr, seed: 9 });
  const b = createKit({ sampleRate: sr, seed: 9 });
  assert.deepEqual(a.noise(0.1, 'pink'), b.noise(0.1, 'pink'));
  assert.notDeepEqual(a.noise(0.1, 'pink'), a.noise(0.1, 'pink'));
  assert.throws(() => a.noise(0.1, 'purple'));
});

test('click and chirp start loud and die away', () => {
  const k = createKit({ sampleRate: sr });
  const c = k.click({ freq: 3000, noise: 0 });
  assert.equal(c[0], 1);
  assert.ok(Math.abs(c[c.length - 1]) < 0.01);
  const ch = k.chirp(0.05, 4000, 800);
  assert.equal(ch.length, k.n(0.05));
  assert.ok(rms(ch.subarray(0, 200)) > 10 * rms(ch.subarray(-200)));
});
