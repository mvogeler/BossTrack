import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Worker } from 'node:worker_threads';
import { integratedLoudness } from '../engine/song-loudness.js';
import { createProceduralSong } from '../engine/song-compose.js';

const url = new URL('../engine/worker.js', import.meta.url).href;
test('worker meters snapshots, handles silence and still renders after a meter error', async () => {
  const worker = new Worker(`
    const { parentPort } = require('node:worker_threads');
    globalThis.self = { postMessage: (data, buffers) => parentPort.postMessage(data, buffers) };
    import(${JSON.stringify(url)}).then(() => parentPort.on('message', data => self.onmessage({data})));
  `, { eval: true });
  let id = 0;
  const request = data => new Promise((resolve, reject) => {
    const receive = result => {
      if (result.progress !== undefined) return;
      worker.off('message', receive); worker.off('error', reject);
      resolve(result);
    };
    worker.on('message', receive); worker.once('error', reject);
    worker.postMessage({id: ++id, ...data});
  });
  try {
    const sr = 48000;
    const channels = [Float32Array.from({length: sr}, (_, i) => 0.1 * Math.sin(2 * Math.PI * 1000 * i / sr))];
    const result = await request({measure: {channels, sampleRate: sr}});
    assert.equal(result.lufs, integratedLoudness(channels, sr));
    assert.equal(channels[0].length, sr);
    assert.equal((await request({measure: {channels: [new Float32Array(sr)], sampleRate: sr}})).lufs, -Infinity);
    assert.match((await request({measure: {channels: [], sampleRate: sr}})).error, /aligned/);
    const rendered = await request({patch: createProceduralSong(42)});
    assert.ok(rendered.channels[0].length > sr);
    assert.equal(rendered.parts.length, 4);
  } finally { await worker.terminate(); }
});
