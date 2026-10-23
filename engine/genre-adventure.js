import { createRng } from './rng.js';
import { degree } from './kit/music.js';
import { addNote } from './song.js';

export function fillAdventure(song, track) {
  const rng = createRng(track.seed).fork('genre/adventure');
  const quiet = song.use === 'menu';
  const leap = rng.pick([3, 4]);
  const beats = quiet ? [0, 1.5, 2, 3] : [0, 0.75, 1, 2, 3];
  const motif = quiet ? [0, leap, leap - 1, 0] : [0, leap, leap - 1, leap - 2, 0];
  song.harmony.steps.forEach((step, bar) => {
    const base = bar * 4;
    if (track.id === 'keys') {
      const shift = degree(song.harmony.scale, step + leap) > 84 ? -12 : 0;
      beats.forEach((beat, i) => {
        const answer = bar % 2 && i === motif.length - 1 && bar < 3 ? 1 : motif[i];
        const offset = bar === 3 && i === motif.length - 1 ? -step : answer;
        const length = (beats[i + 1] ?? 4) - beat;
        addNote(track, base + beat, degree(song.harmony.scale, step + offset) + shift,
          length * (i === 1 ? 0.8 : 0.9), (i === 0 ? 0.84 : 0.7) * rng.range(0.96, 1.03));
      });
    } else if (track.id === 'bass') {
      const entries = quiet ? [0, 1, 2, 3] : rng.pick([[0, 0.5, 1, 1.5, 2, 2.5, 3, 3.5], [0, 0.75, 1.5, 2.25, 3]]);
      entries.forEach((beat, i) => {
        const offset = i % 2 ? 4 : 0;
        const length = (entries[i + 1] ?? 4) - beat;
        addNote(track, base + beat, degree(song.harmony.scale, step + offset) - 24,
          length * 0.78, (i % 2 ? 0.61 : 0.77) * rng.range(0.95, 1.04));
      });
    } else if (track.id === 'pad') {
      for (const midi of song.harmony.chords[bar].notes) addNote(track, base, midi, 3.85, rng.range(0.42, 0.51));
    } else if (track.id === 'drums') {
      for (const beat of [0, 2]) addNote(track, base + beat, 36, 0.2, beat === 0 ? 0.8 : 0.68);
      for (const beat of [1, 3]) addNote(track, base + beat, 38, 0.18, rng.range(0.58, 0.68));
      for (const beat of quiet ? [0, 2] : [0, 0.5, 1, 1.5, 2, 2.5, 3, 3.5]) {
        addNote(track, base + beat, 42, 0.08, beat % 1 ? 0.23 : 0.34);
      }
      if (!quiet && bar === 3) for (const beat of rng.pick([[3.5, 3.75], [3.25, 3.5, 3.75]])) {
        addNote(track, base + beat, 38, 0.12, beat === 3.75 ? 0.65 : 0.43);
      }
    }
  });
}
