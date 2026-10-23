import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createProceduralSong, KEYS, addPart, keepPartLayout } from '../engine/song-compose.js';
import { INSTRUMENTS, shiftOctave, partType } from '../engine/song-instruments.js';
import { GENRES } from '../engine/song-genres.js';
import { INSTRUMENT_POOLS } from '../engine/song-instrument-pools.js';
import { generateChoices, selectPartInstrument, instrumentChoices } from '../engine/song-controls.js';
import { readSongFile } from '../engine/song-file.js';

const make = (seed, genre = 'cozy', key = 'C', mode = 'major') => createProceduralSong(seed, 'neutral', 'sketch', 'sketch', 'auto', 'auto', 'auto', 'auto', 'auto', null, null, key, mode, genre);
const rangeCheck = song => song.tracks.forEach(track => {
  const voice = INSTRUMENTS[track.instrument];
  assert.equal(voice.part, partType(track));
  const [low, high] = voice.range ?? [0, 127];
  assert.ok(track.notes.every(n => n.midi >= low && n.midi <= high));
  assert.ok(Math.abs(track.octaves ?? 0) <= 10);
});
const reopen = song => readSongFile(JSON.stringify({ format: 'bosstrack-song', v: 1, renderer: 'song-v1', song,
  mix: { muted: [], solo: [], gains: {} }, repeat: false,
  assets: Object.fromEntries(song.tracks.filter(t => INSTRUMENTS[t.instrument].sample).map(t => [t.instrument, 'a'.repeat(64)])) })).song;

test('genre pools select deterministic compatible voices across keys and modes', () => {
  assert.deepEqual(Object.keys(INSTRUMENT_POOLS).sort(), Object.keys(GENRES).sort());
  for (const [genre, pool] of Object.entries(INSTRUMENT_POOLS)) {
    for (const [part, ids] of Object.entries(pool)) for (const id of ids) assert.equal(INSTRUMENTS[id]?.part, part, id);
    for (const key of KEYS) for (const mode of ['major', 'minor']) {
      const fresh = make(42, genre, key, mode);
      const before = JSON.stringify(fresh);
      const options = { varyInstruments: true };
      const a = generateChoices(fresh, null, options);
      assert.deepEqual(a, generateChoices(fresh, null, options));
      assert.equal(JSON.stringify(fresh), before);
      rangeCheck(a);
      assert.deepEqual(reopen(a), a);
    }
  }
  const voices = new Set(Array.from({ length: 30 }, (_, seed) => generateChoices(make(seed, 'electronic'), null, { varyInstruments: true }).tracks[0].instrument));
  assert.ok(voices.size >= 5);
});

test('notes locks preserve the performance, register and seed across harmony changes', () => {
  const old = shiftOctave(make(1), 'keys', -1);
  const fresh = make(99, 'metal', 'B', 'minor');
  const before = JSON.stringify(old);
  const options = { varyInstruments: true, locks: { keys: { notes: true }, pad: { instrument: true } } };
  const next = generateChoices(fresh, old, options);
  assert.deepEqual(next.tracks[0].notes, old.tracks[0].notes);
  assert.equal(next.tracks[0].seed, old.tracks[0].seed);
  assert.equal(next.tracks[0].octaves, -1);
  assert.equal(next.tracks[1].instrument, old.tracks[1].instrument);
  assert.equal(JSON.stringify(old), before);
  rangeCheck(next);
  assert.throws(() => generateChoices({ ...fresh, bars: 1 }, old, options), /Locked notes.*duration/);
  const both = generateChoices(fresh, old, { locks: { keys: { notes: true, instrument: true } } });
  assert.deepEqual(both.tracks[0], old.tracks[0]);
});

test('regeneration retains the chosen octave once and fits a locked recorded voice', () => {
  const old = shiftOctave(shiftOctave(make(1, 'electronic'), 'keys', -1), 'keys', -1);
  const fresh = make(19, 'electronic');
  const next = generateChoices(fresh, old);
  assert.deepEqual(next.tracks[0].notes.map(n => ({ ...n, midi: n.midi + 24 })), fresh.tracks[0].notes);
  assert.equal(next.tracks[0].octaves, -2);
  old.tracks[0].instrument = 'fm_epiano';
  const fitted = generateChoices(make(19, 'metal', 'B'), old, { locks: { keys: { instrument: true } } });
  assert.equal(fitted.tracks[0].instrument, 'fm_epiano');
  rangeCheck(fitted);
});

test('favorites restrict by part and exact locked range, with a visible fallback', () => {
  const song = make(42, 'electronic');
  const options = { varyInstruments: true, favoritesOnly: true, favorites: ['kalimba', 'kalimba', 'sub_bass'] };
  const next = generateChoices(song, null, options);
  assert.equal(next.tracks[0].instrument, 'kalimba');
  assert.equal(next.tracks[2].instrument, 'sub_bass');
  assert.equal(instrumentChoices(song, song.tracks[1], options).favoritesFallback, true);
  const high = { ...song.tracks[0], notes: [{ id: 'keys-0', midi: 110, tick: 0, len: 24, vel: 0.5 }] };
  const blocked = { ...options, favorites: ['fm_epiano'], locks: { keys: { notes: true } } };
  assert.equal(instrumentChoices(song, high, blocked).favoritesFallback, true);
  assert.ok(!instrumentChoices(song, high, blocked).instruments.includes('fm_epiano'));
});

test('additional parts get independent seeded choices without altering existing tracks', () => {
  const old = make(42, 'electronic');
  const added = addPart(old, 'keys', 27);
  const before = JSON.stringify(added);
  const options = { varyInstruments: true };
  const selected = selectPartInstrument(added, added.tracks.at(-1), options);
  assert.equal(selected.id, 'keys-2');
  assert.equal(JSON.stringify(added), before);
  const generated = generateChoices(keepPartLayout(make(55, 'electronic'), added), added, options);
  assert.equal(generated.tracks.length, 5);
  rangeCheck(generated);
  assert.deepEqual(generated, generateChoices(keepPartLayout(make(55, 'electronic'), added), added, options));
  assert.deepEqual(selectPartInstrument(added, added.tracks.at(-1)), added.tracks.at(-1));
});

test('locks reject unsupported chord articulation and arrangement note limits before rendering', () => {
  const old = createProceduralSong(42, 'neutral', 'sketch', 'sketch', 'original', 'original', 'original', 'original', 'stabs');
  const original = createProceduralSong(99);
  delete original.performance;
  assert.throws(() => generateChoices(original, old, { locks: { pad: { notes: true } } }), /short chord articulations/);
  const dense = make(42);
  dense.tracks[0].notes = Array.from({ length: 513 }, (_, i) => ({ id: 'keys-' + i, tick: i, len: 1, midi: 60, vel: 0.5 }));
  assert.throws(() => generateChoices(make(99), dense, { locks: { keys: { notes: true } } }), /count limit/);
  const extended = createProceduralSong(99, 'neutral', 'sketch', 'song', 'auto', 'auto', 'auto', 'auto', 'auto', 120, null, 'C', 'major', 'cozy');
  const held = { ...dense, tracks: dense.tracks.map(t => t.id === 'keys' ? { ...t, notes: [{ id: 'keys-0', tick: 0, len: 17 * dense.ppq, midi: 60, vel: 0.5 }] } : t) };
  assert.throws(() => generateChoices(extended, held, { locks: { keys: { notes: true } } }), /note length/);
});

test('every lock combination reopens across forms, genres and register changes', () => {
  for (const genre of Object.keys(GENRES)) for (const form of ['sketch', 'song', 'loop']) for (const seed of [1, 42]) {
    let old = createProceduralSong(seed, 'neutral', 'sketch', form, 'auto', 'auto', 'auto', 'auto', 'auto', null, null, 'C', 'major', genre);
    const lead = old.tracks[0], range = INSTRUMENTS[lead.instrument].range ?? [0, 127];
    if (lead.notes.every(n => n.midi - 12 >= range[0])) old = shiftOctave(old, 'keys', -1);
    const next = createProceduralSong(seed + 7, 'neutral', 'sketch', form, 'auto', 'auto', 'auto', 'auto', 'auto', null, null, 'B', 'minor', genre);
    for (let bits = 0; bits < 8; bits++) {
      const locks = Object.fromEntries(old.tracks.map(t => [t.id, { notes: !!(bits & 1), instrument: !!(bits & 2), mix: !!(bits & 4) }]));
      const result = generateChoices(next, old, { varyInstruments: true, locks, favoritesOnly: true, favorites: ['fm_epiano', 'archtop_jazz_chords', 'upright_bass', 'drums_jazz_kit'] });
      assert.deepEqual(reopen(result), result);
      rangeCheck(result);
    }
  }
});
