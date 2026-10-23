import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { createProceduralSong, rerollPart, KEYS } from '../engine/song-compose.js';
import { GENRES } from '../engine/song-genres.js';
import { genreDefault } from '../engine/song-defaults.js';
import { INSTRUMENTS } from '../engine/song-instruments.js';
import { readSongFile } from '../engine/song-file.js';

const added = Object.keys(GENRES).filter(id => !['original', 'cozy', 'electronic', 'adventure'].includes(id) && !GENRES[id].composed);
const genres = ['cozy', ...added];
const make = (genre, seed = 42, key = 'C', mode = 'major', form = 'sketch', length = null, melody = 'auto') =>
  createProceduralSong(seed, 'neutral', 'sketch', form, melody, 'auto', 'auto', 'auto', 'auto', length, 100, key, mode, genre);
const file = song => ({ format: 'bosstrack-song', v: 1, renderer: 'song-v1', song,
  mix: { muted: [], solo: [], gains: {} }, repeat: false,
  assets: Object.fromEntries(song.tracks.filter(t => INSTRUMENTS[t.instrument].sample).map(t => [t.instrument, 'a'.repeat(64)])) });

test('the expanded genre batch has playable deterministic defaults and exact saved scores', () => {
  assert.ok(added.includes('incremental'));
  for (const genre of genres) for (const key of KEYS) for (const mode of ['major', 'minor']) for (const seed of [1, 7, 42]) {
    const song = make(genre, seed, key, mode);
    assert.deepEqual(song, make(genre, seed, key, mode));
    assert.deepEqual(readSongFile(JSON.stringify(file(song))).song, song);
    for (const track of song.tracks) {
      const instrument = INSTRUMENTS[track.instrument];
      assert.equal(track.instrument, genreDefault(genre, track.id).instrument);
      assert.equal(instrument.part, track.id);
      assert.ok(track.notes.length > 0 || ['ambient', 'newage'].includes(genre) && track.id === 'drums' || GENRES[genre].silent?.includes(track.id), genre + ' ' + track.id);
      for (const note of track.notes) {
        assert.ok(note.tick >= 0 && note.len > 0 && note.tick + note.len <= song.bars * 4 * song.ppq);
        assert.ok(note.vel > 0 && note.vel <= 1);
        if (instrument.range) assert.ok(note.midi >= instrument.range[0] && note.midi <= instrument.range[1], genre + ' ' + track.instrument + ': ' + note.midi);
        if (track.id !== 'drums') assert.ok(song.harmony.scale.some(p => p % 12 === note.midi % 12));
      }
    }
    const changed = rerollPart(song, 'bass', 1234);
    assert.deepEqual(changed.tracks.filter(t => t.id !== 'bass'), song.tracks.filter(t => t.id !== 'bass'));
    assert.equal(changed.tracks[2].instrument, song.tracks[2].instrument);
    assert.deepEqual(readSongFile(JSON.stringify(file(changed))).song, changed);
  }
});

test('explicit melody patterns override just that part in the expanded genres', () => {
  for (const genre of genres) {
    const song = make(genre);
    const named = make(genre, 42, 'C', 'major', 'sketch', null, 'singing');
    assert.notDeepEqual(named.tracks[0].notes, song.tracks[0].notes);
    assert.deepEqual(named.tracks.slice(1), song.tracks.slice(1));
    const original = createProceduralSong(42, 'neutral', 'sketch', 'sketch', 'singing', 'auto', 'auto', 'auto', 'auto', null, 100, 'C', 'major');
    original.harmony = song.harmony;
    const expected = rerollPart(original, 'keys', song.tracks[0].seed).tracks[0];
    assert.deepEqual(named.tracks[0].notes.map(n => ({ ...n, midi: n.midi - (named.tracks[0].octaves ?? 0) * 12 })), expected.notes);
  }
});

test('expanded genres retain bounded returns and contrasting Song and Loop sections', () => {
  for (const genre of genres) for (const form of ['song', 'loop']) {
    const song = make(genre, 42, 'F#', 'minor', form, 120);
    assert.deepEqual(readSongFile(JSON.stringify(file(song))).song, song);
    const contrast = song.sections.find(s => s.name === 'Contrast');
    const refrain = song.sections.find(s => s.name === 'Refrain');
    assert.ok(contrast && refrain, genre + ' ' + form);
    const signature = section => song.tracks.map(track => track.notes.filter(n =>
      n.tick >= section.bar * 4 * song.ppq && n.tick < (section.bar + section.bars) * 4 * song.ppq)
      .map(n => [n.tick - section.bar * 4 * song.ppq, n.midi, n.len, n.vel]));
    assert.notDeepEqual(signature(contrast), signature(refrain), genre + ' sections');
    assert.ok(song.tracks.every(t => t.notes.every(n => n.tick + n.len <= song.bars * 4 * song.ppq)));
  }
});

test('unmarked Cozy songs keep the earlier rules when changing notes', () => {
  const hashes = ['c0adb15dfb33a20d865583d4c272172e4eae1190828a70e4e7b495548f35cf46',
    '4fedc91609e6a4733197aa84e33cbe71c14c547b90a2dae54583fb74869555e4'];
  [1, 42].forEach((seed, i) => {
    const song = make('cozy', seed);
    delete song.genreRevision;
    const notes = song.tracks.map(t => rerollPart(song, t.id, 123).tracks.find(n => n.id === t.id).notes);
    assert.equal(createHash('sha256').update(JSON.stringify(notes)).digest('hex'), hashes[i]);
  });
});

test('band breaks keep one half-time snare instead of losing the backbeat', () => {
  for (const genre of ['rock', 'metal', 'kpop']) for (const form of ['song', 'loop']) {
    const song = make(genre, 42, 'C', 'minor', form, 120);
    const section = song.sections.find(s => s.name === 'Contrast');
    const start = section.bar * 4 * song.ppq;
    const end = start + section.bars * 4 * song.ppq;
    const hits = song.tracks[3].notes.filter(n => n.midi === 38 && n.tick >= start && n.tick < end);
    assert.equal(hits.length, section.bars);
    assert.ok(hits.every(n => n.tick % (4 * song.ppq) === 2 * song.ppq));
  }
});
