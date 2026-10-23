import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRng } from '../engine/rng.js';
import { curves } from '../engine/kit/curve.js';
import { filters } from '../engine/kit/filter.js';
import { fmSynth } from '../engine/kit/fm.js';
import { plucks } from '../engine/kit/pluck.js';

const sr = 44100;
const n = (s) => Math.round(s * sr);
const make = (factory, seed = 1) => factory({ sr, n, rng: createRng(seed) });
const near = (a, b, tol, msg) => assert.ok(Math.abs(a - b) <= tol, `${msg}: ${a} vs ${b}`);

const sine = (dur, f) => Float32Array.from({ length: n(dur) }, (_, i) => Math.sin((2 * Math.PI * f * i) / sr));
const rms = (x) => Math.sqrt(x.reduce((a, v) => a + v * v, 0) / x.length);
const upCrossings = (x) => x.reduce((c, v, i) => c + (i > 0 && x[i - 1] < 0 && v >= 0 ? 1 : 0), 0);

function levelDb(x, freq, hann = false) {
  let re = 0;
  let im = 0;
  let wsum = 0;
  for (let i = 0; i < x.length; i++) {
    const w = hann ? 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / x.length) : 1;
    re += w * x[i] * Math.cos((2 * Math.PI * freq * i) / sr);
    im += w * x[i] * Math.sin((2 * Math.PI * freq * i) / sr);
    wsum += w;
  }
  return 20 * Math.log10((2 * Math.hypot(re, im)) / wsum);
}

function peakCents(x, f) {
  const step = 0.5;
  const lv = [];
  for (let c = -40; c <= 40; c += step) lv.push(levelDb(x, f * 2 ** (c / 1200), true));
  const k = lv.indexOf(Math.max(...lv));
  const [a, b, d] = [lv[k - 1], lv[k], lv[k + 1]];
  return -40 + step * (k + (0.5 * (a - d)) / (a - 2 * b + d));
}

function besselJ(k, x) {
  let sum = 0;
  let fact = 1;
  for (let m = 0; m < 30; m++) {
    if (m > 0) fact *= m;
    let kf = 1;
    for (let j = 2; j <= m + k; j++) kf *= j;
    sum += ((-1) ** m * (x / 2) ** (2 * m + k)) / (fact * kf);
  }
  return sum;
}

test('fm puts sidebands at carrier +- k * mod with Bessel levels', () => {
  const k = make(fmSynth);
  const index = 1.5;
  const x = k.fm(1, 1000, { ratio: 0.3, index });
  for (let j = 0; j <= 3; j++) {
    const want = 20 * Math.log10(Math.abs(besselJ(j, index)));
    near(levelDb(x, 1000 + 300 * j), want, 0.2, `upper ${j}`);
    near(levelDb(x, 1000 - 300 * j), want, 0.2, `lower ${j}`);
  }
  assert.ok(levelDb(x, 1150) < -80, 'nothing between sidebands');
});

test('fm with index 0 is a plain sine, and an idle third operator changes nothing', () => {
  const k = make(fmSynth);
  const x = k.fm(0.5, 440, { index: 0 });
  const ref = sine(0.5, 440);
  assert.ok(x.every((v, i) => Math.abs(v - ref[i]) < 1e-4));
  const two = k.fm(0.2, 300, { ratio: 2, index: 2 });
  const three = k.fm(0.2, 300, { ratio: 2, index: 2, ops: [{ ratio: 3, index: 0 }] });
  assert.deepEqual(two, three);
  const stacked = k.fm(0.2, 300, { ratio: 2, index: 2, ops: [{ ratio: 3, index: 2 }] });
  assert.ok(rms(stacked.map((v, i) => v - two[i])) > 0.1);
});

test('fm takes curves and stays bounded with full feedback', () => {
  const k = make(fmSynth);
  const sweep = make(curves).sweep(1, 700, 140);
  const idx = make(curves).sweep(1, 6, 1);
  const x = k.fm(1, sweep, { ratio: 1.41, index: idx, feedback: 1 });
  assert.ok(x.every((v) => Number.isFinite(v) && Math.abs(v) <= 1));
  const plain = k.fm(1, 500, { ratio: 1, index: 1 });
  const fb = k.fm(1, 500, { ratio: 1, index: 1, feedback: 1 });
  assert.ok(levelDb(fb, 2500) > levelDb(plain, 2500) + 10, 'brighter with feedback');
  assert.ok(fb.every((v) => Math.abs(v) <= 1));
  assert.throws(() => k.fm(0.1, 440, { type: 'saw' }));
});

test('fm index backs off before sidebands pass Nyquist', () => {
  const k = make(fmSynth);
  const x = k.fm(1, 3000, { ratio: 1.7, index: 6 });
  assert.ok(levelDb(x, 44100 - 23400) < -28, 'folded sideband');
  assert.ok(levelDb(x, 8100) > -8, 'first sideband still there');
});

test('ring and am land their sidebands at the right levels', () => {
  const k = make(fmSynth);
  const s = sine(1, 1000);
  const r = k.ring(s, 300);
  near(levelDb(r, 700), -6.02, 0.05, 'ring lower');
  near(levelDb(r, 1300), -6.02, 0.05, 'ring upper');
  assert.ok(levelDb(r, 1000) < -80, 'ring removes the carrier');
  near(levelDb(k.ring(s, 300, 0.5), 1000), -6.02, 0.05, 'half mix keeps half the carrier');
  const a = k.am(s, 100, 1);
  near(levelDb(a, 1000), -6.02, 0.05, 'am carrier');
  near(levelDb(a, 900), -12.04, 0.05, 'am lower');
  near(levelDb(a, 1100), -12.04, 0.05, 'am upper');
});

test('tremolo swings between 1 and 1 - depth without clicks', () => {
  const k = make(fmSynth);
  const ones = new Float32Array(n(1)).fill(1);
  const t = k.tremolo(ones, 4, 0.5);
  near(t[0], 1, 1e-3, 'starts at full level');
  near(Math.min(...t), 0.5, 1e-3, 'bottom');
  const sq = k.tremolo(ones, 10, 1, 'square');
  near(Math.min(...sq), 0, 1e-3, 'square bottom');
  assert.ok(sq.every((v, i) => i === 0 || Math.abs(v - sq[i - 1]) < 0.02), 'edges softened');
});

test('vibrato swings pitch by the asked cents and keeps time', () => {
  const k = make(fmSynth);
  const x = k.vibrato(sine(1, 2000), 5, 100);
  assert.equal(x.length, n(1));
  const times = [];
  for (let i = 1; i < x.length; i++) {
    if (x[i - 1] < 0 && x[i] >= 0) times.push(i - 1 + x[i - 1] / (x[i - 1] - x[i]));
  }
  const cents = times.slice(1).map((t, i) => 1200 * Math.log2(sr / (t - times[i]) / 2000));
  near(Math.max(...cents), 100, 3, 'up');
  near(Math.min(...cents), -100, 3, 'down');
  assert.ok(Math.abs(upCrossings(x) - 2000) <= 1);
});

test('pitchEnv +1200 cents doubles the frequency and halves the length', () => {
  const k = make(fmSynth);
  const up = k.pitchEnv(sine(1, 440), 1200);
  near(up.length, sr / 2, 1, 'length');
  near(upCrossings(up), 440, 1, 'cycles');
  near(levelDb(up, 880), 0, 0.1, 'level');
  const down = k.pitchEnv(sine(0.5, 440), -1200);
  near(down.length, sr, 1, 'down length');
  near(levelDb(down, 220), 0, 0.1, 'down level');
  const bend = make(curves).sweep(1, 0.001, 1200, 'lin');
  const len = k.pitchEnv(sine(1, 440), bend).length;
  assert.ok(len > sr / 2 && len < sr);
});

test('chorus is stereo, decorrelated, and dry at mix 0', () => {
  const k = make(fmSynth);
  const r = createRng(5);
  const x = Float32Array.from({ length: n(1) }, () => r.range(-1, 1));
  const [L, R] = k.chorus(x, { voices: 3, mix: 1 });
  assert.equal(L.length, R.length);
  assert.ok(L.length > x.length);
  const corr = L.reduce((a, v, i) => a + v * R[i], 0) / Math.sqrt(L.reduce((a, v) => a + v * v, 0) * R.reduce((a, v) => a + v * v, 0));
  assert.ok(Math.abs(corr) < 0.5, `corr ${corr}`);
  const [dl, drr] = k.chorus(x, { mix: 0 });
  assert.ok(x.every((v, i) => dl[i] === v && drr[i] === v));
});

test('crush quantizes and holds', () => {
  const k = make(fmSynth);
  const c = k.crush(sine(0.1, 330), 3, 4);
  assert.ok(c.every((v) => Number.isInteger(v * 4)), 'steps of 1/4');
  assert.ok(new Set(c).size <= 9);
  for (let i = 0; i + 3 < c.length; i += 4) assert.ok(c[i] === c[i + 1] && c[i] === c[i + 3]);
});

test('pluck is in tune within 5 cents', () => {
  for (const f of [110, 440, 1760]) {
    const x = make(plucks).pluck(1.2, f, { damping: 0.1, brightness: 0.8 });
    const off = peakCents(x.subarray(n(0.1), n(1.1)), f);
    assert.ok(Math.abs(off) < 5, `${f} Hz off by ${off.toFixed(2)} cents`);
  }
  assert.ok(Math.abs(peakCents(sine(1, 440), 440)) < 0.1, 'the measurement itself is unbiased');
});

test('pluck damping shortens it and output peaks at 1', () => {
  const p = make(plucks);
  const tailRms = (x) => rms(x.subarray(n(0.4), n(0.5)));
  const loose = p.pluck(0.5, 220, { damping: 0.1 });
  const tight = p.pluck(0.5, 220, { damping: 0.9 });
  assert.ok(tailRms(loose) > 100 * tailRms(tight));
  near(Math.max(...loose.map(Math.abs)), 1, 1e-6, 'peak');
  assert.notDeepEqual(p.pluck(0.1, 220), p.pluck(0.1, 220), 'each call gets fresh noise');
  assert.deepEqual(make(plucks).pluck(0.1, 220), make(plucks).pluck(0.1, 220), 'deterministic');
});

test('split sums back flat and crosses at -6 dB', () => {
  const imp = new Float32Array(16384);
  imp[0] = 1;
  const [low, high] = make(plucks).split(imp, 1000);
  const sum = low.map((v, i) => v + high[i]);
  const mag = (x, f) => levelDb(x, f) + 20 * Math.log10(x.length / 2);
  for (let f = 20; f < 20000; f *= 1.25) near(mag(sum, f), 0, 0.1, `${f.toFixed(0)} Hz`);
  near(mag(low, 1000), -6.02, 0.05, 'low at crossover');
  near(mag(high, 1000), -6.02, 0.05, 'high at crossover');
  assert.ok(mag(low, 4000) < -40 && mag(high, 250) < -40, 'slopes');
});

test('dispersion keeps the energy and makes the lows arrive later', () => {
  const imp = new Float32Array(100);
  imp[0] = 1;
  const y = make(plucks).dispersion(imp, { stages: 32, freq: 800 });
  near(y.reduce((a, v) => a + v * v, 0), 1, 0.01, 'allpass energy');
  const { filter } = filters({ sr });
  const centroid = (x) => x.reduce((a, v, i) => a + i * v * v, 0) / x.reduce((a, v) => a + v * v, 0);
  assert.ok(centroid(filter(y, 'lp', 200)) > centroid(filter(y, 'hp', 6000)) + 200);
});

test('lfo dropout zeroes about that share of s&h steps', () => {
  const lfo = (...a) => make(curves, 3).lfo(...a);
  const x = lfo(10, 100, 1, 'sh', 0, { dropout: 0.25 });
  let zeros = 0;
  for (let i = 0; i < x.length; i += 441) zeros += x[i] === 0 ? 1 : 0;
  near(zeros, 250, 45, 'dropped steps out of 1000');
  assert.deepEqual(lfo(1, 10, 1, 'sh'), lfo(1, 10, 1, 'sh', 0, { dropout: 0 }), 'off means unchanged');
  const sq = lfo(1, 20, 1, 'square', 0, { dropout: 0.5 });
  assert.ok(sq.some((v) => v === 0) && sq.some((v) => v === 1));
});
