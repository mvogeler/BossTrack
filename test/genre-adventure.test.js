import test from 'node:test';
import assert from 'node:assert/strict';
import { createProceduralSong, KEYS } from '../engine/song-compose.js';
import { fillAdventure } from '../engine/genre-adventure.js';

function phrase(song, id, seed) {
  const track = { id, seed, instrument: id, notes: [] };
  fillAdventure(song, track);
  return track.notes;
}

test('adventure phrases stay tonal, bounded and deterministic across keys and modes', () => {
  for (const key of KEYS) for (const mode of ['major', 'minor']) for (const use of ['sketch', 'menu', 'combat']) {
    const song = createProceduralSong(42, 'neutral', use, 'sketch', 'original', 'original', 'original', 'original', 'original', null, null, key, mode);
    const pitchClasses = song.harmony.scale.map(n => n % 12);
    for (const id of ['keys', 'pad', 'bass', 'drums']) {
      const notes = phrase(song, id, 7);
      assert.deepEqual(notes, phrase(song, id, 7));
      assert.ok(notes.length > 0);
      for (const note of notes) {
        assert.ok(note.tick >= 0 && note.tick + note.len <= 16 * song.ppq);
        assert.ok(note.len > 0 && note.vel > 0 && note.vel <= 1);
        if (id !== 'drums') {
          assert.ok(pitchClasses.includes(note.midi % 12));
          const [lo, hi] = id === 'keys' ? [48, 84] : id === 'bass' ? [28, 68] : [24, 96];
          assert.ok(note.midi >= lo && note.midi <= hi);
        }
      }
    }
  }
});

test('adventure uses dotted leaps, stepwise answers and root/fifth ostinatos', () => {
  const song = createProceduralSong(1, 'neutral', 'sketch', 'sketch', 'original', 'original', 'original', 'original', 'original', null, null, 'C', 'major');
  const melody = phrase(song, 'keys', 42);
  assert.deepEqual(melody.slice(0, 5).map(n => n.tick), [0, 720, 960, 1920, 2880]);
  assert.ok([5, 7].includes(melody[1].midi - melody[0].midi));
  assert.ok([1, 2].includes(melody[1].midi - melody[2].midi));
  assert.ok([1, 2].includes(melody[2].midi - melody[3].midi));
  assert.equal(melody.at(-1).midi % 12, song.harmony.root % 12);
  const bass = phrase(song, 'bass', 42).filter(n => n.tick < 4 * song.ppq);
  for (let i = 1; i < bass.length; i++) assert.ok([6, 7].includes(Math.abs(bass[i].midi - bass[i - 1].midi)));
  assert.equal(phrase(song, 'pad', 42).length, 12);
});

test('menu thins the march and seeds vary its phrase-ending pickup', () => {
  const song = createProceduralSong(42);
  const menu = { ...song, use: 'menu' };
  for (const id of ['keys', 'bass', 'drums']) assert.ok(phrase(menu, id, 42).length < phrase(song, id, 42).length);
  const pickup = notes => notes.filter(n => n.midi === 38 && n.tick > 15 * song.ppq).map(n => n.tick);
  assert.deepEqual(pickup(phrase(menu, 'drums', 42)), []);
  const endings = new Set(Array.from({ length: 20 }, (_, seed) => JSON.stringify(pickup(phrase(song, 'drums', seed)))));
  assert.equal(endings.size, 2);
  const shapes = new Set(Array.from({ length: 20 }, (_, seed) => JSON.stringify(phrase(song, 'keys', seed).map(n => n.midi))));
  assert.equal(shapes.size, 2);
});
