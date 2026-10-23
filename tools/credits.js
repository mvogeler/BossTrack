import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { assetsDir, scanBanks, readPersonalInstruments } from '../main/banks.js';
import { addInstruments } from '../engine/song-instruments.js';
import { creditsMarkdown, uncreditedSources } from './tiers.js';

const target = fileURLToPath(new URL('../CREDITS.md', import.meta.url));
addInstruments(await readPersonalInstruments());
const banks = await scanBanks();
const open = Object.entries(banks).filter(([, bank]) => bank.tier === 'open');
const problems = [];
for (const [name, bank] of open) {
  const manifest = JSON.parse(await fs.readFile(path.join(assetsDir, name, 'manifest.json'), 'utf8'));
  for (const source of uncreditedSources(manifest, bank.credit)) problems.push(name + ': ' + source);
}
if (problems.length) {
  console.error('Not written. These samples have no matching credit:\n' + problems.map(p => '  ' + p).join('\n'));
  process.exit(1);
}
await fs.writeFile(target, creditsMarkdown(banks));
console.log('Wrote ' + target + ' from ' + open.length + ' open banks');
