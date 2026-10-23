import { addNote } from './song.js';
import { createRng } from './rng.js';
import { degree } from './kit/music.js';

export function fillDnb(song, track) {
  const rng = createRng(track.seed).fork('genre/dnb');
  const hook = rng.pick([[0, 1.75, 3.25], [0.5, 2.5, 3.5], [0, 0.75, 2.25, 3.5], [0.25, 1.5, 2.75]]);
  const motif = hook.map(() => rng.pick([0, 2, 3, 4, 6]));
  song.harmony.chords.slice(0, 4).forEach((chord, bar) => {
    const r = rng.fork('bar/' + bar);
    const add = (beat, midi, len, vel) => {
      if (track.id !== 'drums') {
        const [lo, hi] = track.id === 'bass' ? [28, 68] : track.id === 'keys' ? [48, 84] : [24, 96];
        while (midi > hi) midi -= 12;
        while (midi < lo) midi += 12;
      }
      addNote(track, bar * 4 + beat, midi, len, vel * r.range(0.91, 1));
      if (track.id === 'pad') track.notes.at(-1).articulation = 'short';
    };
    if (track.id === 'keys') {
      hook.forEach((beat, i) => {
        if (song.use === 'menu' && i === 1) return;
        add(beat, degree(song.harmony.scale, song.harmony.steps[bar] + motif[i]) + 12, r.pick([0.2, 0.35, 0.45]), 0.6);
      });
    } else if (track.id === 'pad') {
      const beats = [r.pick([0, 0.5, 0.75]), 2 + r.pick([0, 0.25, 0.75])];
      for (const beat of song.use === 'menu' ? beats.slice(0, 1) : beats) {
        chord.notes.forEach(midi => add(beat, midi, 0.65, 0.36));
      }
    } else if (track.id === 'bass') {
      const beats = [0, r.pick([1.5, 1.75]), r.pick([2.25, 2.5, 2.75]), 3.5];
      beats.forEach((beat, i) => {
        if (song.use === 'menu' && i % 2) return;
        add(beat, chord.root - 24 + (i === 2 && r.chance(0.5) ? 12 : 0), i === 0 ? 0.85 : 0.3, 0.78);
      });
    } else if (track.id === 'drums') {
      add(0, 36, 0.14, 0.86);
      add(r.pick([2.25, 2.5, 2.75]), 36, 0.13, 0.75);
      add(1, 38, 0.1, 0.77);
      add(3, 38, 0.1, 0.82);
      for (let i = 0; i < 16; i++) {
        if (song.use === 'menu' && i % 2 || i % 2 && r.chance(0.35)) continue;
        add(i / 4, 42, 0.045, i % 2 ? 0.18 : 0.3);
      }
      if (song.use !== 'menu') add(r.pick([0.75, 1.75, 2.75, 3.75]), 38, 0.05, 0.2);
    }
  });
}
