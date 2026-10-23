import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createProceduralSong, rerollPart } from '../engine/song-compose.js';
import { readSongFile } from '../engine/song-file.js';
import { renderSong, mixParts } from '../engine/song-render.js';
import { encodeWav } from '../engine/wav.js';

const saved = () => ({ format: 'bosstrack-song', v: 1, renderer: 'song-v1',
  song: rerollPart(createProceduralSong(42), 'keys', 1234),
  mix: { muted: ['drums'], solo: ['keys', 'bass'], gains: { keys: 0.5, bass: 0.75 } }, repeat: true });

test('reopening keeps edited notes and produces the same audible WAV', () => {
  const file = saved();
  file.song.tracks[0].instrument = 'lead';
  const reopened = readSongFile(JSON.stringify(file));
  assert.deepEqual(reopened, file);
  const wav = (f) => encodeWav(mixParts(renderSong(f.song).parts, f.mix), f.song.output.sampleRate, f.song.output);
  assert.deepEqual(wav(reopened), wav(file));
  assert.notDeepEqual(reopened.song.tracks[0].notes, createProceduralSong(42).tracks[0].notes);
});

test('unsupported or malformed saves fail before rendering', () => {
  for (const change of [(f) => f.v = 2, (f) => f.song.bars = 256, (f) => f.song.tracks[0].notes[0].len = 1e9,
    (f) => f.song.tracks[0].instrument = 'missing', (f) => f.song.harmony.scale = [],
    (f) => f.mix.gains.keys = 2.01, (f) => f.song.tracks[0].instrument = 'kawai_piano']) {
    const file = saved(); change(file); assert.throws(() => readSongFile(JSON.stringify(file)));
  }
  const file = saved(); file.song.tracks[0].instrument = 'kawai_piano'; file.assets = { kawai_piano: 'a'.repeat(64) };
  assert.deepEqual(readSongFile(JSON.stringify(file)), file);
});
