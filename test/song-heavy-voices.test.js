import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createKit } from '../engine/kit/index.js';
import { songVoiceBlocks, songVoiceFrames } from '../engine/song-voice.js';
import { renderSongVoice, renderSong, renderSongBlocks } from '../engine/song-render.js';
import { INSTRUMENTS } from '../engine/song-instruments.js';
import { createRng } from '../engine/rng.js';

function render(instrument, midi, sr, seed, beatSeconds, size = 127) {
  const voice = songVoiceBlocks(instrument, { midi }, 0.8, sr, seed, beatSeconds);
  const out = new Float32Array(voice.frames);
  let at = 0;
  for (const [block] of voice.blocks(size)) {
    assert.ok(block.length <= size);
    out.set(block, at);
    at += block.length;
  }
  return out;
}

test('heavy voices keep exact full and bounded rendering with finite gated tails', () => {
  for (const instrument of ['wobble', 'chug']) for (const sr of [44100, 48000]) {
    for (const midi of instrument === 'wobble' ? [28, 48, 68] : [36, 60, 84]) {
      const actual = render(instrument, midi, sr, 42, 60 / 140);
      assert.equal(actual.length, songVoiceFrames(instrument, { midi }, 0.8, sr));
      assert.deepEqual(actual, render(instrument, midi, sr, 42, 60 / 140, 4096));
      assert.deepEqual(actual, renderSongVoice(createKit({ sampleRate: sr, seed: 42 }), instrument, { midi }, 0.8, 60 / 140));
      let peak = 0, energy = 0;
      for (const value of actual) {
        assert.ok(Number.isFinite(value));
        peak = Math.max(peak, Math.abs(value));
        energy += value * value;
      }
      assert.ok(peak <= 1.1 && peak > 0.1);
      assert.ok(energy / actual.length > 0.001);
      assert.ok(Math.abs(actual.at(-1)) < 0.001);
    }
  }
});

test('wobble rate follows tempo and seed while chug keeps a dry fixed articulation', () => {
  const wobble = render('wobble', 40, 48000, 42, 0.5);
  assert.notDeepEqual(wobble, render('wobble', 40, 48000, 42, 0.25));
  const shapes = new Set();
  for (let seed = 1; seed <= 12; seed++) {
    const out = render('wobble', 40, 48000, seed, 0.5);
    shapes.add(JSON.stringify(Array.from(out.slice(12000, 12016))));
  }
  assert.equal(shapes.size, 3);
  const chug = render('chug', 48, 48000, 42, 0.5);
  assert.deepEqual(chug, render('chug', 48, 48000, 7, 0.25));
  assert.notDeepEqual(chug, renderSongVoice(createKit({ sampleRate: 48000 }), 'lead', { midi: 48 }, 0.8));
});

test('song renderers pass resolved tempo to wobble instead of the default pulse', () => {
  for (const tempo of [90, 140]) {
    const note = { id: 'bass-0', midi: 40, tick: 0, len: tempo * 960 / 60, vel: 1 };
    const song = { tempo, ppq: 960, bars: 1, form: 'sketch', output: { sampleRate: 48000 },
      tracks: [{ id: 'bass', instrument: 'wobble', seed: 42, notes: [note] }] };
    const full = renderSong(song);
    const blocks = renderSongBlocks(song, [], { blockFrames: 4096 });
    const first = blocks.next().value.channels[0];
    assert.deepEqual(first, full.channels[0].slice(0, first.length));
    const seed = createRng(42).fork('bass/bass-0').int(0, 0xffffffff);
    const a = renderSongVoice(createKit({ sampleRate: 48000, seed }), 'wobble', note, 1, 60 / tempo);
    const b = renderSongVoice(createKit({ sampleRate: 48000, seed }), 'wobble', note, 1);
    assert.notDeepEqual(a, b);
    const gain = INSTRUMENTS.wobble.level * Math.cos(Math.PI / 4);
    assert.deepEqual(first, a.slice(0, first.length).map(value => value * gain));
  }
});
