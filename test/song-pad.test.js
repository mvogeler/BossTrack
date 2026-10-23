import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createProceduralSong, rerollPart } from '../engine/song-compose.js';
import { PADS, choosePad } from '../engine/song-pad.js';
import { readSongFile } from '../engine/song-file.js';
import { renderSong } from '../engine/song-render.js';

test('pad families change accompaniment while preserving harmony and other parts', () => {
  for (const pad of Object.keys(PADS).filter(id => id !== 'original'))
    for (let seed = 0; seed < 10; seed++) for (const feeling of ['neutral','cozy','tense','uplifting'])
      for (const use of ['sketch','menu','combat']) for (const form of ['sketch','song','loop']) {
        const args = [seed,feeling,use,form,'auto','auto','auto','auto'];
        const song = createProceduralSong(...args,pad);
        const old = createProceduralSong(...args);
        assert.deepEqual(song.harmony,old.harmony);
        for (const i of [0,2,3]) assert.deepEqual(song.tracks[i],old.tracks[i]);
        assert.deepEqual(song,createProceduralSong(...args,pad));
        assert.ok(song.tracks[1].notes.every(n => song.harmony.scale.some(p => p % 12 === n.midi % 12)));
        assert.deepEqual(readSongFile(JSON.stringify({format:'bosstrack-song',v:1,renderer:'song-v1',song,
          mix:{muted:[],solo:[],gains:{}},repeat:false})).song,song);
        const changed = rerollPart(song,'pad',1234);
        for (const i of [0,2,3]) assert.deepEqual(changed.tracks[i],song.tracks[i]);
        assert.equal(changed.pad,pad);
        if (pad !== 'auto') assert.equal(choosePad(changed,1234).name,PADS[pad].name);
      }
});

test('pad rhythms differ, short notes render cleanly and invalid choices are rejected', () => {
  const shapes = new Set();
  for (const pad of Object.keys(PADS).slice(2)) {
    const song = createProceduralSong(42,'cozy','sketch','sketch','original','original','original','warm',pad);
    shapes.add(JSON.stringify(song.tracks[1].notes.map(n => [n.tick,n.len,n.midi])));
    const audio = renderSong({...song,tracks:[song.tracks[1]]});
    assert.ok(audio.channels.every(ch => ch.every(v => Number.isFinite(v) && Math.abs(v) <= 0.801)));
  }
  assert.equal(shapes.size,8);
  assert.deepEqual(createProceduralSong(42),createProceduralSong(42,'neutral','sketch','sketch','original','original','original','original','original'));
  assert.throws(() => createProceduralSong(42,'neutral','sketch','sketch','auto','auto','auto','auto','missing'),/Unknown pad/);
  const bad = createProceduralSong(42,'neutral','sketch','sketch','original','original','original','original','stabs');
  const single = { ...bad, tracks: [{ ...bad.tracks[1], notes: [bad.tracks[1].notes[0]] }] };
  const short = renderSong(single);
  assert.ok(short.channels[0].subarray(short.sampleRate * 0.3).every(v => v === 0));
  const smooth = structuredClone(single);
  delete smooth.tracks[0].notes[0].articulation;
  const long = renderSong(smooth);
  assert.ok(long.channels[0].subarray(long.sampleRate * 0.3).some(v => v !== 0));
  bad.tracks[1].notes[0].articulation = 'unknown';
  assert.throws(() => readSongFile(JSON.stringify({format:'bosstrack-song',v:1,renderer:'song-v1',song:bad})),/Invalid saved notes/);
});
