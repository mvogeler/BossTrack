import { performTrack } from '../engine/song-playing.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createProceduralSong, KEYS, composePart } from '../engine/song-compose.js';
import { generateChoices } from '../engine/song-controls.js';
import { INSTRUMENTS } from '../engine/song-instruments.js';
import { readSongFile } from '../engine/song-file.js';

test('soft genres vary their performance and reopen across keys, modes and forms', () => {
  for (const genre of ['muzak', 'newage', 'incremental']) {
    const motifs = new Set();
    for (const seed of [1, 7, 42, 99]) for (const key of KEYS) for (const mode of ['major', 'minor']) for (const form of ['sketch', 'song', 'loop']) {
      const make = () => createProceduralSong(seed, 'neutral', 'sketch', form, 'auto', 'auto', 'auto', 'auto', 'auto', null, null, key, mode, genre);
      const song = generateChoices(make(), null, { varyInstruments: true });
      assert.deepEqual(song, generateChoices(make(), null, { varyInstruments: true }));
      const file = { format: 'bosstrack-song', v: 1, renderer: 'song-v1', song, repeat: false, mix: { muted: [], solo: [], gains: {} },
        assets: Object.fromEntries(song.tracks.filter(t => INSTRUMENTS[t.instrument].sample).map(t => [t.instrument, 'a'.repeat(64)])) };
      assert.deepEqual(readSongFile(JSON.stringify(file)).song, song);
      for (const track of song.tracks.filter(t => t.id !== 'drums')) assert.ok(track.notes.every(n => song.harmony.scale.some(p => p % 12 === n.midi % 12)));
      if (genre === 'newage') assert.equal(song.tracks[3].notes.length, 0);
      if (key === 'C' && mode === 'major' && form === 'sketch') motifs.add(JSON.stringify(song.tracks[0].notes));
    }
    assert.equal(motifs.size, 4);
  }
});

test('incremental backing adds chord pulses and shared swing while retaining the old score rules', () => {
  const song = createProceduralSong(42, 'neutral', 'sketch', 'sketch', 'auto', 'auto', 'auto', 'auto', 'auto',
    null, null, 'C', 'major', 'incremental');
  const old = structuredClone(song);
  delete old.genreRevision;
  for (const track of song.tracks) {
    const previous = composePart(old, track.id, track.seed);
    if (track.id === 'keys') assert.deepEqual(track.notes, performTrack(song, { ...previous, instrument: track.instrument }).notes);
    else assert.notDeepEqual(track.notes, previous.notes);
  }
  assert.equal(song.tracks[2].instrument, 'upright_bass');
  const pad = song.tracks[1].notes, hats = song.tracks[3].notes.filter(n => n.midi === 42);
  assert.ok(pad.some(n => n.tick > 0 && n.tick < 4 * song.ppq));
  const swing = hats[0].tick - song.ppq / 2;
  assert.ok(swing > 0 && swing < song.ppq / 4);
  assert.ok(hats.every(n => n.tick % song.ppq === song.ppq / 2 + swing));
  assert.ok(pad.some(n => n.tick === hats[1].tick));
  assert.equal(composePart(old, 'pad', old.tracks[1].seed).notes.length, 12);
});

test('incremental defaults keep a quiet repeating figure and allow pattern overrides', () => {
  const make = (melody = 'auto', form = 'loop', length = null) => createProceduralSong(42, 'neutral', 'sketch', form,
    melody, 'auto', 'auto', 'auto', 'auto', length, null, null, null, 'incremental');
  const song = make();
  assert.equal(song.tempo, 80);
  assert.equal(song.harmony.mode, 'major');
  assert.equal(song.tracks[0].instrument, 'soft_flute');
  for (const track of song.tracks) assert.ok(track.notes.every(n => n.vel <= 0.34));
  const named = make('singing');
  assert.notDeepEqual(named.tracks[0].notes, song.tracks[0].notes);
  assert.deepEqual(named.tracks.slice(1), song.tracks.slice(1));
  const long = make('auto', 'loop', 120);
  assert.ok(long.bars > song.bars);
  for (const track of long.tracks) assert.ok(track.notes.every(n => n.tick + n.len <= long.bars * 4 * long.ppq));
});
