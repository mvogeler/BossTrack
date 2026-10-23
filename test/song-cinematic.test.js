import test from 'node:test';
import assert from 'node:assert/strict';
import { createProceduralSong, changePlaying, addPart, rerollPart } from '../engine/song-compose.js';
import { INSTRUMENTS } from '../engine/song-instruments.js';
import { generateChoices } from '../engine/song-controls.js';
import { readSongFile } from '../engine/song-file.js';
import { chooseSample, sampleVoice, sampleVoiceBlocks, recordedDrumDuration } from '../engine/song-samples.js';
import { songVoiceBlocks } from '../engine/song-voice.js';
import { renderSong, renderSongBlocks } from '../engine/song-render.js';
import { createSong, addNote } from '../engine/song.js';

const make = (genre, seed = 42, seconds = null, mode = 'major') => createProceduralSong(seed, 'neutral', 'sketch', seconds ? 'loop' : 'song', 'auto', 'auto', 'auto', 'auto', 'auto', seconds, null, 'F#', mode, genre);
const reopen = song => readSongFile(JSON.stringify({ format: 'bosstrack-song', v: 1, renderer: 'song-v1', song, mix: { muted: [], solo: [], gains: {} }, repeat: true,
  assets: Object.fromEntries(song.tracks.filter(t => INSTRUMENTS[t.instrument].sample).map(t => [t.instrument, 'a'.repeat(64)])) })).song;

test('cinematic profiles retain tonal notes, ranges, styles and saved performances', () => {
  for (const genre of ['cinematic_wonder', 'cinematic_command', 'space']) for (const seed of [1, 7, 42]) for (const seconds of [null, 120, 300]) for (const mode of ['major', 'minor']) {
    const song = make(genre, seed, seconds, mode);
    assert.deepEqual(song, make(genre, seed, seconds, mode));
    assert.deepEqual(reopen(song), song);
    for (const t of song.tracks.filter(t => t.id !== 'drums')) assert.ok(t.notes.every(n => song.harmony.scale.some(p => p % 12 === n.midi % 12)));
    const next = rerollPart(song, 'keys', 99);
    assert.deepEqual(next.tracks.slice(1), song.tracks.slice(1));
    assert.deepEqual(reopen(addPart(next, 'keys')), addPart(next, 'keys'));
    const varied = generateChoices(make(genre, seed + 1, seconds, mode), song, { varyInstruments: true });
    assert.deepEqual(reopen(varied), varied);
  }
});

test('expressive phrases swell and short strings retain their recorded articulation', () => {
  const wonder = make('cinematic_wonder'), command = make('cinematic_command');
  assert.ok(wonder.tracks[0].notes.some(n => n.expression === 'swell'));
  assert.ok(wonder.tracks[1].notes.every(n => n.expression === 'swell'));
  assert.ok(command.tracks[1].notes.every(n => n.articulation === 'short' && n.len <= command.ppq * 0.3));
  const short = changePlaying(wonder, 'keys', 'short');
  assert.ok(short.tracks[0].notes.every(n => n.articulation === 'short' && n.expression === undefined));
  assert.deepEqual(reopen(short), short);
  const locked = generateChoices(createProceduralSong(7, 'neutral', 'sketch', 'song'), short, { locks: { keys: { notes: true, instrument: true } } });
  assert.deepEqual(locked.tracks[0].notes, short.tracks[0].notes);
  assert.deepEqual(reopen(locked), locked);
  const bad = JSON.parse(JSON.stringify({ format: 'bosstrack-song', v: 1, renderer: 'song-v1', song: short, mix: { muted: [], solo: [], gains: {} }, repeat: true }));
  bad.song.tracks[0].notes[0].expression = 'unknown';
  assert.throws(() => readSongFile(JSON.stringify(bad)), /notes/);
});

test('sample selection keeps drum pitches, chooses velocity layers and alternates stable takes', () => {
  const samples = [36, 38, 54].flatMap(root => (root === 54 ? [0.7] : [0.4, 0.9]).flatMap(velocity => [1, 2].map(take => ({ root, velocity, take, articulation: 'hit' }))));
  assert.equal(chooseSample({ midi: 36, vel: 0.7 }, samples).root, 36);
  const drums = samples.map(s => ({ ...s, sampleRate: 1000, channels: [new Float32Array(s.root === 36 ? 200 : 3000)] }));
  assert.equal(recordedDrumDuration({ midi: 36, vel: 0.7 }, drums), 0.2);
  assert.equal(recordedDrumDuration({ midi: 36 }, drums.map(s => ({ ...s, articulation: undefined }))), 3);
  assert.equal(chooseSample({ midi: 38, vel: 0.2 }, samples).velocity, 0.4);
  assert.equal(chooseSample({ midi: 38, vel: 0.85 }, samples).velocity, 0.9);
  assert.notEqual(chooseSample({ midi: 38, id: 'drums-0' }, samples).take, chooseSample({ midi: 38, id: 'drums-1' }, samples).take);
  assert.deepEqual(chooseSample({ midi: 38, id: 'drums-1' }, samples), chooseSample({ midi: 38, id: 'drums-1' }, samples));
  const bowed = [{ root: 60, velocity: 0.4, articulation: 'sustain' }, { root: 60, velocity: 0.9, articulation: 'short' }];
  assert.equal(chooseSample({ midi: 60, vel: 0.9 }, bowed).articulation, 'sustain');
  assert.equal(chooseSample({ midi: 60, articulation: 'short' }, bowed).articulation, 'short');
});

test('recorded swells preserve stereo loop state across blocks and change the envelope', () => {
  const bank = [{ root: 60, velocity: 0.4, articulation: 'sustain', sampleRate: 1000, release: 0.65, loop: { start: 300, end: 1600 }, channels: [Float32Array.from({ length: 2500 }, (_, i) => Math.sin(i * 0.2)), Float32Array.from({ length: 2500 }, (_, i) => Math.cos(i * 0.2))] }];
  const note = { midi: 60, vel: 0.4, id: 'keys-0', expression: 'swell' };
  const full = sampleVoice(note, 4, 1000, bank), voice = sampleVoiceBlocks(note, 4, 1000, bank);
  let at = 0;
  for (const block of voice.blocks(113)) { block.forEach((ch, c) => assert.deepEqual(ch, full[c].subarray(at, at + ch.length))); at += block[0].length; }
  assert.equal(at, 4650);
  assert.ok(Math.abs(full[0][100]) < Math.abs(sampleVoice({ ...note, expression: undefined }, 4, 1000, bank)[0][100]));
});

test('cinematic synths stay finite and partition exact at pitch and rate limits', () => {
  for (const id of ['horizon_lead', 'spectral_pad', 'clockwork_pulse', 'abyss_bass']) for (const sr of [22050, 48000]) for (const midi of [0, 60, 127]) {
    const makeVoice = () => songVoiceBlocks(id, { midi, expression: 'swell' }, 0.5, sr, 42);
    const full = [...makeVoice().blocks(100000)][0][0], split = new Float32Array(full.length); let at = 0;
    for (const [block] of makeVoice().blocks(137)) { split.set(block, at); at += block.length; }
    assert.deepEqual(split, full); assert.ok(full.every(Number.isFinite)); assert.ok(full.some(x => Math.abs(x) > 0.0001));
  }
});

test('explicit swells render identically through full and streamed original synth paths', () => {
  const t = { id: 'keys', instrument: 'lead', seed: 42, notes: [] }, song = { ...createSong({ bars: 1, tempo: 120, tracks: [t] }), form: 'loop' };
  addNote(t, 3, 60, 1, 0.7); t.notes[0].expression = 'swell';
  const full = renderSong(song); let frames = 0;
  for (const block of renderSongBlocks(song, [], { blockFrames: 1024 })) { block.parts[0].channels.forEach((ch, c) => assert.deepEqual(ch, full.parts[0].channels[c].subarray(block.at, block.at + ch.length))); frames += block.channels[0].length; }
  assert.equal(frames, full.channels[0].length);
});
