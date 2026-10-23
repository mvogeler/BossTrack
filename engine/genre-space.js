import { createRng } from './rng.js';
import { degree } from './kit/music.js';
import { addNote } from './song.js';

export function fillSpace(song, track) {
  const rng = createRng(track.seed).fork('genre/space-v2');
  if (track.id === 'keys') {
    const beats = [0, 3, 6, 10, 13];
    const motif = [0, 2, rng.pick([4, 5]), 3, 1];
    beats.forEach((beat, i) => addNote(track, beat, degree(song.harmony.scale, motif[i]),
      ((beats[i + 1] ?? 16) - beat) * 0.92, 0.57 + i * 0.035));
    return;
  }
  song.harmony.steps.forEach((step, bar) => {
    const base = bar * 4, chord = song.harmony.chords[bar];
    if (track.id === 'pad') {
      for (const midi of chord.notes) addNote(track, base, midi, 3.95, 0.44);
    } else if (track.id === 'bass') {
      const order = rng.pick([[0, 0, 4, 0, 0, 2, 0, 4], [0, 4, 0, 0, 2, 0, 4, 0]]);
      for (let i = 0; i < 8; i++) addNote(track, base + i * 0.5,
        degree(song.harmony.scale, step + order[i]) - 24, 0.38, i % 4 ? 0.53 : 0.69);
    } else if (track.id === 'drums' && bar === 3) {
      addNote(track, base + 3, 56, 0.1, 0.12);
    }
  });
}
