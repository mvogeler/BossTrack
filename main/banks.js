import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { INSTRUMENTS } from '../engine/song-instruments.js';
import { instrumentBank } from '../engine/song-defaults.js';

export const assetsDir = fileURLToPath(new URL('../../assets/', import.meta.url));

export async function readCredit(folder, manifest) {
  try { return JSON.parse(await fs.readFile(path.join(folder, 'credit.json'), 'utf8')); }
  catch (err) { if (err.code !== 'ENOENT') throw err; }
  return manifest.credit && typeof manifest.credit === 'object' ? manifest.credit : null;
}

export async function scanBanks(dir = assetsDir) {
  let entries;
  try { entries = await fs.readdir(dir, { withFileTypes: true }); }
  catch (err) { if (err.code === 'ENOENT') return {}; throw err; }
  const banks = {};
  for (const entry of entries.filter(e => e.isDirectory())) {
    const folder = path.join(dir, entry.name);
    let manifest;
    try { manifest = JSON.parse(await fs.readFile(path.join(folder, 'manifest.json'), 'utf8')); }
    catch (err) { if (err.code === 'ENOENT' || err instanceof SyntaxError) continue; throw err; }
    const credit = await readCredit(folder, manifest);
    const credits = [credit ?? {}].flat();
    banks[entry.name] = { tier: credits.length && credits.every(c => c.tier === 'open') ? 'open' : 'private', credit };
  }
  return banks;
}

export function creditGroups(banks) {
  const users = {};
  for (const [id, instrument] of Object.entries(INSTRUMENTS)) {
    const bank = instrumentBank(id);
    if (bank) (users[bank] ??= []).push(instrument.name);
  }
  const groups = new Map();
  for (const [name, bank] of Object.entries(banks).sort(([a], [b]) => a.localeCompare(b))) {
    if (bank.tier !== 'open') continue;
    for (const { library, title, maker, website, source, license, licenseUrl, note } of [bank.credit].flat()) {
      const key = JSON.stringify([library, title, maker, website, source, license, licenseUrl]);
      const heading = library + (title ? ': "' + title + '"' : '');
      if (!groups.has(key)) groups.set(key, { heading, maker, website, source, license, licenseUrl, banks: [] });
      groups.get(key).banks.push({ name, note, instruments: users[name] ?? [] });
    }
  }
  return [...groups.values()].sort((a, b) => a.heading.localeCompare(b.heading));
}

async function readPersonal(dir, name) {
  try { return JSON.parse(await fs.readFile(path.join(dir, name), 'utf8')); }
  catch (err) { if (err.code === 'ENOENT') return {}; throw err; }
}

export const readPersonalDefaults = (dir = assetsDir) => readPersonal(dir, 'personal-defaults.json');

export const readPersonalInstruments = (dir = assetsDir) => readPersonal(dir, 'personal-instruments.json');
