import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createKit } from '../engine/kit/index.js';
import { music, noteNumber } from '../engine/kit/music.js';

const sr = 44100;
const base = createKit({ sampleRate: sr });
const k = { ...base, ...music({ n: base.n }) };
const near = (a, b, tol, msg) => assert.ok(Math.abs(a - b) <= tol, `${msg}: ${a} vs ${b}`);
const steps = (notes) => notes.slice(1).map((m, i) => m - notes[i]);

test('note names and midiHz', () => {
  assert.equal(noteNumber('C'), 60);
  assert.equal(noteNumber('A'), 69);
  assert.equal(noteNumber('F#'), 66);
  assert.equal(noteNumber('Bb'), 70);
  assert.equal(noteNumber('d', 3), 50);
  assert.equal(noteNumber(43), 43);
  assert.throws(() => noteNumber('H'));
  near(k.midiHz(69), 440, 1e-9, 'A4');
  near(k.midiHz(60), 261.6256, 1e-4, 'C4');
  near(k.midiHz(81), 880, 1e-9, 'A5');
});

test('scale intervals for every mode', () => {
  const want = {
    major: [2, 2, 1, 2, 2, 2],
    minor: [2, 1, 2, 2, 1, 2],
    dorian: [2, 1, 2, 2, 2, 1],
    phrygian: [1, 2, 2, 2, 1, 2],
    lydian: [2, 2, 2, 1, 2, 2],
    mixolydian: [2, 2, 1, 2, 2, 1],
    locrian: [1, 2, 2, 1, 2, 2],
    pentatonic: [2, 2, 3, 2],
    minorPentatonic: [3, 2, 2, 3],
    wholeTone: [2, 2, 2, 2, 2],
    harmonicMinor: [2, 1, 2, 2, 1, 3],
    chromatic: new Array(11).fill(1),
  };
  for (const [mode, s] of Object.entries(want)) {
    const notes = k.scale('C', mode);
    assert.equal(notes[0], 60, mode);
    assert.deepEqual(steps(notes), s, mode);
  }
  assert.deepEqual(k.scale('D', 'dorian'), [62, 64, 65, 67, 69, 71, 72]);
  assert.deepEqual(k.scale('F#', 'minorPentatonic', 3), [54, 57, 59, 61, 64]);
  assert.deepEqual(k.scale(50, 'pentatonic', 7), [50, 52, 54, 57, 59]);
  assert.throws(() => k.scale('C', 'bebop'));
});

test('degree wraps across octaves both ways', () => {
  const c = k.scale('C', 'major');
  assert.equal(k.degree(c, 0), 60);
  assert.equal(k.degree(c, 4), 67);
  assert.equal(k.degree(c, 7), 72);
  assert.equal(k.degree(c, 15), 86);
  assert.equal(k.degree(c, -1), 59);
  assert.equal(k.degree(c, -7), 48);
  assert.equal(k.degree(c, -8), 47);
  const pent = k.scale('A', 'pentatonic', 3);
  assert.equal(k.degree(pent, 5), pent[0] + 12);
  assert.equal(k.degree(pent, -5), pent[0] - 12);
});

test('chord qualities', () => {
  const want = {
    maj: [0, 4, 7],
    min: [0, 3, 7],
    sus2: [0, 2, 7],
    sus4: [0, 5, 7],
    maj7: [0, 4, 7, 11],
    min7: [0, 3, 7, 10],
    dom7: [0, 4, 7, 10],
    add9: [0, 4, 7, 14],
  };
  for (const [q, s] of Object.entries(want)) assert.deepEqual(k.chord('G', q), s.map((x) => 67 + x), q);
  assert.deepEqual(k.chord(48, 'min'), [48, 51, 55]);
  assert.deepEqual(k.chord('Eb', 'maj', 3), [51, 55, 58]);
  assert.throws(() => k.chord('C', 'dim13'));
});

const blip = (kit, note) => {
  const out = kit.buf(note.len);
  out[0] = note.vel;
  return out;
};

test('seq places notes on time and sums chords', () => {
  const notes = [
    { t: 0, midi: 60, vel: 0.5, len: 0.1 },
    { t: 0.25, midi: 64, vel: 0.3, len: 0.1 },
    { t: 0.25, midi: 67, vel: 0.2, len: 0.1 },
    { t: 0.5, midi: 72, len: 0.1 },
  ];
  const out = k.seq(notes, blip);
  assert.ok(out instanceof Float32Array);
  near(out[0], 0.5, 1e-7, 'first note');
  near(out[k.n(0.25)], 0.5, 1e-7, 'chord sums');
  near(out[k.n(0.5)], 1, 1e-7, 'vel defaults to 1');
  assert.equal(out.reduce((a, v) => a + (v !== 0), 0), 3);
});

test('seq length covers len plus tail and long voices', () => {
  const notes = [{ t: 0.2, midi: 60, len: 0.3 }];
  assert.equal(k.seq(notes, blip).length, k.n(0.5));
  assert.equal(k.seq(notes, blip, { tail: 0.4 }).length, k.n(0.9));
  const ring = (kit) => kit.buf(1);
  assert.equal(k.seq(notes, ring).length, k.n(0.2) + k.n(1));
});

test('seq per-note voice, stereo voices and the kit handed over', () => {
  let seen = null;
  const left = (kit, note) => {
    seen = kit;
    const l = kit.buf(note.len);
    l[0] = 1;
    return [l, kit.buf(note.len)];
  };
  const out = k.seq([{ t: 0, midi: 60, len: 0.1 }, { t: 0.1, midi: 62, len: 0.1, voice: left }], blip);
  assert.equal(out.length, 2);
  assert.equal(seen, k);
  assert.equal(out[0][0], 1);
  assert.equal(out[1][0], 1);
  assert.equal(out[0][k.n(0.1)], 1);
  assert.equal(out[1][k.n(0.1)], 0);
});
