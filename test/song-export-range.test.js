import { test } from 'node:test';
import assert from 'node:assert/strict';
import { exportFrames, exportReader, exportLoop } from '../engine/song-export-range.js';
import { createProceduralSong } from '../engine/song-compose.js';
import { readSongFile } from '../engine/song-file.js';

test('exact exports crop with a shared fade, pad silence and keep the preview unchanged', async () => {
  const source = [Float32Array.from({ length: 100 }, () => .5), Float32Array.from({ length: 100 }, () => -.25)];
  const read = async (at, count) => source.map(ch => ch.subarray(at, at + count));
  const cropped = exportReader(read, 100, 75, 20);
  const full = await cropped(0, 75), blocks = [new Float32Array(75), new Float32Array(75)];
  for (let at = 0; at < 75; at += 17) (await cropped(at, 17)).forEach((ch,c) => blocks[c].set(ch,at));
  assert.deepEqual(blocks, full); assert.equal(full[0][74], 0); assert.equal(full[0][64], .5);
  assert.equal(source[0][74], .5);
  const padded = await exportReader(read, 100, 130, 20)(90, 40);
  assert.equal(padded[0][9], 0); assert.ok(padded.every(ch => ch.subarray(10).every(x => x === 0)));
  assert.equal((await exportReader(read,100,100,20)(90,10))[0][9], .5);
  assert.equal((await exportReader(read,100,100,20,5)(90,10))[0][9], 0);
  assert.equal(exportFrames(100, 44100, 1.234), 54419); assert.equal(exportFrames(100, 44100), 100);
  assert.equal(exportLoop({ start: 0, end: 100 },100,100,5), null);
  assert.deepEqual(exportLoop({ start: 0, end: 100 },100,100), { start: 0, end: 100 });
});

test('library and exact-duration metadata reopen and reject malformed fields', () => {
  const make = () => ({ format: 'bosstrack-song', v: 1, renderer: 'song-v1', song: createProceduralSong(42),
    mix: { muted: [], solo: [], gains: {} }, repeat: false, exportSeconds: 30.125,
    library: { title: 'Wash menu', favorite: true, tags: ['calm', 'wash'] } });
  const file = make(); assert.deepEqual(readSongFile(JSON.stringify(file)), file);
  for (const change of [f => f.exportSeconds = 0, f => f.exportSeconds = '30', f => f.exportSeconds = 901,
    f => f.library = null, f => f.library.favorite = 1, f => f.library.title = 'x'.repeat(121),
    f => f.library.tags = ['calm','calm'], f => f.library.tags = [''], f => f.library.extra = true]) {
    const bad = make(); change(bad); assert.throws(() => readSongFile(JSON.stringify(bad)), /duration|library/);
  }
});
