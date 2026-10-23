import { createRng } from './rng.js';
import { degree } from './kit/music.js';
import { addNote } from './song.js';

export function fillFunk(song, track) {
  const rng = createRng(track.seed).fork('genre/funk');
  const hook = rng.pick([[0.25, 1, 1.75, 2.5, 3.25], [0, 0.75, 1.5, 2.75, 3.5], [0.5, 1.25, 2, 2.75, 3.75],
    [0, 1.25, 1.75, 2.5, 3.25], [0.25, 0.75, 1.5, 2.25, 3], [0.5, 1, 1.75, 2.75, 3.5]]);
  const motif = hook.map((_, i) => i === 0 ? 0 : rng.pick([0, 2, 3, 4, 6]));
  const stabs = rng.pick([[0.5, 1.75, 3.25], [0.75, 2.25, 3.5], [1, 1.75, 2.5, 3.75], [0.25, 1.5, 2.75]]);
  const bass = rng.pick([[0, 0.75, 1.5, 2.25, 3.5], [0, 1.25, 1.75, 2.75, 3.25],
    [0, 0.5, 1.75, 2.5, 3.75], [0, 0.75, 2, 2.75, 3.5]]);
  const gate = rng.pick([0.35, 0.5, 0.65]);
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
      addNote(track, bar * 4 + beat, midi, Math.min(len, 4 - beat), vel * r.range(0.92, 1));
      if (short) track.notes.at(-1).articulation = 'short';
    };
    if (track.id === 'keys') {
      hook.forEach((beat, i) => {
        if (menu && i % 2 || bar % 2 && i === 2 && r.chance(0.4)) return;
        const offset = bar === 3 && i === hook.length - 1 ? -step : motif[i];
        add(beat, degree(song.harmony.scale, step + offset), ((hook[i + 1] ?? 4) - beat) * gate, i === 0 ? 0.74 : 0.62);
      });
    } else if (track.id === 'pad') {
      for (const beat of menu ? [1, 3] : stabs) {
        if (beat > 1 && r.chance(0.25)) continue;
        chord.notes.slice(1).forEach(midi => add(beat, midi, gate * 0.4, 0.45, true));
      }
    } else if (track.id === 'bass') {
      for (const beat of menu ? [0, 2] : bass) {
        if (!menu && beat > 3 && r.chance(0.25)) continue;
        const offset = beat === 0 ? 0 : r.pick([0, 4, 6, 7]);
        add(beat, degree(song.harmony.scale, step + offset) - 24, gate * 0.55, beat === 0 ? 0.86 : 0.74);
      }
    } else if (track.id === 'drums') {
      for (const beat of menu ? [0, 2] : [0, ...r.pick([[1.75, 2.5], [0.75, 2.25], [1.5, 2.75], [2, 3.5]])]) add(beat, 36, 0.12, 0.77);
      for (const beat of [1, 3]) add(beat, 38, 0.1, 0.72);
      if (!menu) for (const beat of r.pick([[0.75, 2.75], [1.75, 3.25], [0.25, 2.5]])) add(beat, 38, 0.04, 0.2);
      for (let beat = 0.25; beat < 4; beat += menu ? 1 : 0.5) {
        if (!menu && r.chance(0.15)) continue;
        add(beat, 42, beat === 3.75 && r.chance(0.3) ? 0.1 : 0.045, beat % 1 === 0.25 ? 0.25 : 0.35);
      }
    }
  });
}
