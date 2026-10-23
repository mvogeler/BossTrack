import { addNote } from './song.js';
import { createRng } from './rng.js';
import { degree } from './kit/music.js';

export function fillSynthwave(song, track) {
  const rng = createRng(track.seed).fork('genre/synthwave');
  const hook = rng.pick([[0, 1.5, 2.5], [0.5, 2, 3], [0, 1, 2.75, 3.5], [0.5, 1.5, 3]]);
  const contour = hook.map(() => rng.pick([0, 2, 4, 5, 6]));
  const gate = rng.pick([0.35, 0.5, 0.65]);
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
        if (song.use === 'menu' && i % 2) return;
        const step = song.harmony.steps[bar] + contour[i] + (bar === 3 && i === 0 ? r.pick([-1, 0, 1]) : 0);
        add(beat, degree(song.harmony.scale, step) + 12, Math.min(gate, 4 - beat), 0.65);
      });
    } else if (track.id === 'pad') {
      const rest = r.pick([1, 3, 5, 7]);
      for (let i = 0; i < 8; i++) {
        if (i === rest || song.use === 'menu' && i % 2) continue;
        chord.notes.forEach(midi => add(i / 2, midi, 0.32, i % 2 ? 0.28 : 0.39));
      }
    } else if (track.id === 'bass') {
      const rest = r.pick([3, 5, 7]);
      for (let i = 0; i < 8; i++) {
        if (i === rest || song.use === 'menu' && i % 2) continue;
        add(i / 2, chord.root - 24 + (i % 2 ? 12 : 0), 0.3, i % 2 ? 0.58 : 0.75);
      }
    } else if (track.id === 'drums') {
      for (let beat = 0; beat < 4; beat++) {
        if (beat % 2 === 0 || r.chance(0.35)) add(beat, 36, 0.14, 0.8);
        if (beat % 2) add(beat, 38, 0.14, 0.73);
        add(beat + 0.5, 42, 0.09, 0.3);
        if (song.use !== 'menu' && bar % 2 && r.chance(0.35)) add(beat + 0.75, 42, 0.06, 0.2);
      }
    }
  });
}
