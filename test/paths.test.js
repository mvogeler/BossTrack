import { test } from 'node:test';
import assert from 'node:assert/strict';
import os from 'node:os';
import path from 'node:path';
import { checkName, isInside } from '../main/paths.js';

test('isInside', () => {
  const root = path.join(os.tmpdir(), 'a', 'sounds');
  assert.ok(isInside(root, root));
  assert.ok(isInside(path.join(root, 'wash'), root));
  assert.ok(!isInside(root + 'x', root));
  assert.ok(!isInside(path.join(root, '..', 'secret'), root));
});

test('isInside on Windows drives and case', { skip: process.platform !== 'win32' }, () => {
  assert.ok(isInside('d:\\A\\Sounds\\wash', 'D:\\a\\sounds'));
  assert.ok(!isInside('C:\\a\\sounds', 'D:\\a\\sounds'));
});

test('checkName', () => {
  assert.equal(checkName('wash_paint_splat_03.wav'), 'wash_paint_splat_03.wav');
  assert.equal(checkName('Song 2.wav'), 'Song 2.wav');
  for (const bad of ['..\\x.wav', 'a/b.wav', 'x.exe', '.wav', 'x.json', 'Click 2.sfx.json', 'C:x.wav', '', 7]) {
    assert.throws(() => checkName(bad), undefined, String(bad));
  }
});
