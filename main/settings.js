import { app } from 'electron';
import fs from 'node:fs';
import path from 'node:path';

const userData = app.getPath('userData');
const edition = JSON.parse(fs.readFileSync(path.join(app.getAppPath(), 'package.json'), 'utf8')).edition;
const store = edition !== 'public' && ['BossTrack', 'bosstrack'].includes(path.basename(userData)) ? path.join(app.getPath('appData'), 'musicmaker') : userData;
const file = path.join(store, 'settings.json');

export const data = { ui: {}, folders: [] };

export function load() {
  try {
    Object.assign(data, JSON.parse(fs.readFileSync(file, 'utf8')));
  } catch (err) {
    if (err.code !== 'ENOENT') console.error('settings.json unreadable, starting fresh:', err.message);
  }
}

function save() {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(data, null, 2));
}

export function setUi(ui) {
  data.ui = ui;
  save();
}
