import test from 'node:test';
import assert from 'node:assert/strict';
import { INSTRUMENTS, makeVoice, voiceDuration } from '../engine/song-palette-electronic.js';
import { songOsc, songAdsr, songFilter, songAdd, songGain, songMul, songPerc } from '../engine/song-voice.js';

const nodes = { osc: songOsc, adsr: songAdsr, filter: songFilter, add: songAdd,
  gain: songGain, mul: songMul, perc: songPerc, f32: Math.fround };

function render(id, midi = 60, sr = 44100, beat = 0.5, size = 4096, articulation) {
  const note = { midi, articulation };
  const voice = makeVoice(id, note, 0.18, sr, 42, beat, nodes);
  assert.equal(voice.dur, voiceDuration(id, note, 0.18));
  const out = new Float32Array(Math.round(voice.dur * sr));
  for (let at = 0; at < out.length; at += size) {
    for (let i = at; i < Math.min(out.length, at + size); i++) out[i] = voice.source(i);
  }
  return out;
}

for (const id of Object.keys(INSTRUMENTS)) {
  test(id + ' keeps state across render blocks and has an audible, finite tail', () => {
    const full = render(id, 60, 44100, 0.5, 100000);
    assert.deepEqual(render(id, 60, 44100, 0.5, 127), full);
    let peak = 0, power = 0;
    for (const sample of full) {
      assert.ok(Number.isFinite(sample));
      peak = Math.max(peak, Math.abs(sample));
      power += sample * sample;
    }
    assert.ok(peak > 0.1 && peak < 1.5, String(peak));
    assert.ok(power / full.length > 0.001);
    assert.ok(Math.abs(full.at(-1)) < 0.002);
  });

  test(id + ' stays finite at pitch, tempo and sample-rate limits', () => {
    for (const sr of [44100, 48000]) {
      for (const midi of [0, 36, 84, 127]) {
        for (const beat of [0.2, 2]) {
          const voice = makeVoice(id, { midi }, 0.025, sr, 1, beat, nodes);
          let peak = 0;
          for (let i = 0; i < Math.round(voice.dur * sr); i++) {
            const sample = voice.source(i);
            assert.ok(Number.isFinite(sample), id + ' ' + midi);
            peak = Math.max(peak, Math.abs(sample));
          }
          assert.ok(peak < 1.5, id + ' ' + midi + ' ' + peak);
        }
      }
    }
  });
}

test('electronic palette voices have distinct waveforms', () => {
  const rendered = Object.keys(INSTRUMENTS).map(id => render(id));
  for (let a = 0; a < rendered.length; a++) {
    for (let b = a + 1; b < rendered.length; b++) {
      let difference = 0;
      for (let i = 0; i < 7000; i++) difference += (rendered[a][i] - rendered[b][i]) ** 2;
      assert.ok(difference / 7000 > 0.001, Object.keys(INSTRUMENTS)[a] + '/' + Object.keys(INSTRUMENTS)[b]);
    }
  }
});

test('electronic pads respond to short articulation', () => {
  for (const id of ['analog_pad', 'shimmer_pad']) {
    const sustained = render(id);
    const short = render(id, 60, 44100, 0.5, 4096, 'short');
    assert.equal(short.length, Math.round(0.26 * 44100));
    assert.ok(short.length < sustained.length);
    assert.notDeepEqual(short.slice(0, 1000), sustained.slice(0, 1000));
  }
});
