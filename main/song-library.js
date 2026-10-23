import fs from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { readSongFile } from '../engine/song-file.js';

function songPath(dir, name) {
  if (typeof name !== 'string' || !name.endsWith('.music.json') || /[\\/:\0]/.test(name) || name === '.music.json') throw new Error('Invalid library song name');
  return path.join(dir, name);
}

export async function readLibraryFile(target) {
  const stat = await fs.lstat(target);
  if (!stat.isFile() || stat.isSymbolicLink()) throw new Error('Library song must be a regular file');
  if (stat.size > 8388608) throw new Error('Song file is too large');
  return readSongFile(await fs.readFile(target, 'utf8'));
}

function row(target, file, modified) {
  const song = file.song;
  return { name: path.basename(target), path: target, title: file.library?.title || path.basename(target, '.music.json'),
    genre: song.genre || 'original', seed: song.seed, form: song.form || 'sketch', bars: song.bars, tempo: song.tempo,
    modified, favorite: file.library?.favorite || false, tags: file.library?.tags || [] };
}

export async function listSongs(dir) {
  let entries;
  try { entries = await fs.readdir(dir, { withFileTypes: true }); }
  catch (error) { if (error.code === 'ENOENT') return []; throw error; }
  const rows = [];
  for (const entry of entries.filter(e => (e.isFile() || e.isSymbolicLink()) && e.name.endsWith('.music.json'))) {
    const target = path.join(dir, entry.name);
    try {
      songPath(dir, entry.name);
      const file = await readLibraryFile(target), stat = await fs.stat(target);
      rows.push(row(target, file, stat.mtimeMs));
    } catch (error) {
      rows.push({ name: entry.name, path: target, title: entry.name.slice(0, -11), favorite: false, tags: [], broken: true, error: error.message, modified: 0 });
    }
  }
  return rows.sort((a, b) => b.modified - a.modified || a.name.localeCompare(b.name));
}

export async function openLibrarySong(dir, name) {
  const target = songPath(dir, name);
  return { ...await readLibraryFile(target), path: target };
}

export async function updateSongInfo(dir, name, library) {
  if (library === undefined) throw new Error('Invalid saved library information');
  const target = songPath(dir, name), file = await readLibraryFile(target);
  file.library = library;
  const text = JSON.stringify(file, null, 2);
  readSongFile(text);
  if (Buffer.byteLength(text) > 8388608) throw new Error('Song file is too large');
  const temporary = path.join(dir, '.' + randomUUID() + '.tmp');
  try {
    await fs.writeFile(temporary, text, { flag: 'wx' });
    await fs.rename(temporary, target);
  }
  finally { await fs.rm(temporary, { force: true }); }
  return row(target, file, (await fs.stat(target)).mtimeMs);
}
