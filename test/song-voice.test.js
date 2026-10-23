import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createKit } from '../engine/kit/index.js';
import { songVoiceBlocks } from '../engine/song-voice.js';
import { renderSongVoice } from '../engine/song-render.js';

test('simple voice blocks match the buffer kit at each sample', () => {
  for (const sr of [44100, 48000]) for (const size of [1, 127, 4096]) {
    const len = 0.17;
    const hz = 440;
    const k = createKit({ sampleRate: sr, seed: 42 });
    const voices = {
      chip: k.mul(k.osc(len + 0.02, hz, { type: 'pulse', pw: 0.25 }), k.env.adsr(len + 0.02, 0.002, 0.04, 0.65, 0.02)),
      lead: k.mul(k.add(k.osc(len + 0.25, hz, { type: 'tri' }), k.gain(k.osc(len + 0.25, hz * 2), -18)), k.env.adsr(len + 0.25, 0.012, 0.18, 0.45, 0.25)),
      bass: k.mul(k.add(k.osc(len, hz), k.gain(k.osc(len, hz * 2), -14)), k.env.adsr(len, 0.008, 0.2, 0.65, 0.08)),
    };
    for (const [instrument, expected] of Object.entries(voices)) {
      const voice = songVoiceBlocks(instrument, { midi: 69 }, len, sr);
      const actual = new Float32Array(voice.frames);
      let at = 0;
      for (const [block] of voice.blocks(size)) {
        assert.ok(block.length <= size);
        actual.set(block, at);
        at += block.length;
      }
      assert.deepEqual(actual, expected, instrument + '/' + sr + '/' + size);
    }
  }
});

test('filtered, noisy and FM blocks preserve the original note render', () => {
  for (const sr of [44100, 48000]) for (const size of [127, 4096]) {
    for (const instrument of ['pad', 'organ', 'bright', 'growl', 'keys', 'flute', 'drums', 'electronic', 'chipdrums', 'pluck', 'pluckbass']) {
      for (const midi of instrument.includes('drums') || instrument === 'electronic' ? [36, 38, 42] : [57, 81]) {
        const note = { midi, articulation: 'short' };
        const expected = renderSongVoice(createKit({ sampleRate: sr, seed: 42 }), instrument, note, 0.17);
        const voice = songVoiceBlocks(instrument, note, 0.17, sr, 42);
        const actual = new Float32Array(voice.frames);
        let at = 0;
        for (const [block] of voice.blocks(size)) {
          actual.set(block, at);
          at += block.length;
        }
        assert.deepEqual(actual, expected, instrument + '/' + midi + '/' + sr + '/' + size);
      }
    }
  }
});
