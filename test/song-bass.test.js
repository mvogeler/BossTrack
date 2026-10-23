import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createProceduralSong, rerollPart } from '../engine/song-compose.js';
import { BASS, chooseBass } from '../engine/song-bass.js';
import { readSongFile } from '../engine/song-file.js';

test('bass families vary their role while preserving the other three parts', () => {
  for (const bass of Object.keys(BASS).filter(id => id !== 'original')) {
    const shapes = new Set();
    for (let seed = 0; seed < 10; seed++) for (const feeling of ['neutral','cozy','tense','uplifting'])
      for (const use of ['sketch','menu','combat']) for (const form of ['sketch','song','loop']) {
        const args = [seed, feeling, use, form, 'auto', 'auto'];
        const song = createProceduralSong(...args, bass);
        const old = createProceduralSong(...args);
        for (const i of [0,1,3]) assert.deepEqual(song.tracks[i], old.tracks[i]);
        assert.deepEqual(song, createProceduralSong(...args, bass));
        assert.ok(song.tracks[2].notes.every(n => song.harmony.scale.some(p => p % 12 === n.midi % 12)));
        assert.deepEqual(readSongFile(JSON.stringify({format:'bosstrack-song',v:1,renderer:'song-v1',song,
          mix:{muted:[],solo:[],gains:{}},repeat:false})).song, song);
        const changed = rerollPart(song,'bass',1234);
        for (const i of [0,1,3]) assert.deepEqual(changed.tracks[i],song.tracks[i]);
        assert.equal(changed.bass,bass);
        if (bass !== 'auto') assert.equal(chooseBass(changed,1234).name,BASS[bass].name);
        if (feeling === 'neutral' && use === 'sketch' && form === 'sketch')
          shapes.add(JSON.stringify(song.tracks[2].notes.map(n => [n.tick,n.midi-song.harmony.root])));
      }
    assert.ok(shapes.size >= 2, bass + ' lacks seeded timing variation');
  }
  const held = createProceduralSong(42,'cozy','sketch','sketch','original','drive','held');
  assert.ok(held.tracks[2].notes.length < held.tracks[3].notes.filter(n => n.midi === 36).length);
  assert.ok(held.tracks[2].notes.some(n => n.len > 960));
  assert.deepEqual(createProceduralSong(42),createProceduralSong(42,'neutral','sketch','sketch','original','original','original'));
  assert.throws(() => createProceduralSong(42,'neutral','sketch','sketch','auto','auto','missing'),/Unknown bass/);
  const bad = createProceduralSong(42,'neutral','sketch','sketch','original','original','auto');
  bad.bass = 'missing';
  assert.throws(() => readSongFile(JSON.stringify({format:'bosstrack-song',v:1,renderer:'song-v1',song:bad})),/Invalid saved bass/);
});
