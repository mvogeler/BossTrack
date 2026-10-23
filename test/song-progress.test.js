import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createProceduralSong } from '../engine/song-compose.js';
import { renderSong, renderSongSteps, mixParts } from '../engine/song-render.js';

test('yielded rendering keeps exact audio and reports increasing progress', () => {
  const song = createProceduralSong(42);
  const steps = renderSongSteps(song);
  let step, previous = 0, count = 0;
  do {
    step = steps.next();
    if (!step.done) { assert.ok(step.value >= previous && step.value < 1); previous = step.value; count++; }
  } while (!step.done);
  assert.ok(count > song.tracks[0].notes.length);
  assert.deepEqual(step.value, renderSong(song));
  const audio = step.value;
  const expected = mixParts(audio.parts, { solo: ['bass'], gains: { bass: 0.4 } });
  assert.equal(mixParts(audio.parts, { solo: ['bass'], gains: { bass: 0.4 } }, audio.channels[0].length, audio.channels), audio.channels);
  assert.deepEqual(audio.channels, expected);
});
