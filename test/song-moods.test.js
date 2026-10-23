import test from 'node:test';
import assert from 'node:assert/strict';
import { createProceduralSong, rerollPart, addPart } from '../engine/song-compose.js';
import { GENRES } from '../engine/song-genres.js';
import { INSTRUMENTS } from '../engine/song-instruments.js';
import { readSongFile } from '../engine/song-file.js';

const make = (feeling, use, genre, seconds = null, seed = 42) => createProceduralSong(seed, feeling, use, 'loop', 'auto', 'auto', 'auto', 'auto', 'auto', seconds, null, 'C', null, genre);
const reopen = song => readSongFile(JSON.stringify({ format: 'bosstrack-song', v: 1, renderer: 'song-v1', song,
  mix: { muted: [], solo: [], gains: {} }, repeat: true,
  assets: Object.fromEntries(song.tracks.filter(t => INSTRUMENTS[t.instrument].sample).map(t => [t.instrument, 'a'.repeat(64)])) })).song;

test('new moods and uses compose valid deterministic short and long scores across genres', () => {
  for (const genre of Object.keys(GENRES).filter(id => !GENRES[id].composed)) for (const [feeling, use] of [['melancholy', 'sketch'], ['romantic', 'love'], ['hype', 'hype'], ['menacing', 'intimidation'], ['neutral', 'workout']]) {
    for (const seconds of [null, 120, 300]) {
      const song = make(feeling, use, genre, seconds);
      assert.deepEqual(reopen(song), song);
      assert.deepEqual(make(feeling, use, genre, seconds), song);
      for (const track of song.tracks) assert.ok(track.notes.every(n => track.id === 'drums' || song.harmony.scale.some(p => p % 12 === n.midi % 12)));
      assert.deepEqual(reopen(rerollPart(song, 'keys', 7)).tracks.slice(1), song.tracks.slice(1));
      assert.deepEqual(reopen(addPart(song, 'keys', 7)).tracks.slice(0, 4), song.tracks);
    }
  }
});

test('moods override automatic tempo and harmony while manual choices stay selected', () => {
  assert.equal(make('melancholy', 'sketch', 'metal').tempo, 76);
  assert.equal(make('melancholy', 'sketch', 'metal').harmony.mode, 'minor');
  assert.equal(make('romantic', 'love', 'kpop').harmony.mode, 'major');
  const manual = createProceduralSong(42, 'melancholy', 'workout', 'loop', 'singing', 'auto', 'auto', 'heroic', 'auto', null, 157, 'F#', 'major', 'metal');
  assert.equal(manual.tempo, 157); assert.equal(manual.harmony.mode, 'major'); assert.equal(manual.harmony.root, 66);
  assert.deepEqual(manual.harmony.steps, createProceduralSong(42, 'neutral', 'sketch', 'loop', 'singing', 'auto', 'auto', 'heroic', 'auto', null, 157, 'F#', 'major', 'metal').harmony.steps);
});

test('workout maintains its kick pulse through intro and contrast sections', () => {
  for (const genre of ['metal', 'kpop', 'electronic', 'folk']) {
    const song = make('neutral', 'workout', genre, 120), drums = song.tracks[3];
    for (let bar = 0; bar < song.bars; bar++) for (let beat = 0; beat < 4; beat++) {
      assert.ok(drums.notes.some(n => n.midi === 36 && n.tick === (bar * 4 + beat) * song.ppq));
    }
  }
});

test('melancholy and hype write distinct lead phrases rather than only changing levels', () => {
  for (const genre of ['metal', 'kpop', 'folk']) {
    const quiet = make('melancholy', 'sketch', genre).tracks[0];
    const hype = make('hype', 'sketch', genre).tracks[0];
    assert.notDeepEqual(quiet.notes.map(n => [n.tick, n.midi]), hype.notes.map(n => [n.tick, n.midi]));
    assert.ok(quiet.notes.length > 0);
  }
});
