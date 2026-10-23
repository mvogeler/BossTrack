import { test } from 'node:test';
import assert from 'node:assert/strict';
import { encodeWav, encodeWavChunks } from '../engine/wav.js';

test('streamed WAV matches whole-file PCM, dither, padding and loop metadata', () => {
  for (const bitDepth of [16, 24, 32]) for (const count of [1, 2]) for (const looping of [false, true]) {
    const channels = Array.from({ length: count }, (_, c) => Float32Array.from({ length: 65539 }, (_, i) => i % 7 ? Math.sin(i * 0.03 + c) * 0.7 : 0));
    const options = { bitDepth, loop: looping ? { start: 65537, end: channels[0].length } : null };
    const chunks = [...encodeWavChunks(channels, 48000, options)];
    assert.deepEqual(Buffer.concat(chunks), Buffer.from(encodeWav(channels, 48000, options)));
    assert.ok(chunks.every(chunk => chunk.byteLength <= 65536 * count * bitDepth / 8));
  }
});
