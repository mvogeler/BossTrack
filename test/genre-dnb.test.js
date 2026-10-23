import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createProceduralSong } from '../engine/song-compose.js';
import { fillDnb } from '../engine/genre-dnb.js';

function phrase(song, id, seed) {
  const track = { id, seed, notes: [] };
  fillDnb(song, track);
  return track.notes;
}

test('dnb keeps bounded tonal performances across all keys and modes', () => {
  for (const key of ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B']) {
    for (const mode of ['major', 'minor']) for (let seed = 1; seed <= 8; seed++) {
      const song = createProceduralSong(seed, 'neutral', 'sketch', 'sketch', 'original', 'original', 'original', 'original', 'original', null, 100, key, mode);
      const before = JSON.stringify(song);
      for (const id of ['keys', 'pad', 'bass', 'drums']) {
        const notes = phrase(song, id, seed);
        assert.deepEqual(notes, phrase(song, id, seed));
        assert.ok(notes.length > 0);
        for (const note of notes) {
          assert.ok(note.tick >= 0 && note.len > 0 && note.tick + note.len <= 16 * song.ppq);
          assert.ok(note.vel > 0 && note.vel <= 1);
          if (id === 'drums') assert.ok([36, 38, 42].includes(note.midi));
          else {
            const [lo, hi] = { keys: [48, 84], pad: [24, 96], bass: [28, 68] }[id];
            assert.ok(note.midi >= lo && note.midi <= hi);
            assert.ok(song.harmony.scale.some(n => (n - note.midi) % 12 === 0));
          }
          if (id === 'pad') assert.equal(note.articulation, 'short');
        }
      }
      assert.equal(JSON.stringify(song), before);
    }
  }
});

test('dnb seed changes melody and accompaniment at fixed harmony', () => {
  const song = createProceduralSong(42, 'neutral', 'sketch', 'sketch', 'original', 'original', 'original', 'original', 'original', null, 100, 'C', 'major');
  const melodies = new Set();
  const backing = new Set();
  for (let seed = 1; seed <= 100; seed++) {
    melodies.add(JSON.stringify(phrase(song, 'keys', seed).map(n => [n.tick, n.len, n.midi])));
    backing.add(JSON.stringify(phrase(song, 'pad', seed).map(n => [n.tick, n.len])));
  }
  assert.ok(melodies.size >= 30, 'melody variety ' + melodies.size);
  assert.ok(backing.size >= 10, 'backing variety ' + backing.size);
});

test('dnb retains its drum backbeat while melodic parts leave room in menus', () => {
  const song = createProceduralSong(42);
  const snares = phrase(song, 'drums', 42).filter(n => n.midi === 38 && n.tick % song.ppq === 0);
  assert.deepEqual(snares.map(n => n.tick / song.ppq), [1,3,5,7,9,11,13,15]);
  for (const id of ['keys', 'pad', 'bass']) {
    assert.ok(phrase({ ...song, use: 'menu' }, id, 42).length < phrase(song, id, 42).length);
  }
});
