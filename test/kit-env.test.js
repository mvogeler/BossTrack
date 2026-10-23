import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createKit } from '../engine/kit/index.js';

const sr = 1000;
const near = (a, b, tol, msg) => assert.ok(Math.abs(a - b) <= tol, `${msg}: ${a} vs ${b}`);

test('buffer sizes follow the sample rate', () => {
  const k = createKit({ sampleRate: sr });
  assert.equal(k.n(0.0304), 30);
  assert.equal(k.buf(0.5).length, 500);
});

test('perc peaks after the attack and is at -60 dB after the decay', () => {
  const e = createKit({ sampleRate: sr }).env.perc(1, 0.01, 0.5);
  assert.equal(e[0], 0);
  near(e[10], 1, 1e-6, 'peak');
  near(e[510], 0.001, 1e-4, '-60 dB');
});

test('adsr sustains, then releases to zero at the end', () => {
  const e = createKit({ sampleRate: sr }).env.adsr(1, 0.05, 0.1, 0.5, 0.2);
  near(e[50], 1, 0.03, 'peak');
  near(e[400], 0.5, 1e-3, 'sustain');
  near(e[e.length - 1], 0, 0.01, 'end');
  assert.ok(e.every((x) => x >= 0 && x <= 1));
});

test('points passes through its breakpoints and holds outside them', () => {
  const e = createKit({ sampleRate: sr }).env.points(1, [[0.1, 0], [0.3, 1], [0.6, 0.25]]);
  assert.equal(e[0], 0);
  near(e[200], 0.5, 1e-6, 'halfway up');
  near(e[300], 1, 1e-6, 'second point');
  near(e[600], 0.25, 1e-6, 'third point');
  assert.equal(e[999], 0.25);
});

test('sweep hits both ends, exp midpoint is the geometric mean', () => {
  const c = createKit({ sampleRate: sr }).curve;
  const s = c.sweep(1.001, 100, 10000);
  near(s[0], 100, 1e-3, 'start');
  near(s[s.length - 1], 10000, 1e-2, 'end');
  near(s[500], 1000, 1, 'midpoint');
  near(c.sweep(1.001, 0, 10, 'lin')[500], 5, 1e-6, 'linear midpoint');
});

test('lfo shapes and rate curves', () => {
  const c = createKit({ sampleRate: sr }).curve;
  const sine = c.lfo(1, 10, 2);
  near(sine[25], 2, 1e-6, 'sine quarter cycle');
  near(c.lfo(1, 10, 1, 'tri')[25], 1, 1e-6, 'tri peak');
  near(c.lfo(0.1, new Float32Array(100).fill(20), 1, 'saw')[25], 0, 1e-6, 'saw midpoint');
  const sh = c.lfo(1, 10, 1, 'sh');
  assert.ok(sh.subarray(0, 100).every((x) => x === sh[0]));
  assert.notEqual(sh[150], sh[50]);
  assert.throws(() => c.lfo(1, 10, 1, 'wobble'));
});

test('random curves repeat for the same seed and stay in range', () => {
  const a = createKit({ sampleRate: sr, seed: 4 }).curve.jitter(2, 3, 0.5);
  const b = createKit({ sampleRate: sr, seed: 4 }).curve.jitter(2, 3, 0.5);
  assert.deepEqual(a, b);
  assert.ok(a.every((x) => Math.abs(x) <= 0.5));
  assert.notDeepEqual(a, createKit({ sampleRate: sr, seed: 5 }).curve.jitter(2, 3, 0.5));
});
