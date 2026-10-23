import { app, BrowserWindow } from 'electron';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { registerIpc } from './ipc.js';
import { readPersonalInstruments } from './banks.js';
import { addInstruments } from '../engine/song-instruments.js';
import * as settings from './settings.js';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');

function createWindow() {
  const win = new BrowserWindow({
    show: false,
    width: 1280,
    height: 800,
    minWidth: 1280,
    minHeight: 800,
    backgroundColor: '#f5f2ed',
    icon: path.join(root, 'branding', 'BossTrack.ico'),
    autoHideMenuBar: true,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      preload: path.join(root, 'main', 'preload.cjs'),
    },
  });
  win.loadFile(path.join(root, 'src', 'music.html'));
  return win;
}

function showSplash(win) {
  const splash = new BrowserWindow({
    width: 720,
    height: 405,
    frame: false,
    resizable: false,
    show: false,
    backgroundColor: '#292f30',
    icon: path.join(root, 'branding', 'BossTrack.ico'),
    webPreferences: { contextIsolation: true, nodeIntegration: false, sandbox: true },
  });
  splash.once('ready-to-show', () => splash.show());
  const ready = new Promise(resolve => win.once('ready-to-show', resolve));
  splash.on('closed', () => ready.then(() => win.show()));
  splash.loadFile(path.join(root, 'src', 'splash.html'), { query: { version: app.getVersion() } });
}

app.whenReady().then(async () => {
  settings.load();
  const instruments = await readPersonalInstruments();
  addInstruments(instruments);
  registerIpc(instruments);
  showSplash(createWindow());
});

app.on('window-all-closed', () => app.quit());
