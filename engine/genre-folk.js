import { createRng } from './rng.js';
import { degree } from './kit/music.js';
import { addNote } from './song.js';

export function fillFolk(song, track) {
  const rng = createRng(track.seed).fork('genre/folk');
  const hook = rng.pick([[0, 1, 2, 3], [0, 1.5, 2.5], [0.5, 1.5, 2, 3], [0, 0.5, 2, 3.5]]);
  const motif = [rng.pick([0, 2, 4])];
  hook.slice(1).forEach(() => motif.push(Math.max(0, Math.min(5, motif.at(-1) + rng.pick([-2, -1, 1, 2])))));
  const picking = rng.pick([[0, 2, 1, 2, 0, 1, 2, 1], [0, 1, 2, 1, 0, 2, 1, 2], [0, 2, 0, 1, 2, 1, 0, 2]]);
  const rest = rng.pick([-1, 3, 5, 7]);
  const menu = song.use === 'menu';
  song.harmony.chords.slice(0, 4).forEach((chord, bar) => {
    const add = (beat, midi, len, vel) => addNote(track, bar * 4 + beat, midi, Math.min(len, 4 - beat), vel);
    if (track.id === 'keys') {
      hook.forEach((beat, i) => {
        if ((menu && i % 2) || (bar % 2 && i === 1 && rng.chance(0.4))) return;
        const offset = motif[bar % 2 ? motif.length - 1 - i : i];
        let midi = degree(song.harmony.scale, song.harmony.steps[bar] + offset);
        if (bar === 3 && i === hook.length - 1) midi = song.harmony.root;
        while (midi > 84) midi -= 12;
        add(beat, midi, ((hook[i + 1] ?? 4) - beat) * rng.pick([0.7, 0.85, 0.95]), 0.65);
      });
    } else if (track.id === 'pad') {
      picking.forEach((tone, i) => {
        if ((menu && i % 2) || i === rest || (i % 2 && rng.chance(0.12))) return;
        const midi = chord.notes[picking[(i + bar % 2) % picking.length]];
        add(i * 0.5, midi, rng.pick([0.35, 0.6, 0.8]), i % 2 ? 0.34 : 0.43);
      });
    } else if (track.id === 'bass') {
      const beats = rng.pick([[0, 2], [0, 2, 3], [0, 1.5, 2.5], [0, 2.5]]);
      beats.forEach((beat, i) => {
        let midi = degree(song.harmony.scale, song.harmony.steps[bar] + (i % 2 ? 4 : 0)) - 24;
        while (midi < 28) midi += 12;
        add(beat, midi, rng.pick([0.8, 1.2, 1.7]), 0.6);
      });
    } else if (track.id === 'drums') {
      add(0, 36, 0.15, 0.5);
      if (!menu && rng.chance(0.7)) add(2, 36, 0.15, 0.4);
      add(1, 38, 0.1, 0.32); add(3, 38, 0.1, 0.36);
      for (let beat = 0; beat < 4; beat += 0.5) {
        if (rng.chance(menu ? 0.3 : 0.65)) add(beat, 42, 0.05, Number.isInteger(beat) ? 0.22 : 0.14);
      }
    }
  });
  return track;
}
