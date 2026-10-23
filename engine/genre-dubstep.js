import { addNote } from './song.js';
import { createRng } from './rng.js';
import { degree } from './kit/music.js';

export function fillDubstep(song, track) {
  const rng = createRng(track.seed).fork('genre/dubstep');
  const hook = rng.pick([[0, 1.25, 3.25], [0.5, 1.5, 3.5], [0.25, 1, 3], [0, 0.75, 3.25]]);
  const motif = hook.map(() => rng.pick([0, 1, 2, 4, 6]));
  const gate = rng.pick([0.18, 0.3, 0.45]);
  song.harmony.chords.slice(0, 4).forEach((chord, bar) => {
    const r = rng.fork('bar/' + bar);
    const add = (beat, midi, len, vel) => {
      if (track.id !== 'drums') {
        const [lo, hi] = track.id === 'bass' ? [28, 68] : track.id === 'keys' ? [48, 84] : [24, 96];
        while (midi > hi) midi -= 12;
        while (midi < lo) midi += 12;
      }
      addNote(track, bar * 4 + beat, midi, len, vel * r.range(0.92, 1));
      if (track.id === 'pad') track.notes.at(-1).articulation = 'short';
    };
    if (track.id === 'keys') {
      hook.forEach((beat, i) => {
        if (song.use === 'menu' && i === 1) return;
        add(beat, degree(song.harmony.scale, song.harmony.steps[bar] + motif[i]) + 12, gate, 0.68);
      });
    } else if (track.id === 'pad') {
      const beats = [r.pick([0, 0.25, 0.5]), 2.5 + r.pick([0, 0.25, 0.5])];
      for (const beat of song.use === 'menu' ? beats.slice(0, 1) : beats) {
        chord.notes.forEach(midi => add(beat, midi, 0.42, 0.32));
      }
    } else if (track.id === 'bass') {
      const beats = bar % 2 ? [0, r.pick([0.75, 1.25]), 2.75, 3.5] : [0, r.pick([1, 1.5]), 3];
      beats.forEach((beat, i) => {
        if (song.use === 'menu' && i > 1) return;
        const len = Math.min(i === 0 ? r.pick([0.6, 0.9, 1.2]) : gate, (beats[i + 1] ?? 4) - beat - 0.08);
        const step = song.harmony.steps[bar] + (i === 2 ? r.pick([0, 4]) : 0);
        add(beat, degree(song.harmony.scale, step) - 24, len, 0.84);
      });
    } else if (track.id === 'drums') {
      add(0, 36, 0.16, 0.88);
      add(2, 38, 0.14, 0.88);
      if (song.use !== 'menu') add(r.pick([1.25, 1.5, 3.25, 3.5]), 36, 0.12, 0.68);
      for (let i = 0; i < 8; i++) {
        if (song.use === 'menu' && i % 2 || r.chance(0.2)) continue;
        add(i / 2 + 0.25, 42, 0.06, i % 2 ? 0.18 : 0.32);
      }
    }
  });
}
