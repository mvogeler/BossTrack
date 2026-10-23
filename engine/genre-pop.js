import { createRng } from './rng.js';
import { degree } from './kit/music.js';
import { addNote } from './song.js';

export function fillPop(song, track) {
  const rng = createRng(track.seed).fork('genre/pop');
  const hook = rng.pick([[0, 1, 1.5, 2.5, 3], [0, 0.75, 1.5, 2, 3.25], [0, 1.5, 2, 2.5, 3.5],
    [0, 0.5, 1.5, 2.5], [0, 0.75, 1.25, 2, 2.75, 3.5], [0, 1, 2.5, 3.5]]);
  const motif = [rng.pick([0, 2, 4])];
  for (let i = 1; i < hook.length; i++) motif.push(Math.max(0, Math.min(6, motif[i - 1] + rng.pick([-2, -1, 0, 1, 2]))));
  const chords = rng.pick([[0, 2], [0, 1.5, 3], [0, 1, 2.5], [0, 2, 3.5]]);
  const bass = rng.pick([[0, 2, 3.5], [0, 1.5, 2.5], [0, 1, 2, 3], [0, 2.5, 3.25]]);
  const gate = rng.pick([0.7, 0.85, 0.97]);
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
      addNote(track, bar * 4 + beat, midi, Math.min(len, 4 - beat), vel * r.range(0.93, 1));
      if (short) track.notes.at(-1).articulation = 'short';
    };
    if (track.id === 'keys') {
      hook.forEach((beat, i) => {
        if (menu && i % 2 || bar % 2 && i === 2 && r.chance(0.4)) return;
        const offset = bar === 3 && i === hook.length - 1 ? -step : motif[i];
        add(beat, degree(song.harmony.scale, step + offset) + 12, ((hook[i + 1] ?? 4) - beat) * gate, i === 0 ? 0.78 : 0.64);
      });
    } else if (track.id === 'pad') {
      for (const beat of menu ? [0, 2] : chords) {
        if (beat > 0 && r.chance(0.2)) continue;
        chord.notes.forEach(midi => add(beat, midi, beat === 0 ? gate * 1.3 : gate * 0.65, 0.42, true));
      }
    } else if (track.id === 'bass') {
      for (const beat of menu ? [0, 2] : bass) {
        const offset = beat >= 3 ? r.pick([0, 4, 7]) : 0;
        add(beat, degree(song.harmony.scale, step + offset) - 24, gate * 0.65, 0.73);
      }
    } else if (track.id === 'drums') {
      for (const beat of [0, 2]) add(beat, 36, 0.14, 0.79);
      if (!menu && r.chance(0.65)) add(r.pick([0.75, 1.5, 2.75, 3.5]), 36, 0.12, 0.65);
      for (const beat of [1, 3]) add(beat, 38, 0.12, 0.72);
      for (let beat = 0.5; beat < 4; beat += menu ? 1 : 0.5) {
        if (!menu && r.chance(0.15)) continue;
        add(beat, 42, 0.06, beat % 1 ? 0.27 : 0.2);
      }
      if (!menu && bar === 3) add(r.pick([2.75, 3.5, 3.75]), 38, 0.08, 0.46);
    }
  });
}
