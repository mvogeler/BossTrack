import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createSongHistory } from '../engine/song-history.js';

test('history clones snapshots, dedupes, branches and stays bounded', () => {
  const history = createSongHistory(2);
  const a = { song: { seed: 1 }, mix: { gains: { keys: 0.5 } } };
  history.record(a);
  history.record(structuredClone(a));
  a.song.seed = 99;
  const b = { song: { seed: 2 } }, c = { song: { seed: 3 } };
  assert.deepEqual(history.undo(b).song, { seed: 1 });
  assert.equal(history.canUndo(), false);
  assert.deepEqual(history.redo({ song: { seed: 1 } }), b);
  history.record(b);
  history.record(c);
  assert.deepEqual(history.undo({ song: { seed: 4 } }), c);
  history.record({ song: { seed: 5 } });
  assert.equal(history.canRedo(), false);
  assert.deepEqual(history.undo({ song: { seed: 6 } }).song, { seed: 5 });
  assert.deepEqual(history.undo({ song: { seed: 5 } }), b);
  assert.equal(history.undo(b), null);
  history.clear();
  assert.equal(history.canUndo(), false);
  assert.equal(history.canRedo(), false);
  assert.throws(() => createSongHistory(0), /Invalid history/);
});

test('failed undo rendering can roll back the transfer without losing history', () => {
  const history = createSongHistory();
  const old = { song: { seed: 7 } }, current = { song: { seed: 42 } };
  history.record(old);
  const destination = history.undo(current);
  assert.deepEqual(history.redo(destination), current);
  assert.deepEqual(history.undo(current), old);
  assert.deepEqual(history.redo(old), current);
  assert.equal(history.canRedo(), false);
});
