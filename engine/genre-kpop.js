import { createRng } from './rng.js';
import { degree } from './kit/music.js';
import { addNote } from './song.js';

export function fillKpop(song, track) {
  const rng = createRng(track.seed).fork('genre/kpop');
  const hook = rng.pick([[0.25, 0.75, 1.5, 2, 3.25], [0, 0.5, 1.75, 2.5, 3.5], [0.5, 1, 1.25, 2.75, 3.5],
    [0, 1.25, 1.75, 2.5, 3, 3.5], [0.25, 1, 2, 2.75], [0, 0.75, 1.5, 2.25, 3.5]]);
  const motif = hook.map((_, i) => i === 0 ? rng.pick([0, 2, 4]) : rng.pick([0, 1, 2, 4, 5, 6]));
  const stabs = rng.pick([[0.75, 2.5], [0, 1.75, 3.25], [0.5, 2, 3.5], [0.25, 1.5, 2.75]]);
  const pulse = rng.pick([[0, 0.75, 2, 2.75], [0, 1.25, 2.5, 3.5], [0, 0.5, 1.5, 2.75, 3.25]]);
  const halftime = rng.chance(0.5);
  const menu = song.use === 'menu';
  const gate = rng.pick([0.48, 0.68, 0.84]);
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
      hook.forEach((beat, i) => {
        if (menu && i % 2 || bar % 2 && i === 1 && r.chance(0.45)) return;
        const offset = bar === 3 && i === hook.length - 1 ? -step : motif[i];
        add(beat, degree(song.harmony.scale, step + offset) + 12, ((hook[i + 1] ?? 4) - beat) * gate, i === 0 ? 0.81 : 0.66);
      });
    } else if (track.id === 'pad') {
      for (const beat of menu ? [0, 2] : stabs) {
        if (beat > 0 && r.chance(0.2)) continue;
        chord.notes.forEach(midi => add(beat, midi, 0.2 + gate * 0.25, 0.42, true));
      }
    } else if (track.id === 'bass') {
      for (const beat of menu ? [0, 2] : pulse) {
        if (!menu && bar % 2 && beat === 0.75 && r.chance(0.5)) continue;
        const offset = beat > 2 ? r.pick([0, 4, 7]) : 0;
        add(beat, degree(song.harmony.scale, step + offset) - 24, gate * 0.65, 0.77);
      }
    } else if (track.id === 'drums') {
      for (const beat of menu ? [0] : pulse) add(beat, 36, 0.12, beat === 0 ? 0.85 : 0.68);
      for (const beat of halftime && bar % 2 ? [2] : [1, 3]) add(beat, 38, 0.12, 0.78);
      if (song.genreRevision === 2) {
        for (const beat of halftime && bar % 2 ? [2] : [1, 3]) add(beat, 39, 0.1, 0.44);
        if (bar === 0 || bar === 2) add(0, 49, 0.1, 0.46);
        if (!menu) for (const beat of [0.5, 1.5, 2.5, 3.5]) add(beat, 54, 0.05, 0.2);
      }
      for (let beat = 0.25; beat < 4; beat += menu ? 1 : 0.5) {
        if (!menu && r.chance(0.2)) continue;
        add(beat, 42, 0.04, beat % 1 === 0.25 ? 0.29 : 0.2);
        if (!menu && r.chance(0.35)) add(beat + 0.125, 42, 0.035, 0.16);
      }
      if (!menu && bar === 3) for (const beat of r.pick([[3.5], [3.25, 3.75], [2.75, 3.5]])) add(beat, 38, 0.07, 0.45);
    }
  });
}
