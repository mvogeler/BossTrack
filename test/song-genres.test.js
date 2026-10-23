import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createProceduralSong, rerollPart, addPart, KEYS, keepPartLayout } from '../engine/song-compose.js';
import { GENRES } from '../engine/song-genres.js';
import { genreDefault } from '../engine/song-defaults.js';
import { INSTRUMENTS } from '../engine/song-instruments.js';
import { readSongFile } from '../engine/song-file.js';

const make = (genre, seed = 42, key = null, mode = null, feeling = 'neutral', use = 'sketch', form = 'sketch', length = null) =>
  createProceduralSong(seed, feeling, use, form, 'auto', 'auto', 'auto', 'auto', 'auto', length, null, key, mode, genre);
const file = song => ({ format: 'bosstrack-song', v: 1, renderer: 'song-v1', song,
  mix: { muted: [], solo: [], gains: {} }, repeat: false,
  assets: Object.fromEntries(song.tracks.filter(t => INSTRUMENTS[t.instrument].sample).map(t => [t.instrument, 'a'.repeat(64)])) });

test('genre scores remain tonal, deterministic and reopenable across musical choices', () => {
  for (const genre of ['cozy', 'electronic', 'adventure']) for (const seed of [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 42]) {
    for (const key of KEYS) for (const mode of ['major', 'minor']) {
      const song = make(genre, seed, key, mode);
      assert.deepEqual(song, make(genre, seed, key, mode));
      assert.deepEqual(readSongFile(JSON.stringify(file(song))).song, song);
      for (const t of song.tracks) {
        assert.equal(t.instrument, genreDefault(genre, t.id).instrument);
        assert.ok(t.notes.every(n => n.tick >= 0 && n.len > 0 && n.tick + n.len <= song.bars * 3840));
        if (t.id !== 'drums') assert.ok(t.notes.every(n => song.harmony.scale.some(p => p % 12 === n.midi % 12)));
      }
    }
    for (const feeling of ['neutral', 'cozy', 'tense', 'uplifting']) for (const use of ['sketch', 'menu', 'combat']) for (const form of ['sketch', 'song', 'loop']) {
      const song = make(genre, seed, null, null, feeling, use, form);
      assert.deepEqual(readSongFile(JSON.stringify(file(song))).song, song);
      const changed = rerollPart(song, 'keys', 1234);
      assert.deepEqual(changed.tracks.slice(1), song.tracks.slice(1));
      assert.equal(changed.tracks[0].instrument, song.tracks[0].instrument);
    }
  }
});

test('named patterns override only their genre part and old defaults stay exact', () => {
  assert.deepEqual(createProceduralSong(42), createProceduralSong(42, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, 'original'));
  for (const genre of ['cozy', 'electronic', 'adventure']) {
    const song = make(genre);
    const named = createProceduralSong(42, 'neutral', 'sketch', 'sketch', 'singing', 'auto', 'auto', 'auto', 'auto', null, 99, 'D', 'minor', genre);
    assert.equal(named.tempo, 99); assert.equal(named.harmony.root, 62); assert.equal(named.harmony.mode, 'minor');
    assert.notDeepEqual(named.tracks[0].notes, song.tracks[0].notes);
    const added = addPart(song, 'keys', 1234);
    assert.deepEqual(added.tracks.slice(0, 4), song.tracks);
    assert.deepEqual(readSongFile(JSON.stringify(file(keepPartLayout(make(genre, 7), added)))).song.tracks.length, 5);
    const bad = file(song); bad.song.genre = 'missing';
    assert.throws(() => readSongFile(JSON.stringify(bad)), /genre/);
  }
});

test('long genre sections develop the returning performance', () => {
  for (const genre of ['cozy', 'electronic', 'adventure']) {
    const song = make(genre, 42, null, null, 'neutral', 'sketch', 'song', 120);
    assert.deepEqual(readSongFile(JSON.stringify(file(song))).song, song);
    if (genre === 'electronic') {
      const contrast = song.sections.find(s => s.name === 'Contrast');
      assert.ok(contrast);
      assert.ok(song.tracks[3].notes.filter(n => n.tick >= contrast.bar * 3840 && n.tick < (contrast.bar + contrast.bars) * 3840).every(n => n.midi !== 36));
    }
  }
});
