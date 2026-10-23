import { test } from 'node:test';
import assert from 'node:assert/strict';
import { integratedLoudness, createLoudnessMeter } from '../engine/song-loudness.js';

const tone = (sr, seconds, amp = 1) => Float32Array.from({ length: sr * seconds },
  (_, i) => amp * Math.sin(2 * Math.PI * 1000 * i / sr));
const near = (a, b, tolerance = 0.1) => assert.ok(Math.abs(a - b) < tolerance, `${a} vs ${b}`);

test('block metering retains filters and gating across uneven boundaries', () => {
  const x = tone(48000, 2, 0.1);
  for (const size of [127, 4096, 32768]) {
    const meter = createLoudnessMeter(2, 48000);
    for (let at = 0; at < x.length; at += size) meter.push([x.subarray(at, at + size), x.subarray(at, at + size)]);
    assert.equal(meter.read().lufs, integratedLoudness([x, x], 48000));
    near(meter.read().peak, 0.1, 0.00001);
  }
});

test('integrated meter: reference tone and channel count at both export rates', () => {
  for (const sr of [44100, 48000]) {
    const x = tone(sr, 3);
    near(integratedLoudness([x], sr), -3.01);
    near(integratedLoudness([x, x], sr), 0);
    near(integratedLoudness([tone(sr, 3, 0.1)], sr), -23.01);
  }
});

test('integrated meter gates silence and quiet sections without changing input', () => {
  const sr = 48000;
  const x = tone(sr, 4, 0.1);
  const extended = new Float32Array(sr * 12);
  extended.set(x);
  extended.set(tone(sr, 4, 0.0001), sr * 8);
  const before = extended.slice();
  near(integratedLoudness([extended], sr), integratedLoudness([x], sr), 0.2);
  assert.deepEqual(extended, before);
});

test('integrated meter averages audible dynamics instead of taking the loudest window', () => {
  const sr = 48000;
  const x = tone(sr, 8, 0.1);
  x.set(tone(sr, 4, 0.2), sr * 4);
  near(integratedLoudness([x], sr), -3.01 + 10 * Math.log10((0.01 + 0.04) / 2));
});

test('integrated meter returns no reading for silence, sub-gate and short clips', () => {
  assert.equal(integratedLoudness([new Float32Array(48000)], 48000), -Infinity);
  assert.equal(integratedLoudness([tone(48000, 1, 0.00001)], 48000), -Infinity);
  assert.equal(integratedLoudness([new Float32Array(100)], 48000), -Infinity);
  assert.throws(() => integratedLoudness([new Float32Array(1), new Float32Array(2)], 48000));
});
