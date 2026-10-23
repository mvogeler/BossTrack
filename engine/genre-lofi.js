import { createRng } from './rng.js';
import { degree } from './kit/music.js';
import { addNote } from './song.js';

export function fillLofi(song, track) {
  const rng = createRng(track.seed).fork('genre/lofi');
  const swing = rng.pick([0.6, 0.625, 0.66]);
  const hook = rng.pick([[0, 1.5, 2.5], [0.5, 1, 2.5, 3.5], [0, 0.5, 2, 3.5], [1, 1.5, 3]]);
  const motif = [rng.pick([0, 2, 4])];
  hook.slice(1).forEach(() => motif.push(Math.max(0, Math.min(6, motif.at(-1) + rng.pick([-2, -1, 1, 2])))));
  const chords = rng.pick([[0, 2.5], [0.5, 2], [0, 1.5, 3], [1, 2.5]]);
  const bass = rng.pick([[0, 2], [0, 2.5, 3.5], [0.5, 2.5], [0, 1.5, 3]]);
  const menu = song.use === 'menu';
  song.harmony.chords.slice(0, 4).forEach((chord, bar) => {
    const swung = beat => Number.isInteger(beat) ? beat : Math.floor(beat) + swing;
    const add = (beat, midi, len, vel) => addNote(track, bar * 4 + swung(beat), midi, Math.min(len, 4 - swung(beat)), vel);
    if (track.id === 'keys') {
      hook.forEach((beat, i) => {
        if ((menu && i % 2) || (bar % 2 && i === 1 && rng.chance(0.5))) return;
        let midi = degree(song.harmony.scale, song.harmony.steps[bar] + motif[i]);
        if (bar === 3 && i === hook.length - 1) midi = song.harmony.root;
        while (midi > 84) midi -= 12;
        add(beat, midi, rng.pick([0.25, 0.5, 0.75]), rng.range(0.48, 0.65));
      });
    } else if (track.id === 'pad') {
      chords.forEach((beat, i) => {
        if ((menu && i) || (bar % 2 && i && rng.chance(0.35))) return;
        const seventh = degree(song.harmony.scale, song.harmony.steps[bar] + 6);
        [...chord.notes, seventh].forEach(midi => add(beat, midi, rng.pick([0.7, 1, 1.4]), 0.32));
      });
    } else if (track.id === 'bass') {
      bass.forEach((beat, i) => {
        if (menu && i > 1) return;
        let midi = i && rng.chance(0.4) ? degree(song.harmony.scale, song.harmony.steps[bar] + 4) - 24 : chord.root - 24;
        while (midi < 28) midi += 12;
        add(beat, midi, rng.pick([0.45, 0.7, 1]), 0.62);
      });
    } else if (track.id === 'drums') {
      add(0, 36, 0.15, 0.7);
      if (!menu) add(rng.pick([1.5, 2.5, 3.5]), 36, 0.15, 0.53);
      add(1, 38, 0.12, 0.48); add(3, 38, 0.12, 0.52);
      for (let beat = 0; beat < 4; beat += 0.5) {
        if (rng.chance(menu ? 0.45 : 0.85)) add(beat, 42, 0.05, Number.isInteger(beat) ? 0.23 : 0.16);
      }
      if (!menu && rng.chance(0.5)) add(2.5, 38, 0.06, 0.18);
    }
  });
  return track;
}
