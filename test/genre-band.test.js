import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createProceduralSong } from '../engine/song-compose.js';
import { fillRock } from '../engine/genre-rock.js';
import { fillMetal } from '../engine/genre-metal.js';
import { fillPop } from '../engine/genre-pop.js';
import { fillKpop } from '../engine/genre-kpop.js';
import { fillFunk } from '../engine/genre-funk.js';

checkGenre('rock', fillRock);
checkGenre('metal', fillMetal);
checkGenre('pop', fillPop);
checkGenre('kpop', fillKpop);
checkGenre('funk', fillFunk);

function checkGenre(name, fill) {
  test(name + ' has seed variety, repeatable phrases and bounded tonal notes', () => {
    const shapes = new Set();
    const rhythms = Object.fromEntries(['keys', 'pad', 'bass', 'drums'].map(id => [id, new Set()]));
    const keys = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
    for (const mode of ['major', 'minor']) for (const key of keys) for (let seed = 1; seed <= (key === 'C' ? 100 : 8); seed++) {
      const song = createProceduralSong(seed, 'neutral', 'sketch', 'sketch', 'original', 'original', 'original', 'original', 'original', null, 100, key, mode);
      const before = JSON.stringify(song);
      for (const id of Object.keys(rhythms)) {
        const track = { id, seed, notes: [] }, again = { id, seed, notes: [] };
        fill(song, track);
        fill(song, again);
        assert.deepEqual(track, again);
        assert.ok(track.notes.length > 0);
        for (const note of track.notes) {
          assert.ok(note.tick >= 0 && note.tick + note.len <= 16 * song.ppq);
          assert.ok(note.vel > 0 && note.vel <= 1);
          if (id === 'drums') assert.ok([36, 38, 42, 46].includes(note.midi));
          else {
            const [low, high] = { keys: [48, 84], pad: [24, 96], bass: [28, 68] }[id];
            assert.ok(note.midi >= low && note.midi <= high);
            assert.ok(song.harmony.scale.some(p => p % 12 === note.midi % 12));
          }
        }
        if (key === 'C' && mode === 'major') {
          rhythms[id].add(JSON.stringify(track.notes.map(n => [n.tick, n.len])));
          if (id === 'keys') shapes.add(JSON.stringify(track.notes.map(n => [n.tick, n.len, n.midi])));
        }
      }
      assert.equal(JSON.stringify(song), before);
    }
    assert.ok(shapes.size >= 30, name + ' melody shapes: ' + shapes.size);
    for (const [id, set] of Object.entries(rhythms)) assert.ok(set.size >= 10, name + ' ' + id + ' rhythms: ' + set.size);
  });
}
