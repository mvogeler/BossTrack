import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createProceduralSong, rerollPart } from '../engine/song-compose.js';
import { HARMONIES, chooseHarmony } from '../engine/song-harmony.js';
import { readSongFile } from '../engine/song-file.js';

test('harmony families vary chord paths while pitched parts agree and drums stay fixed', () => {
  for (const progression of Object.keys(HARMONIES).filter(id => id !== 'original')) {
    const paths = new Set();
    for (let seed = 0; seed < 20; seed++) for (const feeling of ['neutral','cozy','tense','uplifting'])
      for (const use of ['sketch','menu','combat']) for (const form of ['sketch','song','loop']) {
        const args = [seed,feeling,use,form,'auto','auto','auto'];
        const song = createProceduralSong(...args,progression);
        assert.deepEqual(song,createProceduralSong(...args,progression));
        assert.deepEqual(song.tracks[3],createProceduralSong(...args).tracks[3]);
        assert.equal(song.harmony.steps[0],0);
        assert.equal(song.harmony.steps[3],0);
        assert.ok(song.tracks.slice(0,3).every(t => t.notes.every(n => song.harmony.scale.some(p => p % 12 === n.midi % 12))));
        assert.ok(song.harmony.chords.every(c => c.notes.every(n => n >= 48 && n <= 79)));
        assert.deepEqual(readSongFile(JSON.stringify({format:'bosstrack-song',v:1,renderer:'song-v1',song,
          mix:{muted:[],solo:[],gains:{}},repeat:false})).song,song);
        const changed = rerollPart(song,'keys',1234);
        assert.deepEqual(changed.harmony,song.harmony);
        assert.deepEqual(changed.tracks.slice(1),song.tracks.slice(1));
        assert.equal(changed.progression,progression);
        if (progression !== 'auto') assert.equal(chooseHarmony(song).name,HARMONIES[progression].name);
        paths.add(JSON.stringify(song.harmony.steps));
      }
    assert.ok(paths.size >= 3,progression + ' lacks chord-path variety');
  }
  assert.deepEqual(createProceduralSong(42),createProceduralSong(42,'neutral','sketch','sketch','original','original','original','original'));
  assert.throws(() => createProceduralSong(42,'neutral','sketch','sketch','auto','auto','auto','missing'),/Unknown harmony/);
  const bad = createProceduralSong(42,'neutral','sketch','sketch','original','original','original','auto');
  bad.progression = 'missing';
  assert.throws(() => readSongFile(JSON.stringify({format:'bosstrack-song',v:1,renderer:'song-v1',song:bad})),/Invalid saved harmony/);
});
