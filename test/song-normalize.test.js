import { test } from 'node:test';
import assert from 'node:assert/strict';
import { integratedLoudness, loudnessGain } from '../engine/song-loudness.js';
import { peak } from '../engine/post.js';
import { encodeWav, encodeWavChunks } from '../engine/wav.js';
import { createProceduralSong } from '../engine/song-compose.js';
import { readSongFile } from '../engine/song-file.js';

const sr = 48000;
test('normalization reaches target with a shared gain and preserves quiet sections', () => {
  const x = Float32Array.from({length: sr * 4}, (_, i) => (i < sr * 2 ? 0.03 : 0.06) * Math.sin(2 * Math.PI * 1000 * i / sr));
  const channels = [x, x.map(value => value * 0.5)];
  const gain = loudnessGain(integratedLoudness(channels, sr), peak(channels));
  const out = channels.map(ch => ch.map(value => value * gain));
  assert.ok(Math.abs(integratedLoudness(out, sr) + 16) < 0.01);
  assert.ok(Math.abs(out[0][12] / out[1][12] - 2) < 1e-6);
  assert.ok(Math.abs(out[0][sr * 2 + 12] / out[0][12] - 2) < 1e-5);
  assert.ok(peak(out) <= 10 ** (-1 / 20));
});

test('normalization caps peak gain and leaves silence alone', () => {
  assert.equal(loudnessGain(-40, 0.8), 10 ** (-1 / 20) / 0.8);
  assert.equal(loudnessGain(-Infinity, 0), 1);
  assert.throws(() => loudnessGain(NaN, 1));
});

test('normalized chunks preserve input, PCM, dither and loop guard at every bit depth', () => {
  const channels = [Float32Array.from({length: 65539}, (_, i) => 0.2 * Math.sin(i * 0.1))];
  const before = channels[0].slice();
  for (const bitDepth of [16, 24, 32]) {
    const options = {bitDepth, loop: {start: 65537, end: 65539}};
    assert.deepEqual(Buffer.concat([...encodeWavChunks(channels, sr, {...options, gain: 2})]),
      Buffer.from(encodeWav(channels.map(ch => ch.map(value => value * 2)), sr, options)));
  }
  assert.deepEqual(channels[0], before);
});

test('saved normalization preference is optional and validated', () => {
  const file = {format: 'bosstrack-song', v: 1, renderer: 'song-v1', song: createProceduralSong(42), mix: {muted: [], solo: [], gains: {}}, repeat: false};
  assert.equal(readSongFile(JSON.stringify(file)).normalizeWav, undefined);
  assert.equal(readSongFile(JSON.stringify({...file, normalizeWav: true})).normalizeWav, true);
  assert.throws(() => readSongFile(JSON.stringify({...file, normalizeWav: 'yes'})), /normalization/);
});
