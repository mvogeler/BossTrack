import { createRng } from './rng.js';
import { degree } from './kit/music.js';
import { addNote } from './song.js';

export function fillMetal(song, track) {
  const rng = createRng(track.seed).fork('genre/metal');
  const cells = rng.pick([[0, 0.25, 0.5, 1, 1.5], [0, 0.25, 0.75, 1, 1.25, 1.75],
    [0, 0.5, 0.75, 1.25, 1.5], [0, 0.25, 0.5, 0.75, 1.5], [0, 0.5, 1, 1.25, 1.5, 1.75]]);
  const riff = [...cells, ...cells.map(beat => beat + 2)];
  const contour = cells.map((_, i) => i === 0 ? 0 : rng.pick([0, 0, 0, 2, 3, 4, 6]));
  const punches = rng.pick([[0, 2], [0, 1.5, 2.75], [0, 0.75, 2, 3.5], [0, 1, 2.5]]);
  const gate = rng.pick([0.38, 0.55, 0.7]);
  const menu = song.use === 'menu';
  song.harmony.chords.slice(0, 4).forEach((chord, bar) => {
    const r = rng.fork('bar/' + bar);
    const step = song.harmony.steps[bar];
    const add = (beat, midi, len, vel, short = false) => {
      if (track.id !== 'drums') {
        const low = track.id === 'bass' ? 28 : track.id === 'keys' ? 48 : 24;
        const high = track.id === 'bass' ? 68 : track.id === 'keys' ? 84 : 96;
        while (midi < low) midi += 12;
        while (midi > high) midi -= 12;
      }
      addNote(track, bar * 4 + beat, midi, Math.min(len, 4 - beat), vel * r.range(0.94, 1));
      if (short) track.notes.at(-1).articulation = 'short';
    };
    if (track.id === 'keys' || track.id === 'bass') {
      riff.forEach((beat, i) => {
        if (menu && i % 2 || bar % 2 && beat === 2.25 && r.chance(0.5)) return;
        let offset = contour[i % contour.length];
        if (bar === 3 && i === riff.length - 1) offset = -step;
        const midi = degree(song.harmony.scale, step + offset) - (track.id === 'bass' ? 24 : 12);
        add(beat, midi, ((riff[i + 1] ?? 4) - beat) * gate, beat % 1 ? 0.72 : 0.9);
      });
    } else if (track.id === 'pad') {
      for (const beat of menu ? [0, 2] : punches) {
        if (beat > 0 && r.chance(0.2)) continue;
        for (const offset of [0, 4]) add(beat, degree(song.harmony.scale, step + offset) - 12, 0.3 + gate, 0.53, true);
      }
    } else if (track.id === 'drums') {
      for (const beat of menu ? [0, 2] : riff) {
        if (beat % 1 === 0 || r.chance(0.8)) add(beat, 36, 0.1, beat % 1 ? 0.72 : 0.92);
      }
      if (song.genreRevision === 2) {
        if (bar === 0 || bar === 2) add(0, 49, 0.1, 0.58);
        if (!menu && bar % 2) for (const beat of [0.75, 2.75]) add(beat, 56, 0.1, 0.4);
      }
      for (const beat of [1, 3]) add(beat, 38, 0.1, 0.86);
      for (let beat = 0; beat < 4; beat += menu ? 1 : 0.5) add(beat, 42, 0.05, beat % 1 ? 0.29 : 0.44);
      if (!menu && bar === 3) for (const beat of r.pick([[3.25, 3.5, 3.75], [2.75, 3.5], [3.5, 3.75]])) add(beat, 38, 0.07, 0.65);
    }
  });
}
