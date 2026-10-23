import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createProceduralSong } from '../engine/song-compose.js';
import { renderSong, mixParts } from '../engine/song-render.js';
import { tickSample } from '../engine/song.js';
import { encodeWav } from '../engine/wav.js';
import { readSongFile } from '../engine/song-file.js';

test('loop tails match the middle of repeated score playback at both sample rates', () => {
  for (const sampleRate of [44100, 48000]) {
    const song = createProceduralSong(42, 'cozy', 'menu', 'loop');
    song.output.sampleRate = sampleRate;
    song.tempo = 120;
    song.tracks = [song.tracks[0]];
    song.tracks[0].instrument = 'lead';
    const audio = renderSong(song);
    const end = tickSample(song, 32 * song.ppq);
    assert.deepEqual(audio.loop, { start: 0, end });
    const repeated = { ...song, form: 'song', bars: 24, tracks: song.tracks.map(t => ({ ...t,
      notes: [0, 1, 2].flatMap(period => t.notes.map(n => ({ ...n, tick: n.tick + period * 32 * song.ppq }))) })) };
    const reference = renderSong(repeated);
    for (let c = 0; c < 2; c++) {
      const offset = tickSample(song, 32 * song.ppq);
      assert.equal(audio.channels[c].length, end);
      for (let i = 0; i < end; i++) assert.ok(Math.abs(audio.channels[c][i] - reference.channels[c][offset + i]) < 0.000001);
    }
  }
});

test('full loops preserve stems, mix choices, saved form and WAV loop markers', () => {
  const song = createProceduralSong(42, 'tense', 'combat', 'loop');
  const audio = renderSong(song);
  assert.deepEqual(audio.channels, renderSong(song).channels);
  assert.deepEqual(audio.channels, mixParts(audio.parts));
  for (const ch of audio.channels) assert.ok(ch.every(v => Number.isFinite(v) && Math.abs(v) <= 0.801));
  const silent = mixParts(audio.parts, { muted: song.tracks.map(t => t.id) });
  assert.ok(silent.every(ch => ch.every(v => v === 0)));
  const file = { format: 'bosstrack-song', v: 1, renderer: 'song-v1', song,
    mix: { muted: ['drums'], solo: [], gains: { keys: 0.5 } }, repeat: true };
  assert.deepEqual(readSongFile(JSON.stringify(file)), file);
  const bytes = encodeWav(audio.channels, audio.sampleRate, { bitDepth: 24, loop: audio.loop });
  const view = new DataView(bytes.buffer);
  const smpl = Buffer.from(bytes).indexOf('smpl');
  assert.equal(view.getUint32(smpl + 52, true), 0);
  assert.equal(view.getUint32(smpl + 56, true), audio.loop.end);
  const data = Buffer.from(bytes).indexOf('data') + 8;
  assert.deepEqual(bytes.slice(-6), bytes.slice(data, data + 6));
});
