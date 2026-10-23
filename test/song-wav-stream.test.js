import { test } from 'node:test';
import assert from 'node:assert/strict';
import { encodeWavChunks, encodeWavStream } from '../engine/wav.js';

test('disk-backed WAV reads match buffered bytes and retain the loop guard', async () => {
  const frames = 70003;
  const channels = [0, 1].map(c => Float32Array.from({ length: frames }, (_, i) => Math.sin(i * 0.031 + c) * 0.2));
  for (const bitDepth of [16, 24, 32]) for (const looping of [false, true]) {
    const options = { bitDepth, loop: looping ? { start: 137, end: frames } : null, gain: 0.75 };
    const expected = Buffer.concat([...encodeWavChunks(channels, 48000, options)]);
    const chunks = [];
    for await (const chunk of encodeWavStream(async (at, size) => {
      assert.ok(size <= 65536);
      return channels.map(ch => ch.subarray(at, at + size));
    }, frames, 48000, options)) chunks.push(chunk);
    assert.deepEqual(Buffer.concat(chunks), expected);
  }
});
