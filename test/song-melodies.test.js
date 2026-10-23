import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createProceduralSong, rerollPart } from '../engine/song-compose.js';
import { chooseMelody, MELODIES } from '../engine/song-melodies.js';
import { readSongFile } from '../engine/song-file.js';

const saved = (song) => JSON.stringify({ format: 'bosstrack-song', v: 1, renderer: 'song-v1', song,
  mix: { muted: [], solo: [], gains: {} }, repeat: false });
const families = Object.keys(MELODIES).filter(id => id !== 'original');

test('melody families stay tonal, deterministic and bounded across feelings, uses and forms', () => {
  for (const melody of families) for (const feeling of ['neutral', 'cozy', 'tense', 'uplifting'])
    for (const use of ['sketch', 'menu', 'combat']) for (const form of ['sketch', 'song', 'loop']) for (let seed = 0; seed < 10; seed++) {
      const song = createProceduralSong(seed, feeling, use, form, melody);
      assert.deepEqual(song, createProceduralSong(seed, feeling, use, form, melody));
      assert.deepEqual(readSongFile(saved(song)).song, song);
      assert.ok(song.tracks[0].notes.every(n => n.midi >= 21 && n.midi <= 108 &&
        song.harmony.scale.some(p => p % 12 === n.midi % 12)));
      const old = createProceduralSong(seed, feeling, use, form);
      assert.deepEqual(song.tracks.slice(1), old.tracks.slice(1));
      const changed = rerollPart(song, 'keys', 1234);
      assert.equal(changed.melody, melody);
      assert.deepEqual(changed.tracks.slice(1), song.tracks.slice(1));
      if (melody !== 'auto') assert.equal(chooseMelody(changed, 1234).name, MELODIES[melody].name);
    }
});

test('families and their seeds change note shapes, and Original keeps the old score', () => {
  const signatures = new Set();
  for (const melody of families) {
    const variants = new Set();
    for (let seed = 0; seed < 10; seed++) {
      const song = createProceduralSong(seed, 'cozy', 'sketch', 'sketch', melody);
      const shape = JSON.stringify(song.tracks[0].notes.map(n => [n.tick, n.len, n.midi - song.harmony.root]));
      variants.add(shape);
      if (seed === 0 && melody !== 'auto') signatures.add(shape);
    }
    assert.ok(variants.size >= 3, melody + ' has too few seed variations');
  }
  assert.equal(signatures.size, families.length - 1);
  assert.deepEqual(createProceduralSong(42), createProceduralSong(42, 'neutral', 'sketch', 'sketch', 'original'));
  assert.throws(() => createProceduralSong(42, 'cozy', 'menu', 'loop', 'missing'), /Unknown melody/);
  const bad = createProceduralSong(42, 'cozy', 'menu', 'loop', 'auto');
  bad.melody = 'missing';
  assert.throws(() => readSongFile(saved(bad)), /Invalid saved melody/);
});
