import { test } from 'node:test';
import assert from 'node:assert/strict';
import { FEELINGS } from '../engine/song-feelings.js';
import { createProceduralSong, rerollPart } from '../engine/song-compose.js';
import { readSongFile } from '../engine/song-file.js';

test('feelings keep tonal timing, deterministic scores and independent part edits', () => {
  for (const feeling of ['cozy', 'tense', 'uplifting']) for (let seed = 0; seed < 100; seed++) {
    const song = createProceduralSong(seed, feeling);
    assert.deepEqual(song, createProceduralSong(seed, feeling));
    assert.equal(song.tempo, FEELINGS[feeling].tempo);
    assert.equal(song.harmony.mode, FEELINGS[feeling].mode);
    const keys = song.tracks[0];
    assert.ok(keys.notes.every((n) => song.harmony.scale.some((p) => p % 12 === n.midi % 12)));
    assert.equal(keys.notes.at(-1).midi, song.harmony.root + 12 + (FEELINGS[feeling].register ?? 0));
    const file = { format: 'bosstrack-song', v: 1, renderer: 'song-v1', song,
      mix: { muted: [], solo: [], gains: {} }, repeat: false };
    assert.deepEqual(readSongFile(JSON.stringify(file)), file);
    const next = rerollPart(song, 'keys', 1234);
    assert.equal(next.feeling, feeling);
    assert.deepEqual(next.tracks.slice(1), song.tracks.slice(1));
  }
});

test('feelings differ in register, density and harmony, and Original stays explicit', () => {
  const cozy = createProceduralSong(42, 'cozy');
  const tense = createProceduralSong(42, 'tense');
  const uplifting = createProceduralSong(42, 'uplifting');
  assert.ok(cozy.tracks[0].notes.length < uplifting.tracks[0].notes.length);
  assert.ok(tense.tracks[0].notes.length > uplifting.tracks[0].notes.length);
  assert.ok(tense.tracks[3].notes.length > cozy.tracks[3].notes.length);
  assert.ok(cozy.tracks[0].notes[0].midi < uplifting.tracks[0].notes[0].midi);
  assert.deepEqual(createProceduralSong(42, 'neutral'), createProceduralSong(42));
  assert.throws(() => createProceduralSong(42, 'missing'), /Unknown feeling/);
});
