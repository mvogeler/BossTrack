import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { EventEmitter } from 'node:events';
import { beginStems, appendStem, finishStems, abortStems } from '../main/song-stems.js';
import { encodeWav } from '../engine/wav.js';

test('stem packs publish together, refuse foreign writers and clean canceled files', async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'stems-test-')), sender = new EventEmitter();
  const wav = encodeWav([new Float32Array(64), new Float32Array(64)], 48000);
  try {
    const id = await beginStems(sender, dir, ['keys.wav', 'bass.wav']);
    await assert.rejects(appendStem(new EventEmitter(), id, 'keys.wav', wav));
    await appendStem(sender, id, 'keys.wav', wav);
    await assert.rejects(finishStems(sender, id));
    await appendStem(sender, id, 'bass.wav', wav);
    const target = await finishStems(sender, id);
    assert.deepEqual((await fs.readdir(target)).sort(), ['bass.wav', 'keys.wav']);
    assert.deepEqual(await fs.readFile(target + '/keys.wav'), Buffer.from(wav));
    const bad = await beginStems(sender, dir, ['keys.wav', 'bass.wav']);
    await appendStem(sender, bad, 'keys.wav', wav);
    await appendStem(sender, bad, 'bass.wav', encodeWav([new Float32Array(32), new Float32Array(32)], 48000));
    await assert.rejects(finishStems(sender, bad), /timing differs/);
    await abortStems(sender, bad);
    const canceled = await beginStems(sender, dir, ['keys.wav']); await abortStems(sender, canceled);
    const malformed = await beginStems(sender, dir, ['keys.wav']);
    await appendStem(sender, malformed, 'keys.wav', new Uint8Array(64));
    await assert.rejects(finishStems(sender, malformed), /Invalid stem WAV/);
    await abortStems(sender, malformed);
    assert.deepEqual(await fs.readdir(dir), ['stems_001']);
    await assert.rejects(beginStems(sender, dir, ['../bad.wav']));
  } finally { await fs.rm(dir, { recursive: true }); }
});

test('stem loop markers must match and window closure removes unfinished packs', async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'stems-test-')), sender = new EventEmitter();
  const channels = [new Float32Array(64), new Float32Array(64)];
  try {
    const id = await beginStems(sender, dir, ['keys.wav', 'pad.wav']);
    await appendStem(sender, id, 'keys.wav', encodeWav(channels, 48000, { loop: { start: 0, end: 64 } }));
    await appendStem(sender, id, 'pad.wav', encodeWav(channels, 48000, { loop: { start: 16, end: 64 } }));
    await assert.rejects(finishStems(sender, id), /timing differs/);
    await abortStems(sender, id);
    await beginStems(sender, dir, ['keys.wav']);
    sender.emit('destroyed');
    for (let n = 0; n < 100 && (await fs.readdir(dir)).length; n++) await new Promise(resolve => setTimeout(resolve, 5));
    assert.deepEqual(await fs.readdir(dir), []);
  } finally { await fs.rm(dir, { recursive: true }); }
});

test('windows closed before or during stem setup leave no staging files', async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'stems-test-'));
  try {
    const closed = new EventEmitter(); closed.isDestroyed = () => true;
    await assert.rejects(beginStems(closed, dir, ['keys.wav']), /window is closed/);
    const sender = new EventEmitter(), opening = beginStems(sender, dir, ['keys.wav', 'bass.wav']);
    sender.emit('destroyed');
    await assert.rejects(opening, /window is closed/);
    await assert.rejects(beginStems(sender, dir, ['keys.wav']), /window is closed/);
    const finishing = new EventEmitter(), id = await beginStems(finishing, dir, ['keys.wav']);
    await appendStem(finishing, id, 'keys.wav', encodeWav([new Float32Array(4), new Float32Array(4)], 48000));
    const saving = finishStems(finishing, id); finishing.emit('destroyed');
    await assert.rejects(saving, /window is closed/);
    assert.deepEqual(await fs.readdir(dir), []);
  } finally { await fs.rm(dir, { recursive: true }); }
});
