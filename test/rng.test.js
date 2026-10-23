import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRng } from '../engine/rng.js';

const draws = (rng, n) => Array.from({ length: n }, rng.next);

test('same seed, same stream', () => {
  assert.deepEqual(draws(createRng(42), 100), draws(createRng(42), 100));
  assert.notDeepEqual(draws(createRng(42), 10), draws(createRng(43), 10));
});

test('next stays in [0, 1) and averages about 0.5', () => {
  const xs = draws(createRng(1), 20000);
  assert.ok(xs.every((x) => x >= 0 && x < 1));
  const mean = xs.reduce((a, b) => a + b) / xs.length;
  assert.ok(Math.abs(mean - 0.5) < 0.01, `mean ${mean}`);
});

test('range, logRange and int stay in bounds', () => {
  const rng = createRng(7);
  const logs = [];
  const ints = new Set();
  for (let i = 0; i < 5000; i++) {
    const r = rng.range(-3, 5);
    assert.ok(r >= -3 && r < 5);
    const l = rng.logRange(100, 10000);
    assert.ok(l >= 100 && l < 10000);
    logs.push(l);
    ints.add(rng.int(2, 6));
  }
  assert.deepEqual([...ints].sort(), [2, 3, 4, 5, 6]);
  logs.sort((a, b) => a - b);
  const median = logs[logs.length / 2];
  assert.ok(median > 850 && median < 1150, `median ${median}`);
});

test('weighted follows the weights', () => {
  const rng = createRng(9);
  const counts = { pew: 0, blaster: 0, beam: 0 };
  for (let i = 0; i < 20000; i++) counts[rng.weighted({ pew: 3, blaster: 1, beam: 0 })]++;
  assert.equal(counts.beam, 0);
  const ratio = counts.pew / counts.blaster;
  assert.ok(ratio > 2.8 && ratio < 3.2, `ratio ${ratio}`);
});

test('gauss has the right mean and spread', () => {
  const rng = createRng(11);
  const xs = Array.from({ length: 20000 }, () => rng.gauss(10, 2));
  const mean = xs.reduce((a, b) => a + b) / xs.length;
  const sd = Math.sqrt(xs.reduce((a, x) => a + (x - mean) ** 2, 0) / xs.length);
  assert.ok(Math.abs(mean - 10) < 0.05, `mean ${mean}`);
  assert.ok(Math.abs(sd - 2) < 0.05, `sd ${sd}`);
  assert.ok(xs.every(Number.isFinite));
});

test('fork ignores parent draws and depends on name and path', () => {
  const a = createRng(5);
  const b = createRng(5);
  draws(b, 50);
  assert.deepEqual(draws(a.fork('noise'), 20), draws(b.fork('noise'), 20));
  assert.notDeepEqual(draws(a.fork('noise'), 20), draws(a.fork('body'), 20));
  assert.notDeepEqual(draws(a.fork('x').fork('y'), 20), draws(a.fork('y').fork('x'), 20));
  assert.notDeepEqual(draws(a.fork('noise'), 20), draws(createRng(6).fork('noise'), 20));
});

test('pick and chance', () => {
  const rng = createRng(3);
  const seen = new Set();
  let hits = 0;
  for (let i = 0; i < 10000; i++) {
    seen.add(rng.pick(['a', 'b', 'c']));
    if (rng.chance(0.25)) hits++;
  }
  assert.equal(seen.size, 3);
  assert.ok(hits > 2300 && hits < 2700, `hits ${hits}`);
});
