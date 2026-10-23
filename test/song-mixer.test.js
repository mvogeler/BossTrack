import test from 'node:test';
import assert from 'node:assert/strict';
import { mixParts } from '../engine/song-render.js';
import { validMix, mixPeakGain, MIX_CEILING, captureMixPreset, applyMixPreset, validMixPreset } from '../engine/song-mixer.js';

const parts = [{ id: 'keys', channels: [Float32Array.of(.5, -.4), Float32Array.of(.2, -.3)] },
  { id: 'bass', channels: [Float32Array.of(.3, .2), Float32Array.of(.3, .2)] }];

test('boost and pan act on each part before shared peak protection', () => {
  const original = structuredClone(parts);
  const mix = { gains: { keys: 2, bass: .5 }, pans: { keys: -1 }, muted: [], solo: [] };
  const channels = mixParts(parts, mix);
  assert.ok(Math.abs(channels[0][0] - 1.15) < 1e-6);
  assert.ok(Math.abs(channels[1][0] - .15) < 1e-6);
  const peak = Math.max(...channels.flatMap(ch => [...ch].map(Math.abs)));
  const gain = mixPeakGain(peak);
  assert.ok(gain < 1);
  assert.ok(Math.abs(peak * gain - MIX_CEILING) < 1e-9);
  assert.equal(mixPeakGain(.5), 1);
  assert.equal(mixPeakGain(0), 1);
  assert.deepEqual(parts, original);
  const solo = mixParts(parts, { ...mix, solo: ['keys'], muted: ['keys'] });
  assert.ok(solo.every(ch => ch.every(x => x === 0)));
});

test('mix validation accepts old saves and rejects invalid boosts, pans and part ids', () => {
  const mix = { muted: [], solo: [], gains: { keys: 2 }, pans: { keys: -.6 } };
  assert.equal(validMix(mix, ['keys']), true);
  assert.equal(validMix({ muted: [], solo: [], gains: {} }, ['keys']), true);
  for (const bad of [{ gains: { keys: 2.01 } }, { gains: { keys: -1 } }, { pans: { keys: 1.01 } },
    { pans: { keys: NaN } }, { pans: [] }, { gains: { missing: .5 } }]) assert.equal(validMix({ ...mix, ...bad }, ['keys']), false);
});

test('balance presets match repeated parts in order and respect mix locks', () => {
  const song = { tracks: [{ id: 'keys' }, { id: 'keys-2', part: 'keys' }, { id: 'bass' }] };
  const mix = { muted: ['bass'], solo: [], gains: { keys: 1.8, 'keys-2': .6 }, pans: { keys: -.5, 'keys-2': .4 } };
  const preset = captureMixPreset(song, mix, '  Lead forward  ');
  assert.equal(preset.name, 'Lead forward');
  const target = { tracks: [{ id: 'keys-3', part: 'keys' }, { id: 'keys-4', part: 'keys' }, { id: 'pad' }] };
  const next = applyMixPreset(target, { muted: [], solo: [], gains: { 'keys-4': 1.2 }, pans: {} }, preset, { 'keys-4': { mix: true } });
  assert.equal(next.gains['keys-3'], 1.8); assert.equal(next.pans['keys-3'], -.5);
  assert.equal(next.gains['keys-4'], 1.2); assert.equal(next.pans['keys-4'], undefined);
  assert.equal(next.gains.pad, undefined);
  assert.equal(validMixPreset({ ...preset, parts: [{ part: 'keys', gain: Infinity, pan: 0 }] }), false);
  assert.throws(() => captureMixPreset(song, mix, ''), /preset/);
});
