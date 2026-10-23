import test from 'node:test';
import assert from 'node:assert/strict';
import { createProceduralSong, rerollPart, addPart } from '../engine/song-compose.js';
import { INSTRUMENTS, fitPitchedInstrument, swapInstrument } from '../engine/song-instruments.js';
import { instrumentChoices, generateChoices } from '../engine/song-controls.js';
import { sampleVoice, sampleVoiceBlocks } from '../engine/song-samples.js';
import { renderSong, renderSongBlocks } from '../engine/song-render.js';
import { createSong, addNote } from '../engine/song.js';
import { readSongFile } from '../engine/song-file.js';

const voices = ['ocarina_recorded', 'harmonica_recorded', 'strumstick_recorded', 'dan_tranh_recorded', 'psaltery_recorded', 'mbira_recorded', 'strumstick_chords', 'dan_tranh_chords', 'psaltery_chords'];
const make = seed => createProceduralSong(seed, 'neutral', 'sketch', 'loop', 'auto', 'auto', 'auto', 'auto', 'auto', 120, null, 'C', 'minor', 'folk');
const reopen = song => readSongFile(JSON.stringify({ format: 'bosstrack-song', v: 1, renderer: 'song-v1', song, mix: { muted: [], solo: [], gains: {} }, repeat: true,
  assets: Object.fromEntries(song.tracks.filter(t => INSTRUMENTS[t.instrument].sample).map(t => [t.instrument, 'a'.repeat(64)])) })).song;

test('new recorded choices fit, reroll, add matching parts and reopen exactly', () => {
  for (const voice of voices) {
    const id = INSTRUMENTS[voice].part, original = make(42);
    const fitted = fitPitchedInstrument(original, id, voice).song;
    assert.deepEqual(fitted.tracks.filter(t => t.id !== id), original.tracks.filter(t => t.id !== id));
    assert.deepEqual(reopen(fitted), fitted);
    const next = rerollPart(fitted, id, 7), added = addPart(next, id, 99);
    assert.deepEqual(added.tracks.slice(0, 4), next.tracks);
    assert.equal(added.tracks.at(-1).instrument, voice);
    assert.deepEqual(reopen(added), added);
    assert.ok(next.tracks.find(t => t.id === id).notes.every(n => next.harmony.scale.some(p => p % 12 === n.midi % 12)));
  }
});

test('narrow instruments require explicit range fitting and locked favorites never fold notes', () => {
  const song = make(42), source = song.tracks[0];
  assert.throws(() => swapInstrument(song, 'keys', 'ocarina_recorded'), /range/);
  const fit = fitPitchedInstrument(song, 'keys', 'ocarina_recorded');
  assert.equal(fit.folded, true);
  fit.song.tracks[0].notes.forEach((n, i) => { assert.equal(n.midi % 12, source.notes[i].midi % 12); assert.equal(n.tick, source.notes[i].tick); });
  const choices = instrumentChoices(song, source, { favoritesOnly: true, favorites: ['ocarina_recorded'], locks: { keys: { notes: true } } });
  assert.equal(choices.favoritesFallback, true); assert.ok(!choices.instruments.includes('ocarina_recorded'));
  const locked = generateChoices(make(7), fit.song, { locks: { keys: { notes: true, instrument: true } } });
  assert.deepEqual(locked.tracks[0].notes, fit.song.tracks[0].notes);
});

test('recorded decay metadata preserves natural tails and block boundaries', () => {
  const channels = [Float32Array.from({ length: 3000 }, (_, i) => Math.sin(i * .2) * .5)];
  const bank = [{ root: 60, sampleRate: 1000, channels, release: .85, loop: { start: 400, end: 1700 } }];
  const voice = sampleVoiceBlocks({ midi: 61 }, 3, 1000, bank);
  assert.equal(voice.frames, 3850);
  const full = sampleVoice({ midi: 61 }, 3, 1000, bank)[0], split = new Float32Array(voice.frames); let at = 0;
  for (const [block] of voice.blocks(127)) { split.set(block, at); at += block.length; }
  assert.deepEqual(split, full); assert.ok(full.every(Number.isFinite)); assert.equal(Math.abs(full.at(-1)), 0);
  assert.equal(sampleVoiceBlocks({ midi: 60, articulation: 'short' }, 3, 1000, bank).frames, 3080);
  assert.equal(sampleVoiceBlocks({ midi: 60 }, 3, 1000, [{ ...bank[0], release: undefined }]).frames, 3250);
});

test('recorded releases match full and streamed stems, including loop wraps', () => {
  for (const release of [.18, .45, .85]) {
    const track = { id: 'keys', instrument: 'ocarina_recorded', seed: 42, notes: [] };
    const song = { ...createSong({ tempo: 120, bars: 1, tracks: [track] }), form: 'loop' };
    addNote(track, 3.5, 72, .5, .7);
    const channels = [Float32Array.from({ length: 3000 }, (_, i) => Math.sin(i * .2) * .5)];
    const bank = [{ instrument: 'ocarina_recorded', root: 72, sampleRate: 1000, channels, release, loop: { start: 400, end: 1700 } }];
    const full = renderSong(song, bank); let frames = 0;
    for (const block of renderSongBlocks(song, bank, { blockFrames: 1024 })) {
      block.parts[0].channels.forEach((ch, c) => assert.deepEqual(ch, full.parts[0].channels[c].subarray(block.at, block.at + ch.length)));
      frames += block.channels[0].length;
    }
    assert.equal(frames, full.channels[0].length);
  }
});
