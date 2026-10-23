import { addNote } from './song.js';
import { createRng } from './rng.js';
import { degree } from './kit/music.js';

export function fillHouse(song, track) {
  const rng = createRng(track.seed).fork('genre/house');
  const pocket = rng.pick([[0.75, 1.5, 2.75], [0.5, 1.75, 3.25], [0.75, 2.25, 3.5], [0.25, 1.5, 3.25]]);
  const motif = pocket.map(() => rng.pick([0, 1, 2, 4, 5]));
  const gate = rng.pick([0.18, 0.28, 0.4]);
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
      pocket.forEach((beat, i) => {
        if (song.use === 'menu' && i === 1) return;
        const step = song.harmony.steps[bar] + motif[i] + (bar % 2 && i === 2 ? r.pick([-1, 0, 1]) : 0);
        add(beat, degree(song.harmony.scale, step) + 12, gate, i === 0 ? 0.7 : 0.57);
      });
    } else if (track.id === 'pad') {
      const beats = [pocket[0] - 0.25, pocket[1] + r.pick([0, 0.25]), 3 + r.pick([0, 0.25, 0.5])];
      for (const beat of song.use === 'menu' ? beats.slice(0, 2) : beats) {
        chord.notes.forEach(midi => add(beat, midi, gate, 0.43));
      }
    } else if (track.id === 'bass') {
      for (const beat of [0, 1.5, 2 + r.pick([0.25, 0.5]), 3.5]) {
        if (song.use === 'menu' && beat === 3.5) continue;
        add(beat, chord.root - 24 + (beat === 3.5 && r.chance(0.5) ? 12 : 0), 0.32, 0.75);
      }
    } else if (track.id === 'drums') {
      for (let beat = 0; beat < 4; beat++) {
        add(beat, 36, 0.14, 0.8);
        if (beat % 2) add(beat, 38, 0.1, 0.64);
        if (song.use !== 'menu' || beat % 2 === 0) add(beat + 0.5, 42, 0.08, 0.38);
        if (song.use !== 'menu' && r.chance(0.4)) add(beat + 0.75, 42, 0.05, 0.22);
      }
    }
  });
}
