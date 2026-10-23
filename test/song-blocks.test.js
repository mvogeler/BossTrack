import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createProceduralSong } from '../engine/song-compose.js';
import { INSTRUMENTS } from '../engine/song-instruments.js';
import { mixParts, renderSong, renderSongBlocks } from '../engine/song-render.js';

function compare(song, samples, blockFrames) {
  const expected = renderSong(song, samples);
  const parts = expected.parts.map(part => ({ ...part, channels: part.channels.map(ch => new Float32Array(ch.length)) }));
  const steps = renderSongBlocks(song, samples, { blockFrames });
  let step;
  let at = 0;
  let peak = 0;
  while (!(step = steps.next()).done) {
    const block = step.value;
    assert.equal(block.at, at);
    assert.ok(block.channels[0].length <= blockFrames);
    block.parts.forEach((part, p) => part.channels.forEach((ch, c) => parts[p].channels[c].set(ch, at)));
    for (const ch of block.channels) for (const value of ch) peak = Math.max(peak, Math.abs(value));
    at += block.channels[0].length;
  }
  assert.equal(step.value.frames, at);
  assert.equal(step.value.sampleRate, expected.sampleRate);
  assert.deepEqual(step.value.loop, expected.loop);
  assert.deepEqual(step.value.parts, expected.parts.map(({ id, instrument }) => ({ id, instrument })));
  const gain = Math.min(1, 0.8 / (peak || 1));
  const fade = Math.round(song.output.sampleRate * 0.25);
  for (const part of parts) for (const ch of part.channels) {
    for (let i = 0; i < ch.length; i++) ch[i] *= gain * (song.form === 'loop' ? 1 : Math.min(1, (ch.length - 1 - i) / fade));
  }
  assert.deepEqual(parts, expected.parts);
  assert.deepEqual(mixParts(parts, {}, at), expected.channels);
}

test('raw blocks preserve complete stems, shared gain and mix for songs and loops', () => {
  for (const form of ['sketch', 'loop']) {
    const song = createProceduralSong(42, 'cozy', 'sketch', form);
    compare(song, [], 127);
    compare(song, [], 32768);
  }
});

test('all synths preserve overlapping notes, echo and loop tails', () => {
  const base = createProceduralSong(42, 'cozy', 'sketch', 'loop');
  for (const [instrument, info] of Object.entries(INSTRUMENTS).filter(([, value]) => !value.sample)) {
    const track = base.tracks.find(t => t.id === info.part);
    const notes = track.notes.slice(0, 3).map((note, i) => ({ ...note,
      tick: base.bars * 4 * base.ppq - 80 + i * 10, len: 180, articulation: info.part === 'pad' ? 'short' : undefined }));
    const song = { ...base, tracks: [{ ...track, instrument, notes }] };
    compare(song, [], 4096);
  }
});

test('stereo sampled blocks retain pitch interpolation, sustain wrap and silence', () => {
  const base = createProceduralSong(42, 'cozy', 'sketch', 'loop');
  const track = base.tracks[0];
  const song = { ...base, tracks: [{ ...track, instrument: 'kawai_piano', notes: track.notes.slice(0, 2).map(note => ({ ...note,
    tick: base.bars * 4 * base.ppq - 100, len: 250 })) }] };
  const samples = [{ instrument: 'kawai_piano', root: 72, sampleRate: 44100, loop: { start: 1, end: 3 },
    channels: [Float32Array.of(0, 0.5, -0.2, -0.4, 0), Float32Array.of(0, 0.1, -0.3, 0.6, 0)] }];
  compare(song, samples, 127);
  compare({ ...base, tracks: [] }, [], 4096);
});

test('shared voice chunks preserve tails that wrap across several loop cycles', () => {
  const song = { tempo: 240, bars: 1, ppq: 960, form: 'loop', output: { sampleRate: 1000 },
    tracks: [{ id: 'keys', instrument: 'chip', seed: 7, notes: [
      { id: 'long', tick: 3750, len: 12000, midi: 72, vel: 0.4 },
      { id: 'overlap', tick: 3800, len: 9000, midi: 76, vel: 0.6 },
    ] }] };
  for (const size of [1, 37, 65536]) compare(song, [], size);
});
