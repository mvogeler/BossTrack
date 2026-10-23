import test from 'node:test';
import assert from 'node:assert/strict';
import { createProceduralSong, rerollPart, addPart, keepPartLayout } from '../engine/song-compose.js';
import { INSTRUMENTS, swapInstrument, shiftOctave, fitPitchedInstrument } from '../engine/song-instruments.js';
import { PALETTE, paletteDuration } from '../engine/song-palette.js';
import * as electronic from '../engine/song-palette-electronic.js';
import * as cozy from '../engine/song-palette-cozy.js';
import * as band from '../engine/song-palette-band.js';
import * as modern from '../engine/song-palette-modern.js';
import * as cinematic from '../engine/song-palette-cinematic.js';
import * as space from '../engine/song-palette-space.js';
import * as neon from '../engine/song-palette-neon.js';
import * as musicbox from '../engine/song-palette-musicbox.js';
import { songVoiceBlocks, songVoiceFrames } from '../engine/song-voice.js';
import { renderSong, renderSongBlocks, mixParts } from '../engine/song-render.js';
import { readSongFile } from '../engine/song-file.js';
import { fillPad } from '../engine/song-pad.js';

const chords = ['archtop_acoustic_chords', 'archtop_jazz_chords', 'hollowbody_muted_chords',
  'fm_epiano_chords', 'steinway_chords', 'upright_chords'];
const choices = [...Object.keys(PALETTE), ...chords];

function save(song) {
  return { format: 'bosstrack-song', v: 1, renderer: 'song-v1', song,
    mix: { muted: [], solo: [], gains: {} }, repeat: song.form === 'loop',
    assets: Object.fromEntries(song.tracks.filter(t => INSTRUMENTS[t.instrument].sample).map(t => [t.instrument, 'a'.repeat(64)])) };
}

test('palette registration keeps distinct identifiers and existing voices', () => {
  const ids = [electronic, cozy, band, modern, cinematic, space, neon, musicbox].flatMap(family => Object.keys(family.INSTRUMENTS));
  assert.equal(ids.length, 57);
  assert.equal(new Set(ids).size, ids.length);
  assert.equal(choices.length, 63);
  for (const id of ids) assert.deepEqual(INSTRUMENTS[id], PALETTE[id]);
  for (const id of chords) {
    assert.equal(INSTRUMENTS[id].sample, true);
    assert.equal(INSTRUMENTS[id].part, 'pad');
    assert.match(INSTRUMENTS[id].cache, /^(bank|open)-/);
  }
  assert.equal(INSTRUMENTS.keys.name, 'FM keys');
  assert.equal(INSTRUMENTS.bass.name, 'Synth bass');
  assert.equal(INSTRUMENTS.kawai_piano.range[0], 21);
});

test('all added choices survive swapping, octave controls, rerolling and reopening', () => {
  const base = createProceduralSong(42);
  const before = JSON.stringify(base);
  for (const instrument of choices) {
    const part = INSTRUMENTS[instrument].part;
    let song = swapInstrument(base, part, instrument);
    assert.deepEqual(song.tracks.find(t => t.id === part).notes, base.tracks.find(t => t.id === part).notes);
    assert.throws(() => swapInstrument(base, part === 'bass' ? 'keys' : 'bass', instrument), /does not fit/);
    if (part === 'drums') {
      assert.throws(() => shiftOctave(song, part, 1), /pitched part/);
    } else {
      const shifted = shiftOctave(song, part, -1);
      const restored = shiftOctave(shifted, part, 1);
      assert.deepEqual(restored.tracks.find(t => t.id === part).notes, song.tracks.find(t => t.id === part).notes);
      song = shifted;
    }
    const next = rerollPart(song, part, 99);
    assert.deepEqual(rerollPart(song, part, 99), next);
    assert.equal(next.tracks.find(t => t.id === part).instrument, instrument);
    assert.equal(next.tracks.find(t => t.id === part).octaves, song.tracks.find(t => t.id === part).octaves);
    assert.deepEqual(next.tracks.filter(t => t.id !== part), base.tracks.filter(t => t.id !== part));
    const file = save(next);
    assert.deepEqual(readSongFile(JSON.stringify(file)), file);
  }
  assert.equal(JSON.stringify(base), before);
});

test('registered voice lengths match streamed durations and leave mixing headroom', () => {
  for (const [id, info] of Object.entries(PALETTE)) {
    const note = { midi: info.part === 'drums' ? 36 : 60, articulation: info.part === 'pad' ? 'short' : undefined };
    const sr = 48000;
    const len = 0.12;
    const voice = songVoiceBlocks(id, note, len, sr, 42, 0.5);
    assert.equal(voice.frames, Math.round(paletteDuration(id, note, len) * sr));
    assert.equal(songVoiceFrames(id, note, len, sr), voice.frames);
    let count = 0, peak = 0;
    for (const [block] of voice.blocks(257)) {
      count += block.length;
      for (const value of block) {
        assert.ok(Number.isFinite(value), id);
        peak = Math.max(peak, Math.abs(value));
      }
    }
    assert.equal(count, voice.frames);
    assert.ok(peak > 0.05 && peak * info.level < 0.85, id + ' peak ' + peak);
  }
});

function compare(song, samples) {
  const full = renderSong(song, samples);
  const parts = full.parts.map(p => ({ ...p, channels: p.channels.map(ch => new Float32Array(ch.length)) }));
  const steps = renderSongBlocks(song, samples, { blockFrames: 127 });
  let step, peak = 0, frames = 0;
  while (!(step = steps.next()).done) {
    const block = step.value;
    assert.equal(block.at, frames);
    block.parts.forEach((p, n) => p.channels.forEach((ch, c) => parts[n].channels[c].set(ch, block.at)));
    for (const ch of block.channels) for (const value of ch) peak = Math.max(peak, Math.abs(value));
    frames += block.channels[0].length;
  }
  assert.equal(frames, full.channels[0].length);
  const gain = Math.min(1, 0.8 / (peak || 1));
  const fade = Math.round(song.output.sampleRate * 0.25);
  for (const part of parts) for (const ch of part.channels) {
    for (let i = 0; i < ch.length; i++) ch[i] *= gain * (song.form === 'loop' ? 1 : Math.min(1, (ch.length - 1 - i) / fade));
  }
  assert.deepEqual(parts, full.parts);
  assert.deepEqual(mixParts(parts, {}, frames), full.channels);
  assert.deepEqual(step.value.loop, full.loop);
}

test('polyphonic palette mixes and sampled chord tails match both render paths', () => {
  for (const form of ['sketch', 'loop']) {
    let song = createProceduralSong(42, 'cozy', 'sketch', form);
    song = { ...song, tempo: 300, tracks: song.tracks.map((t, p) => ({ ...t,
      instrument: ['marimba', 'shimmer_pad', 'acid_bass', 'drums_tight'][p],
      notes: t.notes.slice(0, 3).map((n, i) => ({ ...n, tick: song.bars * 4 * song.ppq - 180 + i * 20,
        len: 180 - i * 20, articulation: p === 1 ? 'short' : undefined })) })) };
    compare(song, []);
    song = swapInstrument(song, 'keys', 'guitar_heavy');
    song = swapInstrument(song, 'pad', 'archtop_acoustic_chords');
    const samples = [{ instrument: 'archtop_acoustic_chords', root: 60, sampleRate: 44100,
      loop: { start: 1, end: 4 }, channels: [Float32Array.of(0, 0.5, -0.2, 0.1, -0.3, 0), Float32Array.of(0, 0.2, -0.1, 0.4, -0.2, 0)] }];
    compare(song, samples);
  }
});

test('sampled genre pads fit named voicings without repeating their octave offset', () => {
  const shiftedGenres = new Set();
  function check(song, id) {
    const track = song.tracks.find(t => t.id === id);
    const raw = { id, seed: track.seed, notes: [] };
    fillPad(song, raw);
    const offset = (track.octaves ?? 0) * 12;
    const [low, high] = INSTRUMENTS[track.instrument].range;
    assert.deepEqual(track.notes, raw.notes.map(n => ({ ...n, midi: n.midi + offset })));
    assert.ok(track.notes.every(n => n.midi >= low && n.midi <= high));
    assert.deepEqual(track.notes.map(n => n.midi % 12), raw.notes.map(n => n.midi % 12));
    if (offset) shiftedGenres.add(song.genre);
    const fitted = fitPitchedInstrument(song, id, track.instrument);
    assert.equal(fitted.octaves, 0);
    assert.deepEqual(fitted.song, song);
  }
  for (const genre of ['lofi', 'folk', 'pop', 'funk']) {
    for (const key of ['C#', 'E', 'G#']) for (const mode of ['major', 'minor']) {
      for (const seed of [1, 2, 3, 7, 10, 16, 23, 42]) {
        const generate = n => createProceduralSong(n, 'neutral', 'sketch', 'sketch', 'auto',
          'auto', 'auto', 'auto', 'alternating', null, null, key, mode, genre);
        const song = generate(seed);
        check(song, 'pad');
        const added = addPart(song, 'pad', 99);
        check(added, 'pad-2');
        assert.deepEqual(added.tracks.slice(0, 4), song.tracks);
        const file = save(added);
        const reopened = readSongFile(JSON.stringify(file));
        assert.deepEqual(reopened, file);
        const rerolled = rerollPart(reopened.song, 'pad-2', 100);
        check(rerolled, 'pad-2');
        assert.equal(rerolled.tracks.at(-1).octaves, added.tracks.at(-1).octaves);
        assert.deepEqual(rerolled.tracks.slice(0, 4), song.tracks);
        const refreshed = keepPartLayout(generate(seed + 1), reopened.song);
        check(refreshed, 'pad');
        check(refreshed, 'pad-2');
        assert.deepEqual(readSongFile(JSON.stringify(save(refreshed))), save(refreshed));
      }
    }
  }
  assert.deepEqual([...shiftedGenres].sort(), ['funk', 'lofi', 'pop']);
});
