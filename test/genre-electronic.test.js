import { performTrack } from '../engine/song-playing.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createProceduralSong } from '../engine/song-compose.js';
import { fillElectronic } from '../engine/genre-electronic.js';
import { readSongFile } from '../engine/song-file.js';
import { rerollPart } from '../engine/song-compose.js';

test('electronic revision varies audible rhythm and preserves exact saved performances', () => {
  const rhythms = { keys: new Set(), pad: new Set(), bass: new Set(), drums: new Set() };
  const melodies = new Set();
  for (let seed = 1; seed <= 100; seed++) {
    const song = createProceduralSong(seed, 'neutral', 'sketch', 'sketch', 'auto', 'auto', 'auto', 'auto', 'auto', null, 100, 'C', 'major', 'electronic');
    assert.equal(song.genreRevision, 2);
    for (const track of song.tracks) {
      rhythms[track.id].add(JSON.stringify(track.notes.map(n => [n.tick, n.len])));
      assert.deepEqual(track.notes, performTrack(song, { ...phrase(song, track.id, track.seed), instrument: track.instrument }).notes);
      assert.ok(track.notes.every(n => n.tick + n.len <= 16 * song.ppq));
      if (track.id !== 'drums') assert.ok(track.notes.every(n => song.harmony.scale.some(p => p % 12 === n.midi % 12)));
    }
    melodies.add(JSON.stringify(song.tracks[0].notes.map(n => [n.tick, n.len, n.midi])));
    const changed = rerollPart(song, 'keys', seed + 100);
    assert.deepEqual(changed.tracks.slice(1), song.tracks.slice(1));
    const file = { format: 'bosstrack-song', v: 1, renderer: 'song-v1', song,
      mix: { muted: [], solo: [], gains: {} }, repeat: false };
    assert.deepEqual(readSongFile(JSON.stringify(file)).song, song);
    file.song.genreRevision = 3;
    assert.throws(() => readSongFile(JSON.stringify(file)), /revision/);
  }
  assert.ok(melodies.size >= 80);
  for (const id of Object.keys(rhythms)) assert.ok(rhythms[id].size >= 10, id + ' rhythm variety');
});

function phrase(song, id, seed) {
  const track = { id, seed, notes: [] };
  fillElectronic(song, track);
  return track;
}

test('electronic phrases stay tonal, bounded and repeatable across keys and seeds', () => {
  const shapes = new Set();
  const rhythms = new Set();
  for (const key of ['C', 'F#', 'B']) for (const mode of ['major', 'minor']) for (let seed = 1; seed <= 12; seed++) {
    const song = createProceduralSong(seed, 'cozy', 'sketch', 'sketch', 'original', 'original', 'original', 'original', 'original', null, null, key, mode);
    const before = JSON.stringify(song);
    for (const id of ['keys', 'pad', 'bass', 'drums']) {
      const track = phrase(song, id, seed);
      assert.deepEqual(track, phrase(song, id, seed));
      assert.ok(track.notes.length > 0);
      for (const note of track.notes) {
        assert.ok(note.tick >= 0 && note.tick + note.len <= 16 * song.ppq);
        assert.ok(note.vel > 0 && note.vel <= 1);
        if (id === 'drums') assert.ok([36, 38, 42].includes(note.midi));
        else {
          const range = { keys: [48, 84], pad: [24, 96], bass: [28, 68] }[id];
          assert.ok(note.midi >= range[0] && note.midi <= range[1]);
          assert.ok(song.harmony.scale.some(midi => (midi - note.midi) % 12 === 0));
        }
      }
      if (id === 'keys') {
        shapes.add(JSON.stringify(track.notes.map(note => [note.tick, note.midi])));
        rhythms.add(JSON.stringify(track.notes.map(note => note.tick)));
      }
    }
    assert.equal(JSON.stringify(song), before);
  }
  assert.ok(shapes.size > 12);
  assert.equal(rhythms.size, 3);
});

test('electronic kick, bass and pad retain their interlocking pulse and menu spacing', () => {
  const song = createProceduralSong(42);
  const drums = phrase(song, 'drums', 42).notes;
  assert.deepEqual(drums.filter(note => note.midi === 36).map(note => note.tick), Array.from({ length: 16 }, (_, i) => i * song.ppq));
  assert.deepEqual(drums.filter(note => note.midi === 38 && note.tick % song.ppq === 0).map(note => note.tick), Array.from({ length: 8 }, (_, i) => (i * 2 + 1) * song.ppq));
  const pad = phrase(song, 'pad', 42).notes;
  const bass = phrase(song, 'bass', 42).notes;
  assert.ok(pad.every(note => note.articulation === 'short' && note.tick % song.ppq === song.ppq / 4));
  assert.ok(bass.every(note => note.tick % song.ppq >= song.ppq / 2));
  for (const id of ['keys', 'pad', 'bass', 'drums']) {
    assert.ok(phrase({ ...song, use: 'menu' }, id, 42).notes.length < phrase(song, id, 42).notes.length);
  }
});
