import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createSongEffects, effectFrames, validEffects } from '../engine/song-effects.js';
import { renderSong, renderSongBlocks, mixParts } from '../engine/song-render.js';

const effects = { delay: { mix: 0.4, beats: 0.375, feedback: 0.55, damp: 0.4 },
  reverb: { mix: 0.3, size: 0.7, damp: 0.5 }, crush: { mix: 0.3, bits: 9, rate: 3 } };
const score = form => ({ v: 1, tempo: 180, ppq: 960, bars: 1, form,
  output: { sampleRate: 44100, bitDepth: 24 }, tracks: [{ id: 'keys', instrument: 'chip', seed: 7,
    effects, notes: [{ id: 'one', tick: 3200, len: 400, midi: 72, vel: 0.4 }] }] });

test('effects reject unknown fields, missing settings and out-of-range values', () => {
  assert.ok(validEffects(effects));
  assert.ok(validEffects({}));
  for (const value of [null, [], { chorus: {} }, { delay: { mix: 1 } },
    { crush: { ...effects.crush, rate: 1.5 } }, { delay: { ...effects.delay, feedback: 0.8 } },
    { reverb: { ...effects.reverb, mix: NaN } }]) assert.equal(validEffects(value), false);
});

test('DSP blocks preserve held samples, feedback and diffusion without block-size dependence', () => {
  const input = [new Float32Array(12000), new Float32Array(12000)];
  input[0][0] = 0.7;
  const expected = input.map(ch => ch.slice());
  createSongEffects(effects, 1000, 120)(expected);
  const process = createSongEffects(effects, 1000, 120);
  const actual = input.map(ch => new Float32Array(ch.length));
  for (let at = 0; at < input[0].length; at += 37) {
    const block = input.map(ch => ch.slice(at, at + 37));
    process(block);
    block.forEach((ch, c) => actual[c].set(ch, at));
  }
  assert.deepEqual(actual, expected);
  assert.ok(actual[1].some(value => value !== 0));
  assert.ok(actual.every(ch => ch.every(Number.isFinite)));
  const dry = input.map(ch => ch.slice());
  createSongEffects({ ...effects, delay: { ...effects.delay, mix: 0 }, reverb: { ...effects.reverb, mix: 0 }, crush: { ...effects.crush, mix: 0 } }, 1000, 120)(dry);
  assert.deepEqual(dry, input);
  const silent = [new Float32Array(12000), new Float32Array(12000)];
  createSongEffects(effects, 1000, 120)(silent);
  assert.ok(silent.every(ch => ch.every(value => value === 0)));
});

test('effects stems and full output share exact arithmetic for loops and song tails', () => {
  for (const form of ['sketch', 'loop']) {
    const song = score(form);
    song.tempo = 179;
    song.tracks[0].effects = { ...effects, crush: { ...effects.crush, rate: 5 } };
    assert.notEqual(effectFrames(song) % 5, 0);
    const expected = renderSong(song);
    assert.equal(expected.channels[0].length, effectFrames(song));
    for (const blockFrames of [127, 4096]) {
      const parts = expected.parts.map(part => ({ ...part, channels: part.channels.map(ch => new Float32Array(ch.length)) }));
      let high = 0;
      for (const block of renderSongBlocks(song, [], { blockFrames })) {
        block.parts.forEach((part, p) => part.channels.forEach((ch, c) => parts[p].channels[c].set(ch, block.at)));
        for (const ch of block.channels) for (const value of ch) high = Math.max(high, Math.abs(value));
      }
      const gain = Math.min(1, 0.8 / (high || 1));
      for (const part of parts) for (const ch of part.channels) for (let i = 0; i < ch.length; i++) {
        ch[i] *= gain * (form === 'loop' ? 1 : Math.min(1, (ch.length - 1 - i) / (song.output.sampleRate * 0.25)));
      }
      assert.deepEqual(parts, expected.parts);
      assert.deepEqual(mixParts(parts), expected.channels);
    }
  }
});

test('empty effects override instrument echo while absent effects keep the old output', () => {
  const song = score('sketch');
  song.tracks[0].instrument = 'lead';
  delete song.tracks[0].effects;
  const old = renderSong(song);
  song.tracks[0].effects = {};
  const dry = renderSong(song);
  assert.notDeepEqual(dry.channels, old.channels);
  song.tracks[0].effects = { delay: { ...effects.delay, mix: 0 } };
  assert.deepEqual(renderSong(song).channels, dry.channels);
});
