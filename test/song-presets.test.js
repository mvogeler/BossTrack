import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createProceduralSong, addPart, KEYS } from '../engine/song-compose.js';
import { applySoundPreset, SOUND_PRESETS } from '../engine/song-presets.js';
import { INSTRUMENTS, partType } from '../engine/song-instruments.js';
import { readSongFile } from '../engine/song-file.js';

const make = (seed = 42, key = 'C', mode = 'major') => createProceduralSong(seed, 'neutral', 'sketch', 'song',
  'auto', 'auto', 'auto', 'auto', 'auto', null, null, key, mode, 'electronic');

test('sound presets keep the score deterministic and the palette in range', () => {
  for (const id of Object.keys(SOUND_PRESETS)) for (const key of KEYS) for (const mode of ['major', 'minor']) {
    for (const seed of [1, 7, 42]) {
      const source = make(seed, key, mode), before = JSON.stringify(source);
      const song = applySoundPreset(source, id);
      assert.equal(JSON.stringify(source), before);
      assert.deepEqual(song, applySoundPreset(source, id));
      assert.equal(song.soundPreset, id);
      const saved = { format: 'bosstrack-song', v: 1, renderer: 'song-v1', song,
        assets: {}, mix: { muted: [], solo: [], gains: {} }, repeat: false };
      assert.deepEqual(readSongFile(JSON.stringify(saved)).song, song);
      for (const track of song.tracks) {
        const voice = INSTRUMENTS[track.instrument], range = voice.range ?? [0, 127];
        assert.equal(voice.part, partType(track));
        assert.ok(track.notes.every(n => n.midi >= range[0] && n.midi <= range[1] && n.tick + n.len <= song.bars * 4 * song.ppq));
      }
      assert.deepEqual(song.tracks.slice(0, 4).map(t => t.notes), source.tracks.map(t => t.notes));
      if (id === 'echo-tide') {
        assert.equal(song.tracks.length, 5);
        assert.deepEqual(song.tracks[0].effects, {});
        assert.ok(song.tracks[4].effects.delay.feedback > 0.5);
        assert.ok(Math.max(...song.tracks[4].notes.map(n => n.midi)) < 72);
        assert.deepEqual(applySoundPreset(song, id), song);
      }
    }
  }
});

test('preset locks preserve exact notes, voices and optional effects', () => {
  const source = addPart(make(), 'keys', 19);
  source.tracks[0].effects = { reverb: { mix: 0.1, size: 0.3, damp: 0.8 } };
  const locks = Object.fromEntries(source.tracks.map(t => [t.id, { notes: true, instrument: true, mix: true }]));
  const before = JSON.stringify(source);
  for (const id of Object.keys(SOUND_PRESETS)) {
    const song = applySoundPreset(source, id, { locks });
    assert.deepEqual(song.tracks, source.tracks);
    assert.equal(JSON.stringify(source), before);
  }
  const background = source.tracks.at(-1);
  const notesOnly = applySoundPreset(source, 'echo-tide', { locks: { [background.id]: { notes: true } } });
  assert.deepEqual(notesOnly.tracks.at(-1).notes, background.notes);
  assert.equal(notesOnly.tracks.at(-1).seed, background.seed);
  const mixOnly = applySoundPreset(source, 'echo-tide', { locks: { keys: { mix: true } } });
  assert.deepEqual(mixOnly.tracks[0].effects, source.tracks[0].effects);
});

test('echo preset respects full and absent melody layouts and varies its background', () => {
  let full = make();
  for (let i = 0; i < 4; i++) full = addPart(full, 'bass', i);
  assert.equal(applySoundPreset(full, 'echo-tide').tracks.length, 8);
  const noKeys = { ...make(), tracks: make().tracks.filter(t => partType(t) !== 'keys') };
  assert.equal(applySoundPreset(noKeys, 'echo-tide').tracks.length, 3);
  assert.notDeepEqual(applySoundPreset(make(1), 'echo-tide').tracks.at(-1).notes,
    applySoundPreset(make(7), 'echo-tide').tracks.at(-1).notes);
  assert.throws(() => applySoundPreset(make(), 'missing'), /Unknown sound preset/);
});
