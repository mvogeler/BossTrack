import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { EventEmitter } from 'node:events';
import { beginWav, appendWav, finishWav, abortWav } from '../main/song-export.js';

test('streamed saves publish complete bytes, reject overwrites and remove partial files', async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'wav-test-'));
  const sender = new EventEmitter(), target = dir + '/song.wav';
  try {
    const id = await beginWav(sender, target);
    await appendWav(sender, id, Uint8Array.of(1, 2));
    await appendWav(sender, id, Uint8Array.of(3));
    await assert.rejects(fs.access(target));
    assert.equal(await finishWav(sender, id), target);
    assert.deepEqual(await fs.readFile(target), Buffer.from([1, 2, 3]));
    const duplicate = await beginWav(sender, target);
    await assert.rejects(finishWav(sender, duplicate), { code: 'EEXIST' });
    await abortWav(sender, duplicate);
    const canceled = await beginWav(sender, dir + '/canceled.wav');
    await appendWav(sender, canceled, Uint8Array.of(4));
    await abortWav(sender, canceled);
    assert.deepEqual(await fs.readdir(dir), ['song.wav']);
  } finally { await fs.rm(dir, { recursive: true }); }
});
