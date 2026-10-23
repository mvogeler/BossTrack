import test from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { beginPreview, appendPreview, finishPreview, readPreview, releasePreview } from '../main/song-preview.js';
import { mixParts } from '../engine/song-render.js';

test('cached blocks keep complete-stem rounding, mix controls and seeks', async () => {
  const sender = new EventEmitter();
  for (const loop of [null, { start: 0, end: 1000 }]) {
    const meta = { frames: 1000, sampleRate: 48000, loop, parts: [{ id: 'keys' }, { id: 'pad' }] };
    const id = await beginPreview(sender, meta);
    try {
      const raw = meta.parts.map((p, c) => ({ id: p.id, channels: [
        Float32Array.from({ length: 1000 }, (_, i) => Math.sin(i * (c + 1)) * 0.9),
        Float32Array.from({ length: 1000 }, (_, i) => Math.cos(i * (c + 1)) * 0.7),
      ] }));
      for (const part of raw) for (const at of [0, 600]) {
        await appendPreview(sender, id, part.id, at, part.channels.map(ch => ch.slice(at, at ? 1000 : 600)));
      }
      finishPreview(sender, id, { gain: 0.41 });
      const parts = raw.map(p => ({ id: p.id, channels: p.channels.map(ch =>
        ch.map((x, i) => x * 0.41 * (loop ? 1 : Math.min(1, (999 - i) / 12000)))) }));
      for (const mix of [{}, { muted: ['pad'] }, { solo: ['pad'], gains: { pad: 0.33 } }, { solo: ['keys'], muted: ['keys'] }]) {
        const expected = mixParts(parts, mix, 1000);
        for (const at of [0, 719]) assert.deepEqual(await readPreview(sender, id, at, 281, mix), expected.map(ch => ch.slice(at, at + 281)));
      }
      assert.deepEqual(await readPreview(sender, id, 0, 1000, {}, 'pad'), parts[1].channels);
    } finally { await releasePreview(sender, id); }
    await assert.rejects(readPreview(sender, id, 0, 1), /no longer available/);
  }
});

test('preview cache rejects incomplete, oversized and foreign requests', async () => {
  const sender = new EventEmitter(), other = new EventEmitter();
  const id = await beginPreview(sender, { frames: 65537, sampleRate: 44100, loop: null, parts: [{ id: 'bass' }] });
  try {
    assert.throws(() => finishPreview(sender, id), /incomplete/);
    await assert.rejects(appendPreview(other, id, 'bass', 0, [new Float32Array(1), new Float32Array(1)]), /no longer available/);
    await assert.rejects(appendPreview(sender, id, 'bass', 0, [new Float32Array(65537), new Float32Array(65537)]), /Invalid preview block/);
    await appendPreview(sender, id, 'bass', 0, [new Float32Array(65536), new Float32Array(65536)]);
    await assert.rejects(appendPreview(sender, id, 'bass', 0, [new Float32Array(1), new Float32Array(1)]), /Invalid preview block/);
    await appendPreview(sender, id, 'bass', 65536, [new Float32Array(1), new Float32Array(1)]);
    finishPreview(sender, id);
    await assert.rejects(readPreview(sender, id, 0, 65537), /Invalid preview read/);
    await assert.rejects(readPreview(sender, id, 65537, 1), /Invalid preview read/);
    await assert.rejects(readPreview(sender, id, 0, 1, { gains: { bass: Infinity } }), /Invalid preview mix/);
    await assert.rejects(releasePreview(other, id), /no longer available/);
  } finally { await releasePreview(sender, id); }
});

test('zero-part previews stay silent and close with their window', async () => {
  const sender = new EventEmitter();
  const id = await beginPreview(sender, { frames: 100, sampleRate: 48000, loop: null, parts: [] });
  finishPreview(sender, id);
  assert.deepEqual(await readPreview(sender, id, 0, 100), [new Float32Array(100), new Float32Array(100)]);
  sender.emit('destroyed');
  await assert.rejects(readPreview(sender, id, 0, 100), /no longer available/);
});

test('closing during cache creation discards its unpublished files', async () => {
  const sender = new EventEmitter();
  const creating = beginPreview(sender, { frames: 100, sampleRate: 48000, loop: null, parts: [{ id: 'keys' }] });
  sender.emit('destroyed');
  await assert.rejects(creating, /window is closed/);
  await assert.rejects(beginPreview(sender, { frames: 100, sampleRate: 48000, loop: null, parts: [] }), /window is closed/);
});
