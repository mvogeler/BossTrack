import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { listSongs, openLibrarySong, updateSongInfo } from '../main/song-library.js';
import { createProceduralSong } from '../engine/song-compose.js';

const saved = () => ({ format: 'bosstrack-song', v: 1, renderer: 'song-v1', song: createProceduralSong(42),
  mix: { muted: [], solo: [], gains: {} }, repeat: false });

test('library finds direct scores and keeps malformed entries visible', async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'library-test-'));
  try {
    assert.deepEqual(await listSongs(path.join(dir, 'missing')), []);
    await fs.writeFile(path.join(dir, 'song.music.json'), JSON.stringify(saved()));
    await fs.writeFile(path.join(dir, 'broken.music.json'), '{');
    await fs.writeFile(path.join(dir, 'other.json'), '{}');
    await fs.mkdir(path.join(dir, 'nested'));
    await fs.writeFile(path.join(dir, 'nested', 'hidden.music.json'), JSON.stringify(saved()));
    const rows = await listSongs(dir);
    assert.equal(rows.length, 2);
    const good = rows.find(row => row.name === 'song.music.json');
    assert.equal(good.title, 'song'); assert.equal(good.seed, 42); assert.equal(good.favorite, false);
    assert.ok(Number.isFinite(good.modified));
    assert.equal(rows.find(row => row.broken).name, 'broken.music.json');
    const opened = await openLibrarySong(dir, good.name);
    assert.deepEqual(opened.song, saved().song); assert.equal(opened.path, good.path);
    for (const name of ['../song.music.json', 'nested/hidden.music.json', 'nested\\hidden.music.json', 'C:song.music.json', 'other.json']) {
      await assert.rejects(openLibrarySong(dir, name), /Invalid library song name/);
      await assert.rejects(updateSongInfo(dir, name, {}), /Invalid library song name/);
    }
    await fs.writeFile(path.join(dir, 'large.music.json'), Buffer.alloc(8388609));
    await assert.rejects(openLibrarySong(dir, 'large.music.json'), /too large/);
  } finally { await fs.rm(dir, { recursive: true }); }
});

test('library metadata edits preserve exact scores and reject invalid updates without changing disk', async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'library-test-')), name = 'song.music.json', target = path.join(dir, name);
  try {
    const file = saved(); file.assets = {}; file.normalizeWav = true;
    await fs.writeFile(target, JSON.stringify(file));
    const library = { title: 'Wash at dusk', favorite: true, tags: ['wash', 'quiet'] };
    const row = await updateSongInfo(dir, name, library);
    assert.equal(row.title, library.title); assert.equal(row.favorite, true); assert.deepEqual(row.tags, library.tags);
    const opened = await openLibrarySong(dir, name); delete opened.path; delete opened.library;
    assert.deepEqual(opened, file);
    const previous = await fs.readFile(target, 'utf8');
    for (const bad of [null, {}, { ...library, title: 'a'.repeat(121) }, { ...library, favorite: 1 },
      { ...library, tags: ['a'.repeat(41)] }, { ...library, tags: Array(13).fill('x') }]) {
      await assert.rejects(updateSongInfo(dir, name, bad));
      assert.equal(await fs.readFile(target, 'utf8'), previous);
    }
    assert.deepEqual(await fs.readdir(dir), [name]);
  } finally { await fs.rm(dir, { recursive: true }); }
});
