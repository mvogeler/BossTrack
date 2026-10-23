import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createProceduralSong, rerollPart } from '../engine/song-compose.js';
import { swapInstrument, fitMelodyInstrument, shiftOctave } from '../engine/song-instruments.js';
import { readSongFile } from '../engine/song-file.js';
import { renderSong } from '../engine/song-render.js';

test('octave shifts reverse and survive pitched part rerolls and saves', () => {
  const song = createProceduralSong(42);
  for (const id of ['keys', 'pad', 'bass']) {
    const shifted = shiftOctave(song, id, -1);
    assert.deepEqual(shifted.tracks.filter(t => t.id !== id), song.tracks.filter(t => t.id !== id));
    assert.deepEqual(shiftOctave(shifted, id, 1).tracks.find(t => t.id === id).notes, song.tracks.find(t => t.id === id).notes);
    const changed = rerollPart(shifted, id, 99).tracks.find(t => t.id === id);
    const plain = rerollPart(song, id, 99).tracks.find(t => t.id === id);
    assert.deepEqual(changed.notes.map(n => ({ ...n, midi: n.midi + 12 })), plain.notes);
    const file = { format: 'bosstrack-song', v: 1, renderer: 'song-v1', song: shifted,
      mix: { muted: [], solo: [], gains: {} }, repeat: false };
    assert.deepEqual(readSongFile(JSON.stringify(file)).song, shifted);
  }
  const high = createProceduralSong(42, 'neutral', 'sketch', 'sketch', 'auto', 'auto', 'auto', 'auto', 'auto');
  const jazz = fitMelodyInstrument(high, 'keys', 'archtop_jazz').song;
  assert.throws(() => shiftOctave(jazz, 'keys', 1), /cannot play/);
  assert.equal(shiftOctave(swapInstrument(jazz, 'keys', 'flute'), 'keys', 1).tracks[0].octaves, 0);
  assert.throws(() => shiftOctave(song, 'drums', -1), /pitched/);
  assert.throws(() => shiftOctave(song, 'keys', 0), /Invalid/);
});

test('instrument swaps preserve the score and survive note variation', () => {
  const song = createProceduralSong(42);
  const before = JSON.stringify(song);
  const next = swapInstrument(song, 'keys', 'lead');
  assert.equal(JSON.stringify(song), before);
  assert.deepEqual({ ...next, tracks: next.tracks.map((t) => ({ ...t, instrument: t.id })) }, song);
  assert.equal(next.tracks[0].notes, song.tracks[0].notes);
  assert.equal(rerollPart(next, 'keys', 1234).tracks[0].instrument, 'lead');
  assert.deepEqual(swapInstrument(next, 'keys', 'keys'), song);
  assert.throws(() => swapInstrument(song, 'keys', 'bass'));
  assert.throws(() => swapInstrument(song, 'missing', 'lead'));
});

test('alternate lead changes sound deterministically and keeps other voices', () => {
  const song = createProceduralSong(42);
  const next = swapInstrument(song, 'keys', 'lead');
  const a = renderSong(song);
  const b = renderSong(next);
  assert.notDeepEqual(a.parts[0].channels, b.parts[0].channels);
  assert.deepEqual(b.channels, renderSong(next).channels);
  assert.ok(b.channels.every((ch) => ch.every((v) => Number.isFinite(v) && Math.abs(v) <= 0.801)));
  const others = (s) => ({ ...s, tracks: s.tracks.filter((t) => t.id !== 'keys') });
  assert.deepEqual(renderSong(others(song)), renderSong(others(next)));
});

test('synth flute keeps notes, saved identity and unrelated audio', () => {
  const song = createProceduralSong(42);
  const next = swapInstrument(song, 'keys', 'flute');
  assert.equal(next.tracks[0].notes, song.tracks[0].notes);
  assert.equal(rerollPart(next, 'keys', 99).tracks[0].instrument, 'flute');
  const file = { format: 'bosstrack-song', v: 1, renderer: 'song-v1', song: next,
    mix: { muted: [], solo: [], gains: {} }, repeat: false };
  assert.deepEqual(readSongFile(JSON.stringify(file)).song, next);
  const others = s => ({ ...s, tracks: s.tracks.filter(t => t.id !== 'keys') });
  assert.deepEqual(renderSong(others(song)), renderSong(others(next)));
  for (const sampleRate of [44100, 48000]) {
    const solo = { ...next, tracks: [next.tracks[0]], output: { ...next.output, sampleRate } };
    const rendered = renderSong(solo);
    assert.deepEqual(rendered.channels, renderSong(solo).channels);
    assert.notDeepEqual(rendered.channels, renderSong({ ...solo, tracks: [song.tracks[0]] }).channels);
    assert.ok(rendered.channels.every(ch => ch.every(v => Number.isFinite(v) && Math.abs(v) <= 0.801)));
    assert.ok(rendered.channels[0].some(v => Math.abs(v) > 0.01));
    const loop = { ...solo, form: 'loop' };
    assert.equal(renderSong(loop).channels[0].length, Math.round(loop.bars * 240 / loop.tempo * sampleRate));
  }
});

test('high melody instruments offer explicit octave fitting and retain it on rerolls', () => {
  const song = createProceduralSong(42, 'neutral', 'sketch', 'sketch', 'auto', 'auto', 'auto', 'auto', 'auto');
  assert.throws(() => swapInstrument(song, 'keys', 'archtop_jazz'), /range/);
  for (const [id, octaves] of [['archtop_jazz', -1], ['fm_epiano', -2]]) {
    const fitted = fitMelodyInstrument(song, 'keys', id);
    assert.equal(fitted.octaves, octaves);
    assert.deepEqual(fitted.song.tracks.slice(1), song.tracks.slice(1));
    assert.equal(fitted.song.harmony, song.harmony);
    assert.deepEqual(fitted.song.tracks[0].notes.map(n => ({ ...n, midi: n.midi - octaves * 12 })), song.tracks[0].notes);
    const changed = rerollPart(fitted.song, 'keys', 99);
    const plain = rerollPart(song, 'keys', 99);
    assert.equal(changed.tracks[0].octaves, octaves);
    assert.deepEqual(changed.tracks[0].notes.map(n => ({ ...n, midi: n.midi - octaves * 12 })), plain.tracks[0].notes);
    const file = { format: 'bosstrack-song', v: 1, renderer: 'song-v1', song: fitted.song,
      mix: { muted: [], solo: [], gains: {} }, repeat: false, assets: { [id]: 'a'.repeat(64) } };
    assert.deepEqual(readSongFile(JSON.stringify(file)), file);
    file.song.tracks[0].octaves = 1.5;
    assert.throws(() => readSongFile(JSON.stringify(file)), /octave/);
  }
  assert.equal(fitMelodyInstrument(song, 'keys', 'flute').octaves, 0);
  const wide = { ...song, tracks: song.tracks.map(t => t.id === 'keys' ? { ...t, notes: t.notes.map((n, i) => ({ ...n, midi: i % 2 ? 127 : 0 })) } : t) };
  assert.throws(() => fitMelodyInstrument(wide, 'keys', 'fm_epiano'), /cannot fit/);
});
