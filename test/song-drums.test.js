import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createProceduralSong, rerollPart } from '../engine/song-compose.js';
import { DRUMS, chooseDrums } from '../engine/song-drums.js';
import { readSongFile } from '../engine/song-file.js';

test('drum families vary timing, preserve pitched parts and reopen across cue settings', () => {
  for (const drums of Object.keys(DRUMS).filter(id => id !== 'original')) {
    const shapes = new Set();
    for (let seed = 0; seed < 10; seed++) for (const feeling of ['neutral', 'cozy', 'tense', 'uplifting'])
      for (const use of ['sketch', 'menu', 'combat']) for (const form of ['sketch', 'song', 'loop']) {
        const song = createProceduralSong(seed, feeling, use, form, 'auto', drums);
        const old = createProceduralSong(seed, feeling, use, form, 'auto');
        assert.deepEqual(song.tracks.slice(0, 3), old.tracks.slice(0, 3));
        assert.deepEqual(song, createProceduralSong(seed, feeling, use, form, 'auto', drums));
        assert.deepEqual(readSongFile(JSON.stringify({ format:'bosstrack-song', v:1, renderer:'song-v1', song,
          mix:{ muted:[], solo:[], gains:{} }, repeat:false })).song, song);
        const changed = rerollPart(song, 'drums', 1234);
        assert.deepEqual(changed.tracks.slice(0, 3), song.tracks.slice(0, 3));
        assert.equal(changed.drums, drums);
        if (drums !== 'auto') assert.equal(chooseDrums(changed, 1234).name, DRUMS[drums].name);
        if (feeling === 'neutral' && use === 'sketch' && form === 'sketch')
          shapes.add(JSON.stringify(song.tracks[3].notes.map(n => [n.tick, n.midi])));
      }
    assert.ok(shapes.size >= 3, drums + ' has too few timing variations');
  }
  assert.deepEqual(createProceduralSong(42), createProceduralSong(42,'neutral','sketch','sketch','original','original'));
  assert.throws(() => createProceduralSong(42,'neutral','sketch','sketch','auto','missing'), /Unknown drum/);
  const bad = createProceduralSong(42,'neutral','sketch','sketch','original','auto');
  bad.drums = 'missing';
  assert.throws(() => readSongFile(JSON.stringify({format:'bosstrack-song',v:1,renderer:'song-v1',song:bad})), /Invalid saved drum/);
});
