import { app, BrowserWindow, dialog, ipcMain, shell } from 'electron';
import fs from 'node:fs/promises';
import path from 'node:path';
import * as settings from './settings.js';
import { checkName, isInside } from './paths.js';
import { loadPiano, pianoIdentity, hasCache } from './piano.js';
import { scanBanks, readPersonalDefaults, creditGroups } from './banks.js';
import { readSongFile } from '../engine/song-file.js';
import { INSTRUMENTS } from '../engine/song-instruments.js';
import { beginWav, appendWav, finishWav, abortWav } from './song-export.js';
import { beginPreview, appendPreview, finishPreview, readPreview, releasePreview } from './song-preview.js';
import { encodeSongMidi } from '../engine/song-midi.js';
import { beginStems, appendStem, finishStems, abortStems } from './song-stems.js';
import { listSongs, openLibrarySong, updateSongInfo, readLibraryFile } from './song-library.js';

const appDir = app.isPackaged ? path.dirname(process.execPath) : app.getAppPath();
const soundsDir = app.isPackaged ? path.join(appDir, 'sounds') : path.join(appDir, '..', 'sounds');

function checkFolder(folder) {
  const dir = path.resolve(folder);
  const roots = [soundsDir, ...settings.data.folders];
  if (!roots.some((root) => isInside(dir, root))) throw new Error(`Folder not allowed: ${folder}`);
  return dir;
}

async function makeDefault(dir) {
  if (isInside(dir, soundsDir)) await fs.mkdir(dir, { recursive: true });
}

const win = (e) => BrowserWindow.fromWebContents(e.sender);

async function checkSongAssets(file) {
  for (const id of new Set([...Object.keys(file.assets ?? {}), ...file.song.tracks.map(t => t.instrument)])) if (INSTRUMENTS[id]?.sample && await hasCache(id) && file.assets?.[id] !== await pianoIdentity(id)) throw new Error(INSTRUMENTS[id].name + ' cache differs from this saved song');
  return file;
}

async function songAssets(song) {
  const assets = {};
  for (const id of new Set(song.tracks.map(t => t.instrument))) if (INSTRUMENTS[id]?.sample) assets[id] = await pianoIdentity(id);
  return assets;
}

export function registerIpc(personalInstruments) {
  ipcMain.handle('songs:list', () => listSongs(path.join(soundsDir, 'music')));
  ipcMain.handle('songs:open', async (e, name) => checkSongAssets(await openLibrarySong(path.join(soundsDir, 'music'), name)));
  ipcMain.handle('songs:info', (e, name, library) => updateSongInfo(path.join(soundsDir, 'music'), name, library));
  ipcMain.handle('stems:begin', (e, names) => beginStems(e.sender, path.join(soundsDir, 'music'), names));
  ipcMain.handle('stems:chunk', (e, id, name, bytes) => appendStem(e.sender, id, name, bytes));
  ipcMain.handle('stems:finish', (e, id) => finishStems(e.sender, id));
  ipcMain.handle('stems:abort', (e, id) => abortStems(e.sender, id));
  ipcMain.handle('midi:save', async (e, file) => {
    file.assets = await songAssets(file.song);
    const checked = readSongFile(JSON.stringify(file));
    const bytes = encodeSongMidi(checked.song), dir = path.join(soundsDir, 'music');
    await makeDefault(dir);
    let n = 1;
    while (true) {
      const target = path.join(dir, 'song_' + checked.song.seed + '_' + String(n++).padStart(3, '0') + '.mid');
      try { await fs.writeFile(target, bytes, { flag: 'wx' }); return target; }
      catch (error) { if (error.code !== 'EEXIST') throw error; }
    }
  });
  ipcMain.handle('preview:begin', (e, meta) => beginPreview(e.sender, meta));
  ipcMain.handle('preview:chunk', (e, id, part, start, channels) => appendPreview(e.sender, id, part, start, channels));
  ipcMain.handle('preview:finish', (e, id, meta) => finishPreview(e.sender, id, meta));
  ipcMain.handle('preview:read', (e, id, start, count, mix, part) => readPreview(e.sender, id, start, count, mix, part));
  ipcMain.handle('preview:release', (e, id) => releasePreview(e.sender, id));
  ipcMain.handle('wav:begin', async (e, folder, name) => {
    const dir = checkFolder(folder); await makeDefault(dir);
    return beginWav(e.sender, path.join(dir, checkName(name)));
  });
  ipcMain.handle('wav:chunk', (e, id, bytes) => appendWav(e.sender, id, bytes));
  ipcMain.handle('wav:finish', (e, id) => finishWav(e.sender, id));
  ipcMain.handle('wav:abort', (e, id) => abortWav(e.sender, id));
  ipcMain.handle('settings:load', () => settings.data.ui);
  ipcMain.handle('settings:save', (e, ui) => settings.setUi(ui));
  ipcMain.handle('paths:sounds', () => soundsDir);
  ipcMain.handle('piano:samples', (e, notes, id) => loadPiano(notes, id));
  ipcMain.handle('banks:scan', async () => {
    const banks = await scanBanks();
    return { tiers: Object.fromEntries(Object.entries(banks).map(([name, bank]) => [name, bank.tier])), personalDefaults: await readPersonalDefaults(), personalInstruments };
  });
  ipcMain.handle('about:info', async () => {
    const read = name => fs.readFile(path.join(appDir, name), 'utf8').catch(err => { if (err.code === 'ENOENT') return null; throw err; });
    return { version: app.getVersion(), license: await read('LICENSE'), notice: await read('NOTICE'), credits: creditGroups(await scanBanks()) };
  });
  ipcMain.handle('link:open', (e, url) => {
    if (new URL(url).protocol !== 'https:') throw new Error('Not a web link: ' + url);
    return shell.openExternal(url);
  });
  ipcMain.handle('song:save', async (e, file) => {
    file.assets = await songAssets(file.song);
    const text = JSON.stringify(file, null, 2);
    readSongFile(text);
    const dir = path.join(soundsDir, 'music');
    await makeDefault(dir);
    let n = 1;
    let name;
    do { name = 'song_' + file.song.seed + '_' + String(n++).padStart(3, '0') + '.music.json'; }
    while (await fs.access(path.join(dir, name)).then(() => true, () => false));
    const target = path.join(dir, name);
    await fs.writeFile(target, text, { flag: 'wx' });
    return target;
  });
  ipcMain.handle('song:open', async (e) => {
    const res = await dialog.showOpenDialog(win(e), { defaultPath: path.join(soundsDir, 'music'),
      properties: ['openFile'], filters: [{ name: 'BossTrack song', extensions: ['json'] }] });
    if (res.canceled) return null;
    const target = res.filePaths[0];
    const file = await checkSongAssets(await readLibraryFile(target));
    return { ...file, path: target };
  });

  ipcMain.handle('folder:open', async (e, folder) => {
    const dir = checkFolder(folder);
    await makeDefault(dir);
    const err = await shell.openPath(dir);
    if (err) throw new Error(err);
  });

  ipcMain.handle('file:exists', async (e, folder, name) => {
    const file = path.join(checkFolder(folder), checkName(name));
    return fs.access(file).then(() => true, () => false);
  });

}
