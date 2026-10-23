import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createProceduralSong } from '../engine/song-compose.js';
import { fillCozy } from '../engine/genre-cozy.js';
import { fillLofi } from '../engine/genre-lofi.js';
import { fillBossa } from '../engine/genre-bossa.js';
import { fillFolk } from '../engine/genre-folk.js';
import { fillAmbient } from '../engine/genre-ambient.js';

export function checkGenre(name, fill, silentDrums = false) {
  test(name + ' keeps tonal ranges and distinct seeded performances', () => {
    const shapes = new Set(), rhythms = { keys: new Set(), pad: new Set(), bass: new Set(), drums: new Set() };
    for (let seed = 1; seed <= 100; seed++) {
      const song = createProceduralSong(seed, 'cozy', 'sketch', 'sketch', 'original', 'original', 'original', 'original', 'original', null, 100, 'C', 'major');
      song.genreRevision = 2;
      for (const id of Object.keys(rhythms)) {
        const track = { id, seed, notes: [] }, again = { id, seed, notes: [] };
        fill(song, track); fill(song, again);
        assert.deepEqual(track, again);
        rhythms[id].add(JSON.stringify(track.notes.map(n => [n.tick, n.len])));
        if (id === 'keys') shapes.add(JSON.stringify(track.notes.map(n => [n.tick, n.midi, n.len])));
      }
    }
    assert.ok(shapes.size >= 30, name + ' melody ' + shapes.size);
    for (const id of ['pad', 'bass', ...(silentDrums ? [] : ['drums'])]) assert.ok(rhythms[id].size >= 10, name + ' ' + id + ' rhythm ' + rhythms[id].size);
    for (const key of ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B']) for (const mode of ['major', 'minor']) {
      const song = createProceduralSong(42, 'cozy', 'sketch', 'sketch', 'original', 'original', 'original', 'original', 'original', null, 100, key, mode);
      song.genreRevision = 2;
      const before = JSON.stringify(song);
      for (const id of Object.keys(rhythms)) {
        const track = { id, seed: 42, notes: [] };
        fill(song, track);
        for (const n of track.notes) {
          assert.ok(n.tick >= 0 && n.tick + n.len <= 16 * song.ppq);
          assert.ok(n.vel > 0 && n.vel <= 1);
          if (id !== 'drums') {
            const [lo, hi] = { keys: [48, 84], pad: [24, 96], bass: [28, 68] }[id];
            assert.ok(n.midi >= lo && n.midi <= hi, name + ' ' + id + ' ' + n.midi);
            assert.ok(song.harmony.scale.some(p => p % 12 === n.midi % 12));
          }
        }
      }
      assert.equal(JSON.stringify(song), before);
    }
  });
}

checkGenre('cozy revision two', fillCozy);
checkGenre('lo-fi swing', fillLofi);
checkGenre('bossa lounge', fillBossa);
checkGenre('acoustic folk', fillFolk);
checkGenre('ambient drift', fillAmbient, true);

test('calm genres keep their distinct groove and space', () => {
  const song = createProceduralSong(42);
  const phrase = (fill, id) => {
    const track = { id, seed: 42, notes: [] };
    fill(song, track);
    return track.notes;
  };
  const hats = phrase(fillLofi, 'drums').filter(n => n.midi === 42);
  assert.ok(hats.some(n => n.tick % song.ppq > song.ppq / 2));
  assert.ok(hats.every(n => n.tick % song.ppq !== song.ppq / 2));
  const bossa = phrase(fillBossa, 'pad');
  assert.ok(bossa.some(n => n.tick % song.ppq === song.ppq / 2));
  assert.ok(bossa.every(n => n.articulation === 'short'));
  const folk = phrase(fillFolk, 'pad');
  assert.ok(folk.length >= 16);
  assert.equal(new Set(folk.map(n => n.tick)).size, folk.length);
  const ambient = phrase(fillAmbient, 'pad');
  assert.ok(ambient.some(n => n.len > song.ppq * 2));
  assert.deepEqual(phrase(fillAmbient, 'drums'), []);
  for (const fill of [fillLofi, fillBossa, fillFolk, fillAmbient]) {
    const full = phrase(fill, 'keys');
    const track = { id: 'keys', seed: 42, notes: [] };
    fill({ ...song, use: 'menu' }, track);
    assert.ok(track.notes.length <= full.length);
  }
});
