import { createRng } from './rng.js';
import { degree } from './kit/music.js';
import { addNote } from './song.js';

export function fillRock(song, track) {
  const rng = createRng(track.seed).fork('genre/rock');
  const riff = rng.pick([[0, 0.5, 1.5, 2, 3], [0, 0.75, 1.5, 2.5, 3.5], [0, 1, 1.5, 2, 2.75, 3.5],
    [0, 0.5, 1, 2, 3.5], [0, 1.5, 2, 2.5, 3.25]]);
  const contour = riff.map((_, i) => i === 0 ? 0 : rng.pick([0, 2, 4, 5, 6]));
  const backing = rng.pick([[0, 2], [0, 1.5, 2.5], [0, 1, 2, 3], [0, 2, 3.5]]);
  const kick = rng.pick([[0, 2], [0, 0.5, 2.5], [0, 1.5, 2], [0, 2, 2.75]]);
  const menu = song.use === 'menu';
  const gate = rng.pick([0.55, 0.72, 0.88]);
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
      addNote(track, bar * 4 + beat, midi, Math.min(len, 4 - beat), vel * r.range(0.93, 1));
      if (short) track.notes.at(-1).articulation = 'short';
    };
    if (track.id === 'keys') {
      riff.forEach((beat, i) => {
        if (menu && i % 2 || bar % 2 && i === 1 && r.chance(0.35)) return;
        const offset = bar === 3 && i === riff.length - 1 ? -step : contour[i];
        const midi = degree(song.harmony.scale, step + offset);
        add(beat, midi, ((riff[i + 1] ?? 4) - beat) * gate, i === 0 ? 0.86 : 0.7);
        if (!menu && i === 0 && r.chance(0.5)) add(beat, degree(song.harmony.scale, step + 4), 0.32, 0.48);
      });
    } else if (track.id === 'pad') {
      for (const beat of menu ? [0, 2] : backing) {
        if (beat > 0 && r.chance(0.22)) continue;
        for (const offset of [0, 4]) add(beat, degree(song.harmony.scale, step + offset) - 12, gate * 0.8, 0.47, true);
      }
    } else if (track.id === 'bass') {
      for (const beat of menu ? [0, 2] : riff) {
        const offset = beat >= 3 && bar < 3 ? r.pick([0, 4, 6]) : 0;
        add(beat, degree(song.harmony.scale, step + offset) - 24, gate * 0.6, 0.78);
      }
    } else if (track.id === 'drums') {
      for (const beat of menu ? [0, 2] : kick) add(beat, 36, 0.14, 0.86);
      for (const beat of [1, 3]) add(beat, 38, 0.12, 0.81);
      for (let beat = 0; beat < 4; beat += menu ? 1 : 0.5) {
        if (beat % 1 && r.chance(0.15)) continue;
        add(beat, 42, beat === 3.5 && r.chance(0.4) ? 0.13 : 0.07, beat % 1 ? 0.3 : 0.42);
      }
      if (!menu && bar === 3) for (const beat of r.pick([[3.5], [2.75, 3.5, 3.75], [3.25, 3.5]])) add(beat, 38, 0.08, 0.6);
    }
  });
}
