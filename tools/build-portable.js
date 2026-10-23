import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { rcedit } from 'rcedit';
import { INSTRUMENTS, addInstruments } from '../engine/song-instruments.js';
import { instrumentBank } from '../engine/song-defaults.js';
import { scanBanks, readPersonalInstruments } from '../main/banks.js';
import { publicProblems } from './tiers.js';

const root = fileURLToPath(new URL('../', import.meta.url));
const runtime = path.join(root, 'node_modules', 'electron', 'dist');
const assets = path.resolve(root, '..', 'assets');
const pkg = JSON.parse(await fs.readFile(path.join(root, 'package.json'), 'utf8'));
const publicBuild = process.argv.includes('--public');
const banks = await scanBanks(assets);
if (!publicBuild) addInstruments(await readPersonalInstruments(assets));
let caches = [...new Set(Object.keys(INSTRUMENTS).map(instrumentBank).filter(Boolean))];
if (publicBuild) {
  const problems = publicProblems(banks);
  if (problems.length) {
    console.error('Public build stopped. These point at private or missing banks:\n' + problems.map(p => '  ' + p).join('\n'));
    process.exit(1);
  }
  caches = caches.filter(cache => banks[cache].tier === 'open');
}
const docs = ['LICENSE', 'NOTICE', 'CREDITS.md'];
for (const name of docs) await fs.access(path.join(root, name));

if (process.platform !== 'win32') throw new Error('Build the portable Windows app on Windows');
await fs.access(path.join(runtime, 'electron.exe'));
await fs.access(path.join(root, 'branding', 'BossTrack.ico'));

const files = [];
for (const cache of caches) {
  const manifest = JSON.parse(await fs.readFile(path.join(assets, cache, 'manifest.json'), 'utf8'));
  const credit = await fs.access(path.join(assets, cache, 'credit.json')).then(() => ['credit.json'], () => []);
  for (const name of ['manifest.json', ...credit, ...manifest.samples.map(s => s.file ?? s.root + '.f32')]) {
    const relative = path.join(cache, name);
    await fs.access(path.join(assets, relative));
    files.push(relative);
  }
}
for (const name of ['personal-defaults.json', 'personal-instruments.json']) {
  if (!publicBuild && await fs.access(path.join(assets, name)).then(() => true, () => false)) files.push(name);
}

await fs.mkdir(path.join(root, 'out'), { recursive: true });
const dest = await fs.mkdtemp(path.join(root, 'out', 'BossTrack-portable-'));
await fs.cp(runtime, dest, { recursive: true });
await fs.rename(path.join(dest, 'electron.exe'), path.join(dest, 'BossTrack.exe'));
await fs.rename(path.join(dest, 'LICENSE'), path.join(dest, 'LICENSE.electron.txt'));
await rcedit(path.join(dest, 'BossTrack.exe'), {
  icon: path.join(root, 'branding', 'BossTrack.ico'),
  'file-version': pkg.version,
  'product-version': pkg.version,
  'version-string': {
    ProductName: pkg.productName, FileDescription: pkg.productName,
    InternalName: pkg.name, OriginalFilename: 'BossTrack.exe',
    CompanyName: 'Ganktronics', LegalCopyright: 'Copyright 2026 Ganktronics', LegalTrademarks: '',
  },
});
await fs.unlink(path.join(dest, 'resources', 'default_app.asar'));
const appDir = path.join(dest, 'resources', 'app');
await fs.mkdir(appDir);
for (const dir of ['main', 'engine', 'src', 'branding']) {
  await fs.cp(path.join(root, dir), path.join(appDir, dir), { recursive: true });
}
await fs.writeFile(path.join(appDir, 'package.json'), JSON.stringify({
  name: pkg.name, productName: pkg.productName, version: pkg.version,
  private: true, type: pkg.type, main: pkg.main, ...(publicBuild && { edition: 'public' }),
}, null, 2) + '\n');

let sampleBytes = 0;
for (const relative of files) {
  const source = path.join(assets, relative);
  const target = path.join(dest, 'resources', 'assets', relative);
  await fs.mkdir(path.dirname(target), { recursive: true });
  await fs.copyFile(source, target);
  const original = await fs.readFile(source);
  const copied = await fs.readFile(target);
  const hash = bytes => createHash('sha256').update(bytes).digest('hex');
  if (hash(original) !== hash(copied)) throw new Error('Copied sample differs: ' + relative);
  sampleBytes += copied.byteLength;
}
await fs.mkdir(path.join(dest, 'sounds', 'music'), { recursive: true });
for (const name of docs) await fs.copyFile(path.join(root, name), path.join(dest, name));
await fs.writeFile(path.join(dest, 'Portable.txt'), (publicBuild ? [
  'Run BossTrack.exe. Node.js is not needed.',
  'Keep this whole folder together in a writable location.',
  'New songs and exports go in sounds/music beside BossTrack.exe.',
  'Settings use %APPDATA%/BossTrack/settings.json.',
] : [
  'Run BossTrack.exe. Node.js is not needed.',
  'Keep this whole folder together in a writable location.',
  'New songs and exports go in sounds/music beside BossTrack.exe.',
  'Settings use %APPDATA%/musicmaker/settings.json, shared with the development app.',
  'Songs saved from source stay in the sounds/music folder next to the app folder.',
  'Use Open Song to open those scores, or copy them into this sounds/music folder.',
  'This private build includes your installed instrument recordings.',
]).concat(
  'BossTrack ' + pkg.version + ' by Ganktronics, https://ganktronics.itch.io',
  'LICENSE and NOTICE cover BossTrack (Apache License 2.0). CREDITS.md lists the sample libraries and their licenses.',
  'LICENSE.electron.txt and LICENSES.chromium.html cover Electron and Chromium.',
).join('\r\n') + '\r\n');
console.log(JSON.stringify({ folder: dest, public: publicBuild, caches: caches.length, sampleFiles: files.length, sampleBytes }, null, 2));
