import { test } from 'node:test';
import assert from 'node:assert/strict';
import { INSTRUMENTS, makeVoice, voiceDuration } from '../engine/song-palette-cozy.js';
import { songOsc } from '../engine/song-voice.js';

const nodes = { osc: songOsc, f32: Math.fround };

function render(id, midi = 60, sr = 44100, chunks = 4096) {
  const note = { midi };
  const voice = makeVoice(id, note, 0.18, sr, 42, 0.5, nodes);
  const frames = Math.round(voice.dur * sr);
  const pcm = new Float32Array(frames);
  for (let at = 0; at < frames; at += chunks) {
    for (let i = at; i < Math.min(frames, at + chunks); i++) pcm[i] = voice.source(i);
  }
  return pcm;
}

test('cozy palette has distinct deterministic tones with quiet gated tails', () => {
  const signatures = new Set();
  for (const id of Object.keys(INSTRUMENTS)) {
    const pcm = render(id);
    assert.deepEqual(pcm, render(id, 60, 44100, 127), id);
    let energy = 0, peak = 0, tail = 0;
    for (let i = 0; i < pcm.length; i++) {
      assert.ok(Number.isFinite(pcm[i]), id);
      energy += pcm[i] ** 2;
      peak = Math.max(peak, Math.abs(pcm[i]));
      if (i >= pcm.length - 64) tail = Math.max(tail, Math.abs(pcm[i]));
    }
    assert.ok(energy / pcm.length > 0.001, id + ' audible');
    assert.ok(peak <= 0.8, id + ' headroom');
    assert.ok(tail < 0.001, id + ' tail');
    signatures.add(Array.from(pcm.slice(200, 232)).join(','));
    assert.equal(voiceDuration(id, { midi: 60 }, 120) - 120 < (id === 'tine_box' ? 1 : 0.7), true);
  }
  assert.equal(signatures.size, 11);
});

test('cozy palette handles the whole MIDI range at both render rates', () => {
  for (const id of Object.keys(INSTRUMENTS)) {
    for (const sr of [44100, 48000]) {
      for (const midi of [0, 21, 48, 84, 108, 127]) {
        const pcm = render(id, midi, sr);
        assert.ok(pcm.every(Number.isFinite), id + ' ' + midi);
        assert.ok(pcm.some(value => Math.abs(value) > 0.001), id + ' audible ' + midi);
      }
    }
  }
});
