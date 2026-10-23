import { createRng } from './rng.js';
import { degree } from './kit/music.js';
import { addNote } from './song.js';

export const PADS = {
  auto: { name: 'Auto (seed)' }, original: { name: 'Original' },
  holds: { name: 'Long holds', rhythms: [[0]], hold: 4 },
  halves: { name: 'Half-bar pulses', rhythms: [[0, 2], [0.25, 2]], hold: 1.65 },
  offbeat: { name: 'Offbeat pulses', rhythms: [[0.5, 1.5, 2.5, 3.5], [0.5, 1.75, 2.5, 3.5]], hold: 0.35, short: true },
  stabs: { name: 'Short stabs', rhythms: [[0, 1.5, 3], [0, 0.75, 2.5]], hold: 0.2, short: true },
  broken: { name: 'Broken chords', rhythms: [[0, 0.5, 1, 1.5, 2, 2.5, 3, 3.5], [0, 0.75, 1.5, 2, 2.75, 3.5]], hold: 0.42, short: true },
  alternating: { name: 'Alternating voicings', rhythms: [[0, 1, 2, 3], [0, 1.5, 2.5, 3.5]], hold: 0.65, short: true },
  sparse: { name: 'Sparse entries', rhythms: [[1.5], [0.5, 3]], hold: 0.8 },
  inner: { name: 'Moving inner voice', rhythms: [[0, 1.5, 2.5, 3], [0, 1, 2, 3.5]], hold: 0.8 },
};

export function choosePad(song, seed) {
  if (!song.pad || song.pad === 'original') return PADS.original;
  const choices = song.use === 'menu' ? ['holds', 'halves', 'sparse', 'inner'] : song.use === 'combat' ? ['offbeat', 'stabs', 'broken', 'alternating'] : Object.keys(PADS).slice(2);
  return PADS[song.pad === 'auto' ? createRng(seed).fork('pad-family').pick(choices) : song.pad];
}

export function fillPad(song, track) {
  const family = choosePad(song, track.seed);
  const rng = createRng(track.seed).fork('pad-pattern');
  const order = rng.pick([[0, 1, 2, 1], [2, 1, 0, 1]]);
  song.harmony.chords.forEach((chord, bar) => {
    if (family === PADS.sparse && bar % 2 && rng.chance(0.45)) return;
    const hit = (beat, midi, len) => {
      addNote(track, bar * 4 + beat, midi, len, rng.range(0.45, 0.6));
      if (family.short) track.notes.at(-1).articulation = 'short';
    };
    if (family === PADS.inner) [chord.notes[0], chord.notes[2]].forEach(midi => hit(0, midi, 4));
    const beats = rng.pick(family.rhythms).filter((_, i) => song.use !== 'menu' || family === PADS.halves || family === PADS.sparse || i % 2 === 0);
    beats.forEach((beat, i) => {
      const len = Math.min(family.hold, (beats[i + 1] ?? 4) - beat);
      let notes = chord.notes;
      if (family === PADS.broken) notes = [chord.notes[order[i % order.length]]];
      if (family === PADS.alternating) notes = chord.notes.map(n => n + (i % 2 ? 12 : 0));
      if (family === PADS.inner) {
        const index = song.harmony.scale.findIndex(n => n % 12 === chord.notes[1] % 12);
        const octave = Math.round((chord.notes[1] - song.harmony.scale[index]) / 12) * 12;
        notes = [degree(song.harmony.scale, index + (i % 2 ? rng.pick([-1, 1]) : 0)) + octave];
      }
      notes.forEach(midi => hit(beat, midi, len));
    });
  });
}
