import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createKit } from '../engine/kit/index.js';

const sr = 44100;
const k = createKit({ sampleRate: sr });

function gainDb(fn, f) {
  const y = fn(k.osc(0.5, f));
  const tail = y.subarray(y.length / 2);
  const rms = Math.sqrt(tail.reduce((a, v) => a + v * v, 0) / tail.length);
  return 20 * Math.log10(rms * Math.SQRT2);
}

const near = (a, b, tol, msg) => assert.ok(Math.abs(a - b) <= tol, `${msg}: ${a.toFixed(2)} dB, wanted ${b}`);

test('lowpass and highpass: -3 dB at cutoff and the right slope', () => {
  near(gainDb((x) => k.filter(x, 'lp', 1000), 1000), -3.01, 0.1, 'lp cutoff');
  near(gainDb((x) => k.filter(x, 'lp', 1000), 100), 0, 0.1, 'lp passband');
  assert.ok(gainDb((x) => k.filter(x, 'lp', 1000), 10000) < -38, 'lp 12 dB/oct');
  near(gainDb((x) => k.filter(x, 'lp', 1000, undefined, { slope: 24 }), 1000), -3.01, 0.15, 'lp24 cutoff');
  assert.ok(gainDb((x) => k.filter(x, 'lp', 1000, undefined, { slope: 24 }), 10000) < -75, 'lp 24 dB/oct');
  near(gainDb((x) => k.filter(x, 'hp', 1000), 1000), -3.01, 0.1, 'hp cutoff');
  assert.ok(gainDb((x) => k.filter(x, 'hp', 1000), 100) < -38, 'hp slope');
});

test('bandpass, notch, peak and shelves', () => {
  near(gainDb((x) => k.filter(x, 'bp', 2000, 4), 2000), 0, 0.1, 'bp center');
  assert.ok(gainDb((x) => k.filter(x, 'bp', 2000, 4), 500) < -20, 'bp skirt');
  assert.ok(gainDb((x) => k.filter(x, 'notch', 2000, 2), 2000) < -40, 'notch');
  const opts = { gain: 6 };
  near(gainDb((x) => k.filter(x, 'peak', 2000, 1, opts), 2000), 6, 0.1, 'peak');
  near(gainDb((x) => k.filter(x, 'lowshelf', 1000, undefined, opts), 60), 6, 0.2, 'low shelf');
  near(gainDb((x) => k.filter(x, 'highshelf', 1000, undefined, opts), 15000), 6, 0.2, 'high shelf');
  assert.throws(() => k.filter(new Float32Array(10), 'peak', 1000, 1, { slope: 24 }));
  assert.throws(() => k.filter(new Float32Array(10), 'comb', 1000));
});

test('svf: flat at res 0.29, rings at high res', () => {
  near(gainDb((x) => k.svf(x, 1000, 1 - Math.SQRT1_2), 1000), -3.01, 0.1, 'svf lp cutoff');
  near(gainDb((x) => k.svf(x, 1000, 1 - Math.SQRT1_2, 'hp'), 1000), -3.01, 0.1, 'svf hp cutoff');
  assert.ok(gainDb((x) => k.svf(x, 1000, 0.9), 1000) > 12, 'resonant peak');
  assert.throws(() => k.svf(new Float32Array(10), 1000, 0.5, 'comb'));
});

test('fast resonant sweeps stay stable', () => {
  const noise = k.noise(1, 'white');
  const sweep = k.curve.lfo(1, 30, 1).map((v) => 1000 * 16 ** v);
  for (const y of [k.svf(noise, sweep, 0.95), k.filter(noise, 'lp', sweep, 8, { slope: 24 })]) {
    assert.ok(y.every((v) => Number.isFinite(v) && Math.abs(v) < 50));
  }
});
