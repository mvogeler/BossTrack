import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createProceduralSong } from '../engine/song-compose.js';
import { generateChoices } from '../engine/song-controls.js';
import { applySoundPreset } from '../engine/song-presets.js';
import { readSongFile } from '../engine/song-file.js';

const file = song => ({ format: 'bosstrack-song', v: 1, renderer: 'song-v1', song,
  mix: { muted: [], solo: [], gains: {} }, repeat: false });

test('effects and preset metadata reopen exactly and survive generation without shared settings', () => {
  for (const id of ['gritty', 'echo-tide']) {
    const song = applySoundPreset(createProceduralSong(42), id);
    assert.deepEqual(readSongFile(JSON.stringify(file(song))).song, song);
    const next = generateChoices(createProceduralSong(7), song);
    assert.deepEqual(next.tracks[0].effects, song.tracks[0].effects);
    next.tracks[0].effects = { reverb: { mix: .2, size: .4, damp: .5 } };
    assert.notDeepEqual(next.tracks[0].effects, song.tracks[0].effects);
  }
  assert.deepEqual(readSongFile(JSON.stringify(file(createProceduralSong(42)))).song, createProceduralSong(42));
});

test('saved effect ranges and preset identifiers reject malformed settings', () => {
  for (const effects of [null, [], { delay: {} }, { unknown: {} },
    { delay: { mix: .2, beats: .5, feedback: .99, damp: .3 } },
    { reverb: { mix: .2, size: 2, damp: .3 } }, { crush: { mix: .2, bits: 8.5, rate: 3 } }]) {
    const song = createProceduralSong(42); song.tracks[0].effects = effects;
    assert.throws(() => readSongFile(JSON.stringify(file(song))), /part effects/);
  }
  for (const soundPreset of ['missing', ['gritty'], null, 1]) {
    assert.throws(() => readSongFile(JSON.stringify(file({ ...createProceduralSong(42), soundPreset }))), /sound preset/);
  }
});
