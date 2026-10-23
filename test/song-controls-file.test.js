import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createProceduralSong, addPart } from '../engine/song-compose.js';
import { readSongFile } from '../engine/song-file.js';

const saved = () => ({ format: 'bosstrack-song', v: 1, renderer: 'song-v1',
  song: addPart(createProceduralSong(42), 'keys', 7),
  mix: { muted: [], solo: [], gains: {} }, repeat: false,
  generation: { locks: { keys: { notes: true, instrument: false, mix: true }, 'keys-2': { instrument: true } },
    varyInstruments: true, favorites: ['felt_keys', 'supersaw', 'fm_epiano_chords'], favoritesOnly: true } });

test('generation controls reopen exactly without changing the saved performance', () => {
  const file = saved();
  assert.deepEqual(readSongFile(JSON.stringify(file)), file);
  delete file.generation;
  assert.deepEqual(readSongFile(JSON.stringify(file)), file);
  file.generation = { locks: {}, varyInstruments: false, favorites: [], favoritesOnly: false };
  assert.deepEqual(readSongFile(JSON.stringify(file)), file);
});

test('invalid generation controls are rejected before rendering or restoring preferences', () => {
  for (const change of [f => f.generation = null, f => f.generation = [],
    f => f.generation.varyInstruments = 1, f => f.generation.favoritesOnly = 'yes',
    f => f.generation.favorites = ['missing'], f => f.generation.favorites.push('felt_keys'),
    f => f.generation.favorites = {}, f => f.generation.locks = [],
    f => f.generation.locks.missing = { notes: true }, f => f.generation.locks.keys.notes = 'true',
    f => f.generation.locks.keys.unknown = false, f => f.generation.locks.keys = null,
    f => f.generation.unknown = true]) {
    const file = saved();
    change(file);
    assert.throws(() => readSongFile(JSON.stringify(file)), /missing an instrument/);
  }
});
