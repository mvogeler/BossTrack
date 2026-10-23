import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createSong, PPQ, tickSample } from '../engine/song.js';

test('song defaults and JSON preserve its score and output', () => {
  const tracks = [{ id: 'bass', instrument: 'bass', notes: [{ tick: PPQ, len: PPQ, midi: 48, vel: 0.7 }] }];
  const song = createSong({ tracks });
  assert.equal(song.v, 1);
  assert.equal(song.bars, 4);
  assert.equal(song.output.bitDepth, 24);
  assert.deepEqual(JSON.parse(JSON.stringify(song)), song);
});

test('absolute bar timing stays within half a sample at both rates', () => {
  for (const sampleRate of [44100, 48000]) {
    const song = createSong({ tempo: 137, bars: 256, sampleRate });
    assert.equal(tickSample(song, 0), 0);
    for (let bar = 1; bar <= song.bars; bar++) {
      const exact = bar * 4 * 60 * sampleRate / song.tempo;
      assert.ok(Math.abs(tickSample(song, bar * 4 * PPQ) - exact) <= 0.5);
    }
  }
});

test('invalid timing cannot allocate an unbounded song buffer', () => {
  for (const tempo of [0, NaN, Infinity, 301]) assert.throws(() => createSong({ tempo }));
  for (const bars of [0, 1.5, 257]) assert.throws(() => createSong({ bars }));
  assert.throws(() => createSong({ sampleRate: 0 }));
});

