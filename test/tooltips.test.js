import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { TOOLTIPS } from '../src/ui/tooltips.js';

test('every plain tooltip name is a control in music.html', () => {
  const html = fs.readFileSync(new URL('../src/music.html', import.meta.url), 'utf8');
  const missing = Object.keys(TOOLTIPS).filter(name => !name.includes('.') && !html.includes('id="' + name + '"'));
  assert.deepEqual(missing, []);
});

test('every tooltip has text', () => {
  for (const [name, text] of Object.entries(TOOLTIPS)) assert.ok(text, name);
});
