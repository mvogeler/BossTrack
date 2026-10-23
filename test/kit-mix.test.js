import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createKit } from '../engine/kit/index.js';

const sr = 44100;
const k = createKit({ sampleRate: sr });
const near = (a, b, tol, msg) => assert.ok(Math.abs(a - b) <= tol, `${msg}: ${a} vs ${b}`);
const ones = (len) => new Float32Array(len).fill(1);

test('gain, mul, add and fadeOut', () => {
  near(k.gain(ones(4), -6.0206)[0], 0.5, 1e-4, '-6 dB');
  assert.deepEqual([...k.mul(ones(3), Float32Array.from([0, 0.5, 2]))], [0, 0.5, 2]);
  assert.deepEqual([...k.add(ones(2), ones(4))], [2, 2, 1, 1]);
  const f = k.fadeOut(ones(100), 50 / sr);
  assert.equal(f[40], 1);
  assert.equal(f[99], 0);
});

test('stereo pans with equal power, pan can be a curve', () => {
  const [l, r] = k.stereo(ones(3), Float32Array.from([-1, 0, 1]));
  near(l[0], 1, 1e-6, 'hard left');
  near(r[0], 0, 1e-6, 'hard left, right side');
  near(l[1], Math.SQRT1_2, 1e-6, 'center');
  near(l[1] ** 2 + r[1] ** 2, 1, 1e-6, 'center power');
  near(r[2], 1, 1e-6, 'hard right');
});

test('mix places layers by offset, gain and pan', () => {
  const [L, R] = k.mix([
    [ones(100), 0, 0, -1],
    [ones(100), -6.0206, 150 / sr, 1],
    [[ones(10), ones(10)], 0, 0, 1],
  ]);
  assert.equal(L.length, 250);
  near(L[0], 1, 1e-6, 'left layer plus balanced stereo layer');
  near(R[0], Math.SQRT2, 1e-6, 'stereo layer balanced right');
  near(L[50], 1, 1e-6, 'left only');
  near(R[50], 0, 1e-6, 'nothing right');
  near(R[200], 0.5, 1e-4, 'second layer, -6 dB, right');
  assert.equal(L[120], 0);
});
