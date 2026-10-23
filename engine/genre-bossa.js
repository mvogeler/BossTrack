import { createRng } from './rng.js';
import { degree } from './kit/music.js';
import { addNote } from './song.js';

export function fillBossa(song, track) {
  const rng = createRng(track.seed).fork('genre/bossa');
  const hook = rng.pick([[0.5, 1.5, 2, 3.5], [0, 1.5, 2.5], [0.5, 1, 2.5, 3], [0, 0.5, 2, 3.5]]);
  const motif = [rng.pick([0, 2, 4])];
  hook.slice(1).forEach(() => motif.push(Math.max(0, Math.min(6, motif.at(-1) + rng.pick([-2, -1, 1, 2])))));
  const comp = rng.pick([[0, 1.5, 2.5], [0.5, 2, 3.5], [0, 1.5, 3], [0, 2, 3.5]]);
  const menu = song.use === 'menu';
  song.harmony.chords.slice(0, 4).forEach((chord, bar) => {
    const add = (beat, midi, len, vel, short = false) => {
      addNote(track, bar * 4 + beat, midi, Math.min(len, 4 - beat), vel);
      if (short) track.notes.at(-1).articulation = 'short';
    };
    if (track.id === 'keys') {
      hook.forEach((beat, i) => {
        if ((menu && i % 2) || (bar % 2 && i === 1 && rng.chance(0.45))) return;
        let midi = degree(song.harmony.scale, song.harmony.steps[bar] + motif[i]);
        if (bar === 3 && i === hook.length - 1) midi = song.harmony.root;
        while (midi > 84) midi -= 12;
        add(beat, midi, rng.pick([0.4, 0.65, 0.9]), rng.range(0.5, 0.67));
      });
    } else if (track.id === 'pad') {
      comp.forEach((beat, i) => {
        if ((menu && i === 1) || (bar % 2 && i === 1 && rng.chance(0.4))) return;
        const tones = rng.chance(0.5) ? chord.notes.slice(1) : chord.notes;
        tones.forEach(midi => add(beat, midi, rng.pick([0.25, 0.4, 0.55]), 0.38, true));
        if (rng.chance(0.6)) add(beat, degree(song.harmony.scale, song.harmony.steps[bar] + 6), 0.35, 0.29, true);
      });
    } else if (track.id === 'bass') {
      const beats = rng.pick([[0, 2], [0, 1.5, 2], [0, 2, 3.5], [0.5, 2]]);
      beats.forEach((beat, i) => {
        let midi = degree(song.harmony.scale, song.harmony.steps[bar] + (i % 2 ? 4 : 0)) - 24;
        while (midi < 28) midi += 12;
        add(beat, midi, rng.pick([0.75, 1, 1.35]), 0.58);
      });
    } else if (track.id === 'drums') {
      add(0, 36, 0.14, 0.38); add(2, 36, 0.14, 0.34);
      for (const beat of bar % 2 ? [0.5, 2, 3.5] : [0, 1.5, 3]) {
        if (!menu || rng.chance(0.65)) add(beat, 38, 0.06, 0.22);
      }
      for (let beat = 0.5; beat < 4; beat += 0.5) {
        if (rng.chance(menu ? 0.4 : 0.75)) add(beat, 42, 0.04, rng.range(0.12, 0.2));
      }
    }
  });
  return track;
}
