import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { createProceduralSong, addPart, keepPartLayout } from '../engine/song-compose.js';
import { GENRES } from '../engine/song-genres.js';
import { INSTRUMENTS, PARTS, swapInstrument, addInstruments } from '../engine/song-instruments.js';
import { instrumentChoices, selectPartInstrument, generateChoices } from '../engine/song-controls.js';
import { genreDefault, installedSong, instrumentBank, instrumentReady, mergeGenreDefaults, captureGenreDefault, validGenreDefault, personalOptions, cueInstrument } from '../engine/song-defaults.js';
import { INSTRUMENT_POOLS } from '../engine/song-instrument-pools.js';
import { assetsDir, scanBanks, readPersonalDefaults, readPersonalInstruments } from '../main/banks.js';
import { creditsMarkdown, publicProblems, exposedInstruments, uncreditedSources } from '../tools/tiers.js';

const personalInstruments = await readPersonalInstruments();
addInstruments(personalInstruments);
const make = (seed, genre, options) => createProceduralSong(seed, 'neutral', 'sketch', 'sketch', 'auto', 'auto', 'auto', 'auto', 'auto', null, null, null, null, genre, options);
const noEpiano = new Set(Object.keys(INSTRUMENTS).map(instrumentBank).filter(b => b && b !== 'open-fm-epiano'));

test('genre defaults: built-in, then personal file, then settings, part by part', () => {
  assert.deepEqual(genreDefault('neon', 'keys'), { instrument: 'neon_lead', effects: GENRES.neon.effects.keys });
  const personal = { lofi: { instruments: { keys: 'felt_keys', bass: 'sub_bass' }, effects: { keys: { tone: { mix: 1, cut: 0.5, warmth: 0.2 } } } } };
  const saved = { lofi: { instruments: { keys: 'vibraphone' } } };
  const personalOnly = { genreDefaults: mergeGenreDefaults(personal, {}) };
  assert.equal(genreDefault('lofi', 'keys', personalOnly).instrument, 'felt_keys');
  assert.deepEqual(genreDefault('lofi', 'keys', personalOnly).effects, personal.lofi.effects.keys);
  assert.equal(genreDefault('lofi', 'bass', personalOnly).effects, undefined);
  assert.equal(genreDefault('lofi', 'pad', personalOnly).instrument, GENRES.lofi.instruments.pad);
  const both = { genreDefaults: mergeGenreDefaults(personal, saved) };
  assert.equal(genreDefault('lofi', 'keys', both).instrument, 'vibraphone');
  assert.equal(genreDefault('lofi', 'bass', both).instrument, GENRES.lofi.instruments.bass);
  assert.equal(genreDefault('original', 'pad').instrument, 'pad');
  const song = make(42, 'lofi', both);
  assert.equal(song.tracks.find(t => t.id === 'keys').instrument, 'vibraphone');
  assert.equal(addPart(song, 'keys', 7).tracks.at(-1).instrument, 'vibraphone');
  const bare = { ...song, tracks: song.tracks.filter(t => t.id !== 'drums') };
  assert.equal(addPart(bare, 'drums', 7, both).tracks.at(-1).instrument, GENRES.lofi.instruments.drums);
  const layout = keepPartLayout(make(42, 'lofi', both), { trackLayout: 'multi-v1', tracks: [...song.tracks, { id: 'keys-2', part: 'keys', notes: [] }] }, both);
  assert.equal(layout.tracks.find(t => t.id === 'keys-2').instrument, 'vibraphone');
});

test('a manual or locked instrument still beats the genre default', () => {
  const options = { genreDefaults: { lofi: { instruments: { keys: 'vibraphone' } } } };
  const picked = swapInstrument(make(42, 'lofi', options), 'keys', 'felt_keys');
  const next = generateChoices(make(43, 'lofi', options), picked, { ...options, locks: { keys: { instrument: true } } });
  assert.equal(next.tracks.find(t => t.id === 'keys').instrument, 'felt_keys');
});

test('captured genre defaults round trip through the resolver', () => {
  const song = make(42, 'neon');
  const entry = captureGenreDefault(song);
  assert.ok(validGenreDefault(entry));
  assert.ok(!validGenreDefault({ instruments: { keys: 'sub_bass' } }));
  assert.ok(!validGenreDefault({ instruments: {}, effects: { keys: { reverb: { mix: 3 } } } }));
  assert.deepEqual(make(42, 'neon', { genreDefaults: { neon: entry } }), song);
});

test('missing banks drop out of menus, vary picks and defaults', () => {
  assert.ok(instrumentReady('fm_epiano'));
  assert.ok(!instrumentReady('fm_epiano', noEpiano));
  assert.ok(instrumentReady('analog_lead', new Set()));
  const song = make(42, 'lofi');
  const keys = song.tracks.find(t => t.id === 'keys');
  assert.ok(instrumentChoices(song, keys).instruments.includes('fm_epiano'));
  const choices = instrumentChoices(song, keys, { available: noEpiano, favorites: ['fm_epiano'], favoritesOnly: true });
  assert.ok(!choices.instruments.includes('fm_epiano'));
  assert.ok(choices.favoritesFallback);
  for (let seed = 0; seed < 30; seed++) {
    const picked = selectPartInstrument({ ...song, seed }, keys, { varyInstruments: true, available: noEpiano });
    assert.notEqual(picked.instrument, 'fm_epiano');
  }
  const fresh = make(42, 'lofi', { available: noEpiano });
  assert.equal(fresh.tracks.find(t => t.id === 'keys').instrument, 'keys');
  assert.equal(fresh.tracks.find(t => t.id === 'pad').instrument, 'pad');
  const own = { genreDefaults: { lofi: { instruments: { bass: 'finger_bass' } } }, available: new Set([...noEpiano].filter(b => b !== 'open-finger-bass')) };
  assert.equal(genreDefault('lofi', 'bass', own).instrument, GENRES.lofi.instruments.bass);
});

test('a song that needs a missing bank swaps to the genre default and says which', () => {
  const song = make(42, 'lofi');
  assert.deepEqual(installedSong(song), { song, swapped: [] });
  const options = { available: noEpiano, genreDefaults: { lofi: { instruments: { keys: 'vibraphone' } } } };
  const { song: next, swapped } = installedSong(song, options);
  assert.deepEqual(swapped, [{ id: 'keys', from: 'fm_epiano', to: 'vibraphone' }, { id: 'pad', from: 'fm_epiano_chords', to: 'pad' }]);
  assert.equal(next.tracks.find(t => t.id === 'keys').instrument, 'vibraphone');
  assert.deepEqual(next.tracks.find(t => t.id === 'bass'), song.tracks.find(t => t.id === 'bass'));
  assert.equal(next.tracks.find(t => t.id === 'pad').notes.length, song.tracks.find(t => t.id === 'pad').notes.length);
  const cue = createProceduralSong(1, 'neutral', 'menu', 'loop', 'auto', 'auto', 'auto', 'auto', 'auto', null, null, null, null, 'watercolor_a2');
  const fixed = installedSong(cue, { available: new Set() });
  assert.ok(fixed.swapped.length);
  assert.ok(fixed.song.tracks.every(t => !INSTRUMENTS[t.instrument].sample));
});

test('bank scan reads credit.json or a manifest credit object, and credits list open banks only', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'bosstrack-banks-'));
  const bank = (name, manifest, credit) => {
    fs.mkdirSync(path.join(dir, name));
    fs.writeFileSync(path.join(dir, name, 'manifest.json'), JSON.stringify({ sampleRate: 44100, samples: [], ...manifest }));
    if (credit) fs.writeFileSync(path.join(dir, name, 'credit.json'), JSON.stringify(credit));
  };
  const open = { tier: 'open', library: 'Test Library', maker: 'Someone', website: 'https://example.com', source: 'https://example.com/repo/tree/abc', license: 'CC0-1.0', licenseUrl: 'https://creativecommons.org/publicdomain/zero/1.0/' };
  bank('bank-vsco-upright', { credit: 'old text credit' }, open);
  bank('open-test', { credit: { ...open, library: 'Inline Library' } });
  bank('bank-private-keys', { credit: 'Local' }, { ...open, tier: 'private', library: 'Local Library', license: 'Personal use only' });
  bank('no-credit', {});
  bank('open-mixed', {}, [open, { ...open, library: 'Freesound', title: 'Some sound', maker: 'someone else', note: 'HQ preview' }]);
  bank('open-half', {}, [open, { ...open, tier: 'private' }]);
  bank('open-fm-epiano', {}, { ...open, tier: 'private' });
  fs.mkdirSync(path.join(dir, 'empty'));
  fs.mkdirSync(path.join(dir, 'half-written'));
  fs.writeFileSync(path.join(dir, 'half-written', 'manifest.json'), '{"samples": [');
  const banks = await scanBanks(dir);
  assert.deepEqual(Object.fromEntries(Object.entries(banks).map(([k, v]) => [k, v.tier])),
    { 'bank-private-keys': 'private', 'bank-vsco-upright': 'open', 'no-credit': 'private', 'open-test': 'open', 'open-mixed': 'open', 'open-half': 'private', 'open-fm-epiano': 'private' });
  assert.deepEqual(await readPersonalDefaults(dir), {});
  assert.deepEqual(await readPersonalInstruments(dir), {});
  const text = creditsMarkdown(banks);
  assert.match(text, /## Test Library/);
  assert.match(text, /## Inline Library/);
  assert.match(text, /\| `bank-vsco-upright` \| Recorded upright piano, Recorded upright piano chords \|/);
  assert.match(text, /\[CC0-1\.0\]\(https:\/\/creativecommons\.org\/publicdomain\/zero\/1\.0\/\)/);
  assert.match(text, /## Test Library\n[^#]*`open-mixed`/);
  assert.match(text, /## Freesound: "Some sound"\n\n- Maker: someone else[^#]*\| `open-mixed` \| No instrument yet \(HQ preview\) \|/);
  assert.doesNotMatch(text, /private-keys|Personal use|open-half|open-fm-epiano/);
  const problems = publicProblems(banks);
  assert.ok(problems.includes('GENRES.lofi.keys: fm_epiano uses open-fm-epiano (private)'));
  assert.ok(problems.includes('GENRES.cozy.bass: upright_bass uses open-upright-bass (missing)'));
  fs.rmSync(dir, { recursive: true });
});

test('sample sources match a credit whatever shape the build script wrote', () => {
  const commit = 'c'.repeat(40), raw = 'https://raw.githubusercontent.com/a/drums/' + commit + '/kick.flac';
  const credit = [{ source: 'https://github.com/a/drums/tree/' + commit }, { source: ['https://freesound.org/people/x/sounds/12/'] }];
  const other = 'https://raw.githubusercontent.com/a/drums/' + 'd'.repeat(40) + '/hat.flac';
  const manifest = { samples: [
    { root: 36, source: raw },
    { root: 38, source: [{ url: raw }, { url: 'https://freesound.org/people/x/sounds/12/', file: 'https://cdn.freesound.org/previews/0/12-hq.ogg' }] },
    { root: 42, source: [other] },
    { root: 44, file: '44.f32' },
    { root: 46, source: 'D:/Samples/kick.wav' },
  ] };
  assert.deepEqual(uncreditedSources(manifest, credit), [other, '44.f32 has no source', 'D:/Samples/kick.wav']);
});

test('personal pools and cue swaps replace the built-in ones only where installed', () => {
  const file = { genres: { lofi: { instruments: { keys: 'steinway_piano' } }, nope: { instruments: {} } },
    pools: { lofi: { keys: ['steinway_piano', 'felt_keys'], bass: ['steinway_piano'] } },
    cues: { watercolor_b2: { analog_pad: 'upright_chords', vinyl_crackle: 'drums_jazz_kit' }, lofi: { fm_epiano: 'steinway_piano' } } };
  const options = personalOptions(file);
  assert.deepEqual(options, { genreDefaults: { lofi: file.genres.lofi }, pools: { lofi: { keys: ['steinway_piano', 'felt_keys'] } }, cues: { watercolor_b2: { analog_pad: 'upright_chords' } } });
  assert.deepEqual(personalOptions(), { genreDefaults: {}, pools: {}, cues: {} });
  const song = make(42, 'lofi', options);
  const keys = song.tracks.find(t => t.id === 'keys');
  assert.equal(keys.instrument, 'steinway_piano');
  assert.deepEqual(instrumentChoices(song, keys, options).instruments, ['steinway_piano', 'felt_keys']);
  assert.ok(instrumentChoices(song, keys).instruments.includes('fm_epiano'));
  assert.equal(cueInstrument('watercolor_b2', 'analog_pad', options), 'upright_chords');
  assert.equal(cueInstrument('watercolor_b2', 'analog_pad', { ...options, available: new Set() }), 'analog_pad');
  const cue = opts => createProceduralSong(1, 'neutral', 'sketch', 'loop', 'auto', 'auto', 'auto', 'auto', 'auto', null, null, null, null, 'watercolor_b2', opts);
  assert.equal(cue(options).tracks.find(t => t.id === 'pad').instrument, 'upright_chords');
  assert.equal(cue().tracks.find(t => t.id === 'pad').instrument, 'analog_pad');
});

const golden = process.env.BOSSTRACK_GOLDEN;
const personalFile = path.join(assetsDir, 'personal-defaults.json');
const goldenSongs = golden && fs.existsSync(golden) ? JSON.parse(fs.readFileSync(golden, 'utf8')) : null;
const composeGolden = (key, options) => {
  const [genre, seed, use] = key.split('/');
  const a = genre === 'original' ? 'original' : 'auto';
  return JSON.parse(JSON.stringify(createProceduralSong(Number(seed), 'neutral', use, 'loop', a, a, a, a, a, null, null, null, null, genre, options)));
};

test('golden songs come out the same with personal-defaults.json', { skip: (!goldenSongs || !fs.existsSync(personalFile) || !personalInstruments.instruments) && 'BOSSTRACK_GOLDEN, personal defaults or personal instruments not found' }, () => {
  const file = JSON.parse(fs.readFileSync(personalFile, 'utf8'));
  for (const [genre, entry] of Object.entries(file.genres)) {
    assert.ok(validGenreDefault(entry), genre);
    for (const part of PARTS) assert.ok(entry.instruments[part], genre + ' ' + part);
  }
  const options = personalOptions(file);
  assert.deepEqual(options, { genreDefaults: file.genres, pools: file.pools, cues: file.cues });
  for (const [key, song] of Object.entries(goldenSongs)) assert.deepEqual(composeGolden(key, options), song, key);
});

const assets = pathToFileURL(assetsDir);
const banks = await scanBanks();
const noAssets = !Object.keys(banks).length && 'assets/ not found';

test('built-in defaults, pools and cue instruments are all synth or open', { skip: noAssets }, () => {
  const closed = exposedInstruments().filter(({ id }) => instrumentBank(id) && banks[instrumentBank(id)]?.tier !== 'open');
  assert.deepEqual(closed.map(({ id, where }) => where + ': ' + id), []);
});

test('open instruments load from installed open banks and keep mixing headroom', { skip: noAssets }, () => {
  for (const [id, instrument] of Object.entries(INSTRUMENTS).filter(([, i]) => i.cache?.startsWith('open-'))) {
    assert.equal(banks[instrument.cache]?.tier, 'open', id);
    for (const old of instrument.replaces ?? []) assert.equal(INSTRUMENTS[old]?.part, instrument.part, id + ' replaces ' + old);
    if (instrument.level <= 0.8) continue;
    const folder = new URL(instrument.cache + '/', assets);
    let peak = 0;
    for (const sample of JSON.parse(fs.readFileSync(new URL('manifest.json', folder), 'utf8')).samples) {
      const bytes = fs.readFileSync(new URL(sample.file ?? sample.root + '.f32', folder));
      for (const value of new Float32Array(bytes.buffer, bytes.byteOffset, bytes.byteLength / 4)) peak = Math.max(peak, Math.abs(value));
    }
    assert.ok(peak * instrument.level < 0.85, id + ' peaks at ' + (peak * instrument.level).toFixed(3));
  }
});
