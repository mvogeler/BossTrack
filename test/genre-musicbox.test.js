import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createProceduralSong, rerollPart, addPart } from '../engine/song-compose.js';
import { fillMusicbox, MUSICBOX_RANGES } from '../engine/genre-musicbox.js';
import { INSTRUMENTS } from '../engine/song-instruments.js';
import { readSongFile } from '../engine/song-file.js';
import { songVoiceBlocks } from '../engine/song-voice.js';

const keys = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
const sketch = (seed, key = 'C', mode = 'major') =>
  createProceduralSong(seed, 'neutral', 'sketch', 'sketch', 'original', 'original', 'original', 'original', 'original', null, 96, key, mode);
const make = (seed, form = 'sketch', use = 'sketch', length = null, mode = null, drums = 'auto') =>
  createProceduralSong(seed, 'neutral', use, form, 'auto', drums, 'auto', 'auto', 'auto', length, null, null, mode, 'musicbox');
const reopen = song => readSongFile(JSON.stringify({ format: 'bosstrack-song', v: 1, renderer: 'song-v1', song,
  mix: { muted: [], solo: [], gains: {} }, repeat: song.form === 'loop',
  assets: Object.fromEntries(song.tracks.filter(t => INSTRUMENTS[t.instrument].sample).map(t => [t.instrument, 'a'.repeat(64)])) })).song;

function phrase(song, id, seed) {
  const track = { id, seed, notes: [] };
  fillMusicbox(song, track);
  return track.notes;
}

test('music box parts stay tonal and in their comb registers across keys and modes', () => {
  for (const key of keys) for (const mode of ['major', 'minor']) for (let seed = 1; seed <= 8; seed++) {
    const song = sketch(seed, key, mode);
    const before = JSON.stringify(song);
    for (const id of ['keys', 'pad', 'bass']) {
      const notes = phrase(song, id, seed);
      assert.deepEqual(notes, phrase(song, id, seed));
      assert.ok(notes.length > 0);
      const [low, high] = MUSICBOX_RANGES[id];
      for (const note of notes) {
        assert.ok(note.tick >= 0 && note.len > 0 && note.tick + note.len <= 16 * song.ppq);
        assert.ok(note.vel > 0 && note.vel <= 1);
        assert.ok(note.midi >= low && note.midi <= high, id + ' ' + note.midi);
        assert.ok(song.harmony.scale.some(n => (n - note.midi) % 12 === 0));
      }
      if (id === 'pad') assert.ok(notes.every(n => n.tick % (song.ppq / 2) === 0));
      if (id === 'bass') assert.ok(notes.every(n => n.tick % (2 * song.ppq) === 0));
    }
    assert.deepEqual(phrase(song, 'drums', seed), []);
    assert.equal(JSON.stringify(song), before);
  }
});

test('music box seeds vary the tune, the arpeggio and the low pulse', () => {
  const song = sketch(42);
  const tunes = new Set(), arps = new Set(), lows = new Set();
  for (let seed = 1; seed <= 100; seed++) {
    tunes.add(JSON.stringify(phrase(song, 'keys', seed).map(n => [n.tick, n.midi])));
    arps.add(JSON.stringify(phrase(song, 'pad', seed).map(n => [n.tick, n.midi])));
    lows.add(JSON.stringify(phrase(song, 'bass', seed).map(n => [n.tick, n.midi])));
  }
  assert.ok(tunes.size >= 40, 'tune variety ' + tunes.size);
  assert.ok(arps.size >= 6, 'arpeggio variety ' + arps.size);
  assert.ok(lows.size >= 3, 'bass variety ' + lows.size);
  const menu = { ...song, use: 'menu' };
  for (const id of ['keys', 'pad']) assert.ok(phrase(menu, id, 42).length < phrase(song, id, 42).length);
});

test('the music box genre ships synth tine voices, stays major by default and leaves drums silent', () => {
  const song = make(42);
  assert.equal(song.tempo, 96);
  assert.equal(song.harmony.mode, 'major');
  assert.equal(make(42, 'sketch', 'sketch', null, 'minor').harmony.mode, 'minor');
  assert.deepEqual(song.tracks.map(t => t.instrument), ['tine_box', 'tine_box_chords', 'tine_box_bass', 'drums_soft_perc']);
  for (const id of ['tine_box', 'tine_box_chords', 'tine_box_bass']) assert.equal(INSTRUMENTS[id].sample, undefined);
  assert.ok(song.tracks.every(t => t.effects === undefined));
  for (const [form, use, length] of [['sketch', 'sketch', null], ['song', 'sketch', null], ['loop', 'menu', null], ['loop', 'combat', null],
    ['song', 'workout', null], ['song', 'sketch', 120], ['loop', 'hype', 180]]) for (const seed of [1, 42]) {
    const next = make(seed, form, use, length);
    assert.deepEqual(reopen(next), next);
    assert.deepEqual(next.tracks[3].notes, [], form + ' ' + use + ' ' + length);
    assert.ok(next.tracks.slice(0, 3).every(t => t.notes.length > 0));
    assert.ok(next.tracks[2].notes.every(n => n.midi >= 41));
  }
  assert.deepEqual(rerollPart(song, 'drums', 7).tracks[3].notes, []);
  const added = addPart(song, 'drums', 7);
  assert.deepEqual(added.tracks.at(-1).notes, []);
  assert.ok(make(42, 'sketch', 'sketch', null, null, 'drive').tracks[3].notes.length > 0);
});

test('the tine chord and bass voices play the same comb tone as the melody', () => {
  const note = { midi: 60 };
  const pcm = id => {
    const { blocks } = songVoiceBlocks(id, note, 0.5, 44100, 42, 0.625);
    return Array.from(blocks(4096)).flatMap(([block]) => Array.from(block));
  };
  const tine = pcm('tine_box');
  assert.deepEqual(pcm('tine_box_chords'), tine);
  assert.deepEqual(pcm('tine_box_bass'), tine);
});
