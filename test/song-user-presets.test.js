import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createProceduralSong, addPart } from '../engine/song-compose.js';
import { partType, INSTRUMENTS } from '../engine/song-instruments.js';
import { captureSoundPreset, applyUserPreset, validUserPreset } from '../engine/song-user-presets.js';

const make = seed => createProceduralSong(seed, 'neutral', 'sketch', 'song',
  'auto', 'auto', 'auto', 'auto', 'auto', null, null, 'C', 'major', 'electronic');

test('user presets capture sounds only and match repeated roles without changing layout', () => {
  const source = addPart(make(42), 'keys', 7);
  source.tracks[0].effects = {};
  source.tracks.at(-1).effects = { delay: { mix: 0.3, beats: 0.5, feedback: 0.4, damp: 0.6 } };
  source.tracks.at(-1).instrument = 'celesta';
  const preset = captureSoundPreset(source, ' My sound ');
  assert.equal(preset.name, 'My sound');
  assert.equal(validUserPreset(preset), true);
  assert.equal(JSON.stringify(preset).includes('notes'), false);
  for (const seed of [1, 7, 42]) {
    const target = addPart(make(seed), 'keys', 99), before = structuredClone(target);
    target.soundPreset = 'gritty';
    const next = applyUserPreset(target, preset);
    assert.equal(next.soundPreset, undefined);
    assert.deepEqual(next.tracks.map(t => t.id), target.tracks.map(t => t.id));
    assert.deepEqual(next.tracks.map(t => t.notes), before.tracks.map(t => t.notes));
    assert.equal(next.tracks.at(-1).instrument, 'celesta');
    assert.deepEqual(next.tracks.at(-1).effects, preset.parts.at(-1).effects);
    assert.deepEqual(next, applyUserPreset(next, preset));
    assert.equal(target.tracks.at(-1).effects, undefined);
  }
  assert.equal(applyUserPreset(make(7), preset).tracks.length, 4);
});

test('presets respect notes, instrument and mix locks and restore octave offsets once', () => {
  const source = make(42);
  source.tracks[0].octaves = -1;
  source.tracks[0].notes = source.tracks[0].notes.map(n => ({ ...n, midi: n.midi - 12 }));
  source.tracks[0].effects = {};
  const preset = captureSoundPreset(source, 'Lower keys');
  const target = make(7);
  target.tracks[0].effects = { reverb: { mix: 0.2, size: 0.4, damp: 0.5 } };
  const applied = applyUserPreset(target, preset);
  assert.deepEqual(applied.tracks[0].notes.map(n => n.midi), target.tracks[0].notes.map(n => n.midi - 12));
  assert.deepEqual(applyUserPreset(applied, preset), applied);
  const locked = applyUserPreset(target, preset, { locks: { keys: { notes: true, instrument: true, mix: true } } });
  assert.deepEqual(locked.tracks[0], target.tracks[0]);
  for (const track of applied.tracks) {
    const range = INSTRUMENTS[track.instrument].range ?? [0, 127];
    assert.equal(INSTRUMENTS[track.instrument].part, partType(track));
    assert.ok(track.notes.every(n => n.midi >= range[0] && n.midi <= range[1]));
  }
  const narrow = structuredClone(preset);
  narrow.parts[0].instrument = 'archtop_jazz';
  target.tracks[0].notes[0].midi = 127;
  assert.equal(applyUserPreset(target, narrow, { locks: { keys: { notes: true } } }).tracks[0].instrument, target.tracks[0].instrument);
});

test('custom preset validation rejects unknown voices, effects, offsets and oversized names', () => {
  const preset = captureSoundPreset(make(1), 'Saved');
  for (const edit of [p => p.name = '', p => p.name = 'x'.repeat(81), p => p.parts[0].instrument = 'unknown',
    p => p.parts[0].part = 'bass', p => p.parts[0].effects = { delay: { mix: 2 } },
    p => p.parts[0].octaves = 11, p => p.parts[0].notes = [], p => p.extra = true]) {
    const bad = structuredClone(preset);
    edit(bad);
    assert.equal(validUserPreset(bad), false);
    assert.throws(() => applyUserPreset(make(1), bad), /Invalid sound preset/);
  }
  assert.equal(validUserPreset(null), false);
  assert.equal(validUserPreset({ name: 'Empty', parts: [] }), true);
});
