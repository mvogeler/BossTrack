import { createRng } from './rng.js';
import { degree } from './kit/music.js';
import { addNote } from './song.js';

export function fillAmbient(song, track) {
  const rng = createRng(track.seed).fork('genre/ambient');
  const motif = rng.pick([[0, 4, 2, 0], [2, 1, 4, 0], [4, 2, 1, 0], [0, 2, 5, 2]]);
  const gate = rng.pick([0.7, 0.85, 0.98]);
  const menu = song.use === 'menu';
  song.harmony.chords.slice(0, 4).forEach((chord, bar) => {
    const add = (beat, midi, len, vel) => addNote(track, bar * 4 + beat, midi, Math.min(len, 4 - beat), vel);
    if (track.id === 'keys') {
      const beat = rng.pick([0, 0.5, 1, 1.5]);
      let midi = degree(song.harmony.scale, song.harmony.steps[bar] + motif[bar]);
      while (midi > 84) midi -= 12;
      add(beat, midi, (4 - beat) * gate, rng.range(0.35, 0.5));
      if (!menu && rng.chance(0.35)) {
        let answer = degree(song.harmony.scale, song.harmony.steps[bar] + rng.pick([0, 2, 4]));
        while (answer > 84) answer -= 12;
        add(3, answer, 0.95, 0.28);
      }
    } else if (track.id === 'pad') {
      chord.notes.forEach((midi, i) => {
        const beat = rng.pick([0, 0.25, 0.5, 0.75]) + i * 0.25;
        add(beat, midi, (4 - beat) * gate, rng.range(0.25, 0.35));
      });
      if (!menu && rng.chance(0.45)) {
        const ninth = degree(song.harmony.scale, song.harmony.steps[bar] + 8);
        add(rng.pick([1.5, 2.5]), ninth, 1.4, 0.2);
      }
    } else if (track.id === 'bass') {
      let midi = chord.root - 24;
      while (midi < 28) midi += 12;
      const beat = rng.pick([0, 0.5, 1]);
      add(beat, midi, (4 - beat) * rng.pick([0.7, 0.85, 1]), rng.range(0.36, 0.46));
    }
  });
  return track;
}
