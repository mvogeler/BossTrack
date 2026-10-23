import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createProceduralSong, addPart, removePart, rerollPart, keepPartLayout } from '../engine/song-compose.js';
import { readSongFile } from '../engine/song-file.js';
import { swapInstrument, shiftOctave } from '../engine/song-instruments.js';
import { renderSong, mixParts } from '../engine/song-render.js';

test('aligned parts include stereo tails and recombine into the full mix', () => {
  const song = createProceduralSong(42);
  const before = JSON.stringify(song);
  const audio = renderSong(song);
  assert.equal(JSON.stringify(song), before);
  assert.deepEqual(audio.parts.map((part) => part.id), song.tracks.map((track) => track.id));
  assert.deepEqual(mixParts(audio.parts), audio.channels);
  const buffers = [...audio.channels, ...audio.parts.flatMap((part) => part.channels)].map((ch) => ch.buffer);
  assert.equal(new Set(buffers).size, buffers.length);
  for (const part of audio.parts) {
    assert.equal(part.channels.length, 2);
    for (const ch of part.channels) {
      assert.equal(ch.length, audio.channels[0].length);
      assert.ok(ch.every(Number.isFinite));
      assert.equal(ch[0], 0);
      assert.equal(ch.at(-1), 0);
    }
  }
  const keys = audio.parts.find((part) => part.id === 'keys');
  assert.ok(keys.channels[0].slice(-48000).some((v) => v !== 0));
});

test('mute and solo preserve part levels, support multiple solos and allow silence', () => {
  const part = (id, values) => ({ id, channels: [Float32Array.from(values), Float32Array.from(values)] });
  const parts = [part('keys', [0.4, 0.1, 0]), part('bass', [0.1, -0.2, 0]), part('drums', [0, 0.3, 0])];
  const before = parts.map((p) => p.channels.map((ch) => ch.slice()));
  assert.deepEqual(mixParts(parts, { solo: ['keys'] }), parts[0].channels);
  assert.deepEqual(mixParts(parts, { muted: ['bass', 'drums'] }), parts[0].channels);
  assert.deepEqual(mixParts(parts, { solo: ['keys', 'bass'], muted: ['keys'] }), parts[1].channels);
  assert.ok(mixParts(parts, { muted: parts.map((p) => p.id) }).every((ch) => ch.every((v) => v === 0)));
  assert.deepEqual(parts.map((p) => p.channels), before);
});

test('part gains affect stereo selection without changing the rendered parts', () => {
  const parts = [{ id: 'keys', channels: [Float32Array.of(0.4, -0.2), Float32Array.of(-0.2, 0.4)] },
    { id: 'bass', channels: [Float32Array.of(0.2, 0.1), Float32Array.of(0.1, 0.2)] }];
  const before = parts.map((p) => p.channels.map((ch) => ch.slice()));
  const adjusted = mixParts(parts, { gains: { keys: 0.5, bass: 0 }, solo: ['keys', 'bass'] });
  for (let c = 0; c < 2; c++) {
    assert.deepEqual(adjusted[c], parts[0].channels[c].map((v) => v * 0.5));
    assert.deepEqual(mixParts(parts, { gains: { keys: 1 }, solo: ['keys'] })[c], parts[0].channels[c]);
  }
  assert.ok(mixParts(parts, { gains: { keys: 0.5 }, muted: ['keys', 'bass'] }).every((ch) => ch.every((v) => v === 0)));
  assert.deepEqual(parts.map((p) => p.channels), before);
  assert.deepEqual(mixParts(parts, { gains: { keys: 1, bass: 1 } }), mixParts(parts));
});

test('added parts have independent notes, voices and stable saved identities', () => {
  const base = createProceduralSong(42);
  const added = addPart(base, 'bass', 99);
  assert.deepEqual(added.tracks.slice(0, 4), base.tracks);
  const extra = added.tracks.at(-1);
  assert.equal(extra.id, 'bass-2');
  assert.equal(extra.part, 'bass');
  assert.notDeepEqual(extra.notes, base.tracks[2].notes);
  const changed = rerollPart(swapInstrument(added, extra.id, 'pluckbass'), extra.id, 100);
  assert.deepEqual(changed.tracks.slice(0, 4), base.tracks);
  assert.equal(changed.tracks.at(-1).instrument, 'pluckbass');
  assert.ok(changed.tracks.at(-1).notes.every(n => n.id.startsWith('bass-2-')));
  const file = { format: 'bosstrack-song', v: 1, renderer: 'song-v1', song: changed,
    mix: { muted: ['bass'], solo: ['bass-2'], gains: { 'bass-2': 0.5 } }, repeat: false };
  assert.deepEqual(readSongFile(JSON.stringify(file)), file);
  file.song.tracks.at(-1).part = 'keys';
  assert.throws(() => readSongFile(JSON.stringify(file)), /parts/);
  assert.deepEqual(removePart(added, 'bass-2').tracks, base.tracks);
});

test('part layouts survive generation, permit silence and enforce the part cap', () => {
  let song = removePart(createProceduralSong(42), 'keys');
  song = addPart(song, 'drums', 99);
  const next = keepPartLayout(createProceduralSong(43), song);
  assert.deepEqual(next.tracks.map(t => t.id), song.tracks.map(t => t.id));
  assert.notDeepEqual(next.tracks.at(-1).notes, song.tracks.at(-1).notes);
  while (song.tracks.length < 8) song = addPart(song, 'bass', song.tracks.length);
  assert.throws(() => addPart(song, 'bass', 1), /8 parts/);
  for (const t of song.tracks) song = removePart(song, t.id);
  const audio = renderSong(song);
  assert.equal(audio.parts.length, 0);
  assert.ok(audio.channels[0].length > 0);
  assert.ok(audio.channels.every(ch => ch.every(v => v === 0)));
  const file = { format: 'bosstrack-song', v: 1, renderer: 'song-v1', song,
    mix: { muted: [], solo: [], gains: {} }, repeat: false };
  assert.deepEqual(readSongFile(JSON.stringify(file)), file);
});

test('new parts follow the song seed and current sound without copying an existing performance', () => {
  let base = createProceduralSong(42, 'cozy', 'menu', 'loop', 'auto', 'auto', 'auto', 'auto', 'auto', null, 111, 'D', 'minor', 'electronic');
  base = shiftOctave(swapInstrument(base, 'keys', 'chip'), 'keys', -1);
  base.tracks[0].effects = { delay: { mix: 0.3, beats: 0.5, feedback: 0.4, damp: 0.6 } };
  const snapshot = structuredClone(base);
  const second = addPart(base, 'keys'), third = addPart(second, 'keys');
  assert.deepEqual(second, addPart(base, 'keys'));
  assert.deepEqual(third, addPart(second, 'keys'));
  assert.deepEqual(base, snapshot);
  assert.deepEqual(third.tracks.slice(0, 4), base.tracks);
  assert.deepEqual(third.tracks[4], second.tracks[4]);
  const shape = track => track.notes.map(({ id, ...note }) => note);
  assert.notDeepEqual(shape(second.tracks[4]), shape(base.tracks[0]));
  assert.notDeepEqual(shape(third.tracks[5]), shape(second.tracks[4]));
  for (const track of third.tracks.slice(4)) {
    assert.equal(track.instrument, 'chip');
    assert.equal(track.octaves, -1);
    assert.deepEqual(track.effects, base.tracks[0].effects);
    assert.notEqual(track.effects, base.tracks[0].effects);
    assert.deepEqual(rerollPart(third, track.id, track.seed).tracks.find(t => t.id === track.id).notes, track.notes);
  }
  assert.deepEqual(removePart(second, 'keys-2').tracks, base.tracks);
  assert.deepEqual(addPart(removePart(second, 'keys-2'), 'keys').tracks[4], second.tracks[4]);
  assert.notDeepEqual(shape(addPart({ ...base, seed: 99 }, 'keys').tracks[4]), shape(second.tracks[4]));
  const file = { format: 'bosstrack-song', v: 1, renderer: 'song-v1', song: third,
    mix: { muted: [], solo: [], gains: {} }, repeat: true };
  assert.deepEqual(readSongFile(JSON.stringify(file)), file);
  assert.throws(() => addPart(base, 'keys', null), /Seed/);
});
