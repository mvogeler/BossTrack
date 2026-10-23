import { INSTRUMENTS } from '../engine/song-instruments.js';
import { GENRES } from '../engine/song-genres.js';
import { INSTRUMENT_POOLS } from '../engine/song-instrument-pools.js';
import { CUE_PROFILES } from '../engine/song-cues.js';
import { instrumentBank } from '../engine/song-defaults.js';
import { creditGroups } from '../main/banks.js';

export function exposedInstruments() {
  const uses = [];
  for (const [genre, g] of Object.entries(GENRES)) for (const [part, id] of Object.entries(g.instruments ?? {})) uses.push({ id, where: 'GENRES.' + genre + '.' + part });
  for (const [genre, pool] of Object.entries(INSTRUMENT_POOLS)) for (const [part, ids] of Object.entries(pool)) for (const id of ids) uses.push({ id, where: 'INSTRUMENT_POOLS.' + genre + '.' + part });
  const walk = (value, where) => {
    if (!value || typeof value !== 'object') return;
    if (typeof value.instrument === 'string') uses.push({ id: value.instrument, where });
    for (const [key, child] of Object.entries(value)) walk(child, where + '.' + key);
  };
  walk(CUE_PROFILES, 'CUE_PROFILES');
  return uses;
}

export function publicProblems(banks) {
  const problems = [];
  for (const { id, where } of exposedInstruments()) {
    const bank = instrumentBank(id);
    if (bank && banks[bank]?.tier !== 'open') problems.push(where + ': ' + id + ' uses ' + bank + ' (' + (banks[bank]?.tier ?? 'missing') + ')');
  }
  for (const id of Object.keys(INSTRUMENTS)) {
    const bank = instrumentBank(id);
    if (bank && !banks[bank]) problems.push('INSTRUMENTS.' + id + ': ' + bank + ' is missing');
  }
  return [...new Set(problems)];
}

const sourceLinks = source => [source].flat().map(url => /^https?:/.test(url) ? '<' + url + '>' : url).join(', ');

const origin = url => url.match(/^https:\/\/(?:raw\.githubusercontent\.com|github\.com)\/([^/]+\/[^/]+)\/(?:tree\/)?([0-9a-f]{40})(?:\/|$)/)?.slice(1).join('@')
  ?? url.match(/^https:\/\/freesound\.org\/people\/[^/]+\/sounds\/\d+/)?.[0] ?? url;

export function uncreditedSources(manifest, credit) {
  const credited = new Set([credit].flat().flatMap(c => [c.source].flat()).map(origin));
  const missing = [];
  for (const sample of manifest.samples) {
    const urls = [sample.source ?? []].flat().map(s => typeof s === 'string' ? s : s.url);
    if (!urls.length) missing.push((sample.file ?? sample.root + '.f32') + ' has no source');
    for (const url of urls) if (!credited.has(origin(url))) missing.push(url);
  }
  return [...new Set(missing)];
}

export function creditsMarkdown(banks) {
  const lines = ['# Credits', '', 'BossTrack ships these sample recordings. Everything else, including the synthesized instruments, is part of BossTrack itself.', ''];
  for (const group of creditGroups(banks)) {
    lines.push('## ' + group.heading, '', '- Maker: ' + group.maker, '- Website: <' + group.website + '>', '- Source: ' + sourceLinks(group.source),
      '- License: [' + group.license + '](' + group.licenseUrl + ')', '', '| Bank | Used by |', '|---|---|');
    for (const bank of group.banks) {
      const used = bank.instruments.length ? bank.instruments.join(', ') : 'No instrument yet';
      lines.push('| `' + bank.name + '` | ' + used + (bank.note ? ' (' + bank.note + ')' : '') + ' |');
    }
    lines.push('');
  }
  return lines.join('\n');
}
