import test from 'node:test';
import assert from 'node:assert/strict';
import { INSTRUMENTS, makeVoice, voiceDuration } from '../engine/song-palette-band.js';
import { songOsc, songAdsr, songFilter, songAdd, songGain, songMul, songPerc } from '../engine/song-voice.js';

const nodes = { osc: songOsc, adsr: songAdsr, filter: songFilter, add: songAdd,
  gain: songGain, mul: songMul, perc: songPerc, f32: Math.fround };

function render(id, midi = 60, sr = 44100, size = 4096, seed = 42, articulation) {
  const note = { midi, articulation };
  const voice = makeVoice(id, note, 0.18, sr, seed, 0.5, nodes);
  assert.equal(voice.dur, voiceDuration(id, note, 0.18));
  const result = new Float32Array(Math.round(voice.dur * sr));
  for (let start = 0; start < result.length; start += size) {
    for (let i = start; i < Math.min(start + size, result.length); i++) result[i] = voice.source(i);
  }
  return result;
}

test('band voices retain exact state across block boundaries', () => {
  for (const [id, instrument] of Object.entries(INSTRUMENTS)) {
    const pitches = instrument.part === 'drums' ? [36, 38, 42] : [60];
    for (const midi of pitches) assert.deepEqual(render(id, midi), render(id, midi, 44100, 127), id);
  }
});

test('band voices stay finite across the MIDI range and end quietly', () => {
  for (const [id, instrument] of Object.entries(INSTRUMENTS)) {
    const pitches = instrument.part === 'drums' ? [36, 38, 42] : [0, 12, 24, 36, 48, 60, 72, 84, 96, 108, 120, 127];
    for (const sr of [44100, 48000]) {
      for (const midi of pitches) {
        const samples = render(id, midi, sr);
        let peak = 0;
        for (const value of samples) {
          assert.ok(Number.isFinite(value), `${id} ${midi} ${sr}`);
          peak = Math.max(peak, Math.abs(value));
        }
        assert.ok(peak > 0 && peak < 1.5, `${id} peak ${peak}`);
        assert.equal(Math.abs(samples.at(-1)), 0, id);
      }
    }
  }
});

test('band timbres and drum hits have different sample signatures', () => {
  const signatures = new Set();
  for (const [id, instrument] of Object.entries(INSTRUMENTS)) {
    const pitches = instrument.part === 'drums' ? [36, 38, 42] : [60];
    for (const midi of pitches) {
      const samples = render(id, midi);
      const signature = Array.from(samples.slice(512, 640)).join(',');
      assert.ok(!signatures.has(signature), `${id} ${midi}`);
      signatures.add(signature);
    }
  }
});

test('short bowed and brass notes release earlier and seeded noise repeats', () => {
  for (const id of ['bowed', 'brass_warm']) {
    assert.ok(render(id, 60, 44100, 127, 42, 'short').length < render(id).length);
  }
  for (const id of ['bowed', 'reed', 'guitar_muted', 'drums_analog', 'drums_tight']) {
    const midi = id.startsWith('drums_') ? 38 : 60;
    assert.deepEqual(render(id, midi), render(id, midi), id);
    assert.notDeepEqual(render(id, midi), render(id, midi, 44100, 4096, 43), id);
  }
});
