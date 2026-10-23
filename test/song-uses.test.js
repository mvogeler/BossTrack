import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createProceduralSong, rerollPart, addPart } from '../engine/song-compose.js';
import { readSongFile } from '../engine/song-file.js';

const saved = (song) => ({ format: 'bosstrack-song', v: 1, renderer: 'song-v1', song,
  mix: { muted: [], solo: [], gains: {} }, repeat: false });

test('use presets preserve feeling harmony and tempo, with readable kick/bass timing', () => {
  for (const feeling of ['neutral', 'cozy', 'tense', 'uplifting']) for (let seed = 0; seed < 100; seed++) {
    const sketch = createProceduralSong(seed, feeling);
    const menu = createProceduralSong(seed, feeling, 'menu');
    const combat = createProceduralSong(seed, feeling, 'combat');
    assert.ok(menu.tracks[0].notes.length < combat.tracks[0].notes.length);
    assert.ok(menu.tracks[2].notes.length < combat.tracks[2].notes.length);
    assert.ok(menu.tracks[3].notes.length < combat.tracks[3].notes.length);
    for (const song of [menu, combat]) {
      assert.deepEqual(song, createProceduralSong(seed, feeling, song.use));
      assert.deepEqual(song.harmony, sketch.harmony);
      assert.equal(song.tempo, sketch.tempo);
      assert.equal(song.tracks[0].notes.at(-1).midi, sketch.tracks[0].notes.at(-1).midi);
      assert.deepEqual(readSongFile(JSON.stringify(saved(song))).song, song);
      for (const kick of song.tracks[3].notes.filter((n) => n.midi === 36)) assert.ok(song.tracks[2].notes.some((n) => n.tick === kick.tick));
      const changed = rerollPart(song, 'keys', 1234);
      assert.equal(changed.use, song.use);
      assert.deepEqual(changed.tracks.slice(1), song.tracks.slice(1));
    }
  }
});

test('invalid use data is rejected and existing scores remain Sketch', () => {
  assert.deepEqual(createProceduralSong(42, 'cozy', 'sketch'), createProceduralSong(42, 'cozy'));
  assert.throws(() => createProceduralSong(42, 'cozy', 'missing'), /Unknown use/);
  const file = saved(createProceduralSong(42, 'cozy', 'menu'));
  file.song.use = 'missing';
  assert.throws(() => readSongFile(JSON.stringify(file)), /saved use/);
});

test('trailer arrangements keep the rhythm moving through short and long forms', () => {
  for (const form of ['sketch', 'song', 'loop']) for (const seconds of [null, ...(form === 'sketch' ? [] : [120])]) {
    const song = createProceduralSong(42, 'tense', 'promo', form, 'auto', 'auto', 'auto', 'auto', 'auto', seconds);
    assert.deepEqual(song, createProceduralSong(42, 'tense', 'promo', form, 'auto', 'auto', 'auto', 'auto', 'auto', seconds));
    assert.deepEqual(readSongFile(JSON.stringify(saved(song))).song, song);
    const bars = song.bars - (form === 'song' ? 1 : 0);
    for (const track of song.tracks) {
      for (const note of track.notes) {
        assert.ok(note.len > 0 && note.vel > 0 && note.vel <= 1);
      }
      if (track.id === 'bass' || track.id === 'drums') {
        for (let bar = 0; bar < bars; bar++) {
          assert.ok(track.notes.some(n => n.tick >= bar * 4 * song.ppq && n.tick < (bar + 1) * 4 * song.ppq), track.id + ' bar ' + bar);
        }
      }
    }
    const added = addPart(song, 'keys');
    assert.deepEqual(added.tracks.slice(0, 4), song.tracks);
    assert.ok(added.tracks.at(-1).notes.some(n => n.tick < 4 * song.ppq));
  }
});
