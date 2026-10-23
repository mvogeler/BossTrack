import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { sampleVoice, sampleVoiceBlocks } from '../engine/song-samples.js';
import { createProceduralSong } from '../engine/song-compose.js';
import { INSTRUMENTS, swapInstrument, addInstruments } from '../engine/song-instruments.js';
import { assetsDir, readPersonalInstruments } from '../main/banks.js';
import { renderSong } from '../engine/song-render.js';
import { readSongFile } from '../engine/song-file.js';
import { rerollPart } from '../engine/song-compose.js';

addInstruments(await readPersonalInstruments());

const sample = { root: 84, sampleRate: 48000, loop: { start: 1, end: 3 },
  channels: [Float32Array.of(0, 0.5, 0, -0.5, 0), Float32Array.of(0, -0.25, 0, 0.25, 0)] };

test('sample blocks preserve interpolation and release across arbitrary boundaries', () => {
  for (const sr of [44100, 48000]) for (const articulation of [undefined, 'short']) {
    const note = { midi: 87, articulation };
    const expected = sampleVoice(note, 0.07, sr, [sample]);
    for (const size of [1, 127, 4096, 32768]) {
      const voice = sampleVoiceBlocks(note, 0.07, sr, [sample]);
      const actual = expected.map(ch => new Float32Array(ch.length));
      let at = 0;
      for (const block of voice.blocks(size)) {
        assert.ok(block[0].length <= size);
        block.forEach((ch, c) => actual[c].set(ch, at));
        at += block[0].length;
      }
      assert.equal(at, voice.frames);
      assert.deepEqual(actual, expected);
    }
  }
  assert.throws(() => [...sampleVoiceBlocks({ midi: 84 }, 1, 48000, [sample]).blocks(0)], /block size/);
});

test('sample playback preserves stereo, holds the loop and releases to zero', () => {
  for (const sr of [44100, 48000]) {
    const channels = sampleVoice({ midi: 96 }, 0.5, sr, [sample]);
    assert.equal(channels[0].length, Math.round(sr * 0.75));
    assert.ok(channels.every((ch) => ch.every(Number.isFinite)));
    assert.equal(channels[0].at(-1), 0);
    assert.ok(channels[0].slice(Math.round(sr * 0.4), Math.round(sr * 0.5)).some((v) => Math.abs(v) > 0.2));
    assert.deepEqual(channels, sampleVoice({ midi: 96 }, 0.5, sr, [sample]));
    for (let i = 0; i < channels[0].length; i++) assert.ok(Math.abs(channels[1][i] + channels[0][i] / 2) < 1e-7);
  }
});

test('piano swaps preserve notes, reject unsuitable range and render with supplied samples', () => {
  const song = createProceduralSong(42);
  const next = swapInstrument(song, 'keys', 'kawai_piano');
  assert.equal(next.tracks[0].notes, song.tracks[0].notes);
  assert.throws(() => renderSong(next), /not loaded/);
  const audio = renderSong(next, [{ ...sample, instrument: 'kawai_piano' }]);
  assert.ok(audio.channels.every((ch) => ch.every((v) => Number.isFinite(v) && Math.abs(v) <= 0.801)));
  const out = { ...song, tracks: [{ ...song.tracks[0], notes: [{ ...song.tracks[0].notes[0], midi: 109 }] }] };
  assert.throws(() => swapInstrument(out, 'keys', 'kawai_piano'), /range/);
});

test('acoustic bass keeps the score and uses its own decaying samples beside piano', () => {
  const song = createProceduralSong(42);
  const next = swapInstrument(swapInstrument(song, 'bass', 'upright_bass'), 'keys', 'kawai_piano');
  assert.deepEqual(next.tracks.map((t) => t.notes), song.tracks.map((t) => t.notes));
  assert.equal(rerollPart(next, 'bass', 77).tracks.find((t) => t.id === 'bass').instrument, 'upright_bass');
  const bass = { ...sample, instrument: 'upright_bass', root: 40, loop: null };
  const samples = [bass, { ...sample, instrument: 'kawai_piano' }];
  const audio = renderSong(next, samples);
  assert.deepEqual(audio, renderSong(next, samples));
  assert.throws(() => renderSong(next, [samples[1]]), /not loaded/);
  const tail = sampleVoice({ midi: 40 }, 0.1, 48000, [bass])[0];
  assert.ok(tail.slice(5).every((v) => v === 0));
  assert.ok(audio.channels.every((ch) => ch.every(Number.isFinite)));
  const file = { format: 'bosstrack-song', v: 1, renderer: 'song-v1', song: next,
    mix: { muted: [], solo: [], gains: {} }, repeat: false, assets: { kawai_piano: 'a'.repeat(64), upright_bass: 'b'.repeat(64) } };
  assert.deepEqual(readSongFile(JSON.stringify(file)).song, next);
  delete file.assets.upright_bass;
  assert.throws(() => readSongFile(JSON.stringify(file)), /upright acoustic bass asset identity/);
  const out = { ...song, tracks: song.tracks.map((t) => t.id === 'bass' ? { ...t, notes: [{ ...t.notes[0], midi: 23 }] } : t) };
  assert.throws(() => swapInstrument(out, 'bass', 'upright_bass'), /range/);
});

test('each part has contrasting voices with deterministic saved performances', () => {
  assert.equal(sampleVoice({ midi: 84, articulation: 'short' }, 0.1, 48000, [sample])[0].length, 8640);
  const base = createProceduralSong(42);
  for (const part of ['keys', 'pad', 'bass', 'drums']) {
    const options = Object.entries(INSTRUMENTS).filter(([, voice]) => voice.part === part);
    assert.ok(options.length >= 4);
    const waves = [];
    for (const [id, voice] of options.filter(([, voice]) => !voice.sample)) {
      const swapped = swapInstrument(base, part, id);
      assert.deepEqual(swapped.tracks.map((t) => t.notes), base.tracks.map((t) => t.notes));
      const song = { ...swapped, tracks: swapped.tracks.map((t) => ({ ...t, notes: t.id === part ? t.notes.slice(0, 3) : [] })) };
      const audio = renderSong(song);
      assert.deepEqual(audio.channels, renderSong(song).channels);
      assert.ok(audio.channels.every((ch) => ch.every((v) => Number.isFinite(v) && Math.abs(v) <= 0.801)));
      const wave = audio.parts.find((t) => t.id === part).channels[0];
      assert.ok(wave.some((v) => v !== 0));
      assert.ok(waves.every((previous) => previous.some((v, i) => v !== wave[i])));
      waves.push(wave);
      const file = { format: 'bosstrack-song', v: 1, renderer: 'song-v1', song,
        mix: { muted: [], solo: [], gains: {} }, repeat: false };
      assert.deepEqual(readSongFile(JSON.stringify(file)).song, song);
    }
  }
});

function strongestPitch(x, sampleRate, near) {
  let best = near, bestScore = -1;
  for (let midi = near - 12; midi <= near + 12; midi++) {
    let score = 0;
    for (let k = 1; k <= 6; k++) {
      const step = 2 * Math.PI * k * 440 * 2 ** ((midi - 69) / 12) / sampleRate;
      const c = Math.cos(step), s = Math.sin(step);
      let re = 0, im = 0, pr = 1, pi = 0;
      for (const v of x) {
        re += v * pr; im += v * pi;
        const t = pr * c - pi * s; pi = pr * s + pi * c; pr = t;
      }
      score += Math.hypot(re, im) / Math.sqrt(k);
    }
    if (score > bestScore) [best, bestScore] = [midi, score];
  }
  return best;
}

const sections = [...new Set(Object.values(INSTRUMENTS).filter(i => /strings section/i.test(i.name)).map(i => i.cache))]
  .filter(cache => !cache.startsWith('open-') && existsSync(path.join(assetsDir, cache, 'manifest.json')));

test('string section roots match the pitch the recordings actually play', { skip: !sections.length && 'no string section banks installed' }, async () => {
  for (const cache of sections) {
    const folder = pathToFileURL(path.join(assetsDir, cache) + '/');
    const manifest = JSON.parse(await fs.readFile(new URL('manifest.json', folder), 'utf8'));
    for (const s of manifest.samples) {
      const bytes = await fs.readFile(new URL(s.file ?? s.root + '.f32', folder));
      const pcm = new Float32Array(bytes.buffer, bytes.byteOffset, bytes.byteLength / 4);
      const n = 16384, at = Math.floor(s.frames / 3);
      const x = Float32Array.from({ length: n }, (_, i) =>
        (pcm[at + i] + pcm[s.frames + at + i]) / 2 * (0.5 - 0.5 * Math.cos(2 * Math.PI * i / n)));
      assert.equal(strongestPitch(x, manifest.sampleRate, s.root), s.root, cache + ' root ' + s.root);
    }
  }
});
