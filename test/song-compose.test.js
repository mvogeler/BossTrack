import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createProceduralSong, rerollPart, KEYS } from '../engine/song-compose.js';

const signature = (value) => JSON.stringify(value);

test('seed reproduces the score and produces different harmony choices', () => {
  const harmonies = new Set();
  for (let seed = 0; seed < 100; seed++) {
    const song = createProceduralSong(seed);
    assert.deepEqual(song, createProceduralSong(seed));
    assert.deepEqual(song, JSON.parse(signature(song)));
    harmonies.add(signature(song.harmony));
    assert.equal(song.harmony.steps[0], 0);
    assert.equal(song.harmony.steps.at(-1), 0);
    for (const chord of song.harmony.chords) {
      assert.equal(chord.notes.length, 3);
      assert.ok(chord.notes.every((midi) => song.harmony.scale.some((n) => n % 12 === midi % 12)));
      assert.ok(chord.notes.every((midi) => midi >= 48 && midi <= 79));
    }
  }
  assert.ok(harmonies.size > 20);
});

test('seed boundaries are supported and invalid values are rejected', () => {
  for (const seed of [0, 4294967295]) assert.equal(createProceduralSong(seed).seed, seed);
  for (const seed of [-1, 1.5, NaN, 4294967296]) assert.throws(() => createProceduralSong(seed));
});

test('melody repeats its motif rhythm, stays tonal, and ends at the tonic', () => {
  const melodies = new Set();
  for (let seed = 0; seed < 100; seed++) {
    const song = createProceduralSong(seed);
    const keys = song.tracks.find((t) => t.id === 'keys');
    const first = keys.notes.filter((n) => n.tick < 3840);
    const second = keys.notes.filter((n) => n.tick >= 3840 && n.tick < 7680);
    assert.deepEqual(first.map((n) => n.tick), second.map((n) => n.tick - 3840));
    assert.deepEqual(first.map((n) => n.len), second.map((n) => n.len));
    assert.equal(keys.notes.at(-1).midi, song.harmony.root + 12);
    assert.ok(keys.notes.every((n) => song.harmony.scale.some((m) => m % 12 === n.midi % 12)));
    assert.ok(keys.notes.every((n) => n.midi >= 60 && n.midi <= 96 && n.tick + n.len <= 15360));
    melodies.add(signature(keys.notes));
  }
  assert.ok(melodies.size > 50);
});

test('bass follows the kick pulse and all parts stay within the phrase', () => {
  const grooves = new Set();
  for (let seed = 0; seed < 100; seed++) {
    const song = createProceduralSong(seed);
    grooves.add(song.groove);
    const bass = song.tracks.find((t) => t.id === 'bass');
    const drums = song.tracks.find((t) => t.id === 'drums');
    for (const kick of drums.notes.filter((n) => n.midi === 36)) assert.ok(bass.notes.some((n) => n.tick === kick.tick));
    for (const track of song.tracks) {
      assert.equal(new Set(track.notes.map((n) => n.id)).size, track.notes.length);
      assert.ok(track.notes.every((n) => n.tick >= 0 && n.len > 0 && n.tick + n.len <= 15360 && n.vel > 0 && n.vel <= 1));
      assert.ok(track.notes.every((n) => Number.isInteger(n.tick) && Number.isInteger(n.len)));
    }
    assert.ok(drums.notes.every((n) => [36, 38, 42].includes(n.midi)));
    assert.ok(bass.notes.every((n) => song.harmony.scale.some((m) => m % 12 === n.midi % 12)));
  }
  assert.equal(grooves.size, 3);
});

test('changing one part preserves the harmony, tempo and every other part', async () => {
  const { rerollPart } = await import('../engine/song-compose.js');
  const song = createProceduralSong(42);
  const before = signature(song);
  for (const id of ['keys', 'pad', 'bass', 'drums']) {
    const next = rerollPart(song, id, 1234);
    assert.equal(signature(song), before);
    assert.equal(next.seed, song.seed);
    assert.equal(next.tempo, song.tempo);
    assert.deepEqual(next.harmony, song.harmony);
    assert.deepEqual(next, rerollPart(song, id, 1234));
    assert.notDeepEqual(next.tracks.find((t) => t.id === id), song.tracks.find((t) => t.id === id));
    for (const track of song.tracks.filter((t) => t.id !== id)) assert.deepEqual(next.tracks.find((t) => t.id === track.id), track);
  }
});

const inKey = (key, mode, feeling = 'neutral', form = 'sketch', seed = 42, length = null) =>
  createProceduralSong(seed, feeling, 'sketch', form, 'auto', 'auto', 'auto', 'warm', 'auto', length, null, key, mode);

test('all keys and modes compose tonal notes with unchanged drum events', () => {
  for (const feeling of ['neutral', 'cozy', 'tense', 'uplifting']) for (const form of ['sketch', 'song', 'loop']) {
    for (const seed of [1, 42, 1234]) {
      const original = inKey(null, null, feeling, form, seed);
      for (const key of KEYS) for (const mode of ['major', 'minor']) {
        const song = inKey(key, mode, feeling, form, seed);
        assert.equal(song.harmony.root % 12, KEYS.indexOf(key));
        assert.equal(song.harmony.mode, mode);
        assert.equal(song.harmony.name, key + ' ' + mode);
        assert.deepEqual(song.tracks[3], original.tracks[3]);
        assert.deepEqual(song.harmony.steps, original.harmony.steps);
        for (const track of song.tracks.slice(0, 3)) for (const note of track.notes) {
          assert.ok(song.harmony.scale.some(n => n % 12 === note.midi % 12));
          assert.ok(note.midi >= 0 && note.midi <= 127);
        }
        assert.ok(song.harmony.chords.every(c => c.notes.every(n => n >= 48 && n <= 79)));
      }
    }
  }
});

test('key defaults, deterministic overrides and part changes keep shared harmony', () => {
  assert.deepEqual(createProceduralSong(42), createProceduralSong(42, 'neutral', 'sketch', 'sketch', 'original', 'original', 'original', 'original', 'original', null, null, null, null));
  const song = inKey('F#', 'minor', 'cozy', 'loop', 42, 120);
  assert.deepEqual(song, inKey('F#', 'minor', 'cozy', 'loop', 42, 120));
  const next = rerollPart(song, 'keys', 99);
  assert.equal(next.harmony, song.harmony);
  assert.deepEqual(next.tracks.slice(1), song.tracks.slice(1));
  for (const key of ['H', '', 60]) assert.throws(() => inKey(key, null), /Unknown key/);
  for (const mode of ['dorian', '', 0]) assert.throws(() => inKey(null, mode), /Unknown mode/);
});
