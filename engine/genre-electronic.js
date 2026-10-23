import { addNote } from './song.js';
import { createRng } from './rng.js';
import { degree } from './kit/music.js';

export function fillElectronic(song, track) {
  const rng = createRng(track.seed).fork('genre/electronic');
  const menu = song.use === 'menu';
  const rhythm = rng.pick([[0.5, 1.5, 2.5, 3.5], [0.5, 1.5, 2.75, 3.5], [0.5, 1.75, 2.5, 3.5]]);
  const contour = rng.pick([[0, 2, 1, 2], [2, 1, 0, 1], [0, 1, 2, 1]]);
  const lift = rng.chance(0.5);
  const fill = rng.chance(0.75);
  const varied = song.genreRevision === 2;
  const r = rng.fork('phrasing');
  const hook = varied ? r.pick([[0.5, 1.5, 2.5, 3.5], [0.5, 1.25, 2.5, 3.25], [0, 0.75, 2.5, 3.5],
    [0.5, 1.5, 2.25, 2.75, 3.5], [0, 1.5, 2.5], [0.75, 1.5, 2.75, 3.5]]) : rhythm;
  const motif = [r.pick([0, 2, 4])];
  for (let i = 1; i < hook.length; i++) motif.push(Math.max(0, Math.min(6, motif[i - 1] + r.pick([-2, -1, 1, 2]))));
  const padBeats = r.pick([[0.25, 1.25, 2.25, 3.25], [0.25, 2.25, 3.25], [1.25, 2.75], [0.25, 1.75, 3.25]]);
  const bassBeats = r.pick([[0.5, 1.5, 2.5, 3.5], [0.5, 2.5, 3.5], [0.5, 1.5, 3.5]]);
  const hatRest = r.pick([-1, 1, 3]);
  const gate = r.pick([0.5, 0.7, 0.88]);
  song.harmony.chords.slice(0, 4).forEach((chord, bar) => {
    const answer = r.fork('bar/' + bar);
    const add = (beat, midi, len, vel, short = false) => {
      addNote(track, bar * 4 + beat, midi, len, vel * rng.range(0.92, 1));
      if (short) track.notes.at(-1).articulation = 'short';
    };
    if (track.id === 'keys') {
      hook.forEach((beat, i) => {
        if (menu && i % 2) return;
        if (varied && bar % 2 && i === 1 && answer.chance(0.4)) return;
        let midi = varied ? degree(song.harmony.scale, song.harmony.steps[bar] + motif[i]) + 12 :
          chord.notes[bar === 3 && i === 3 ? 0 : contour[i]] + 12;
        if (varied && bar === 3 && i === hook.length - 1) midi = song.harmony.root + 12;
        while (midi > 84) midi -= 12;
        const duration = varied ? Math.min(0.7, ((hook[i + 1] ?? 4) - beat) * gate) : i === 3 ? 0.4 : 0.28;
        add(beat, midi, duration, i === 0 ? 0.75 : 0.61);
      });
    } else if (track.id === 'pad') {
      for (const beat of menu ? [1.25, 3.25] : varied ? padBeats : [0.25, 1.25, 2.25, 3.25]) {
        chord.notes.forEach(midi => add(beat, midi, varied ? 0.12 + gate * 0.18 : 0.18, 0.4, true));
      }
    } else if (track.id === 'bass') {
      for (const beat of menu ? [0.5, 2.5] : varied ? bassBeats : [0.5, 1.5, 2.5, 3.5]) {
        let midi = chord.root - 24 + (lift && beat === 2.5 ? 12 : 0);
        if (varied && beat === 3.5 && bar < 3 && answer.chance(0.5)) midi = degree(song.harmony.scale, song.harmony.steps[bar] + 4) - 24;
        while (midi > 68) midi -= 12;
        add(beat, midi, bar === 3 && fill && beat === 3.5 ? 0.18 : varied ? 0.2 + gate * 0.3 : 0.32, 0.73);
      }
      if (!menu && bar === 3 && fill) add(3.75, chord.root - 24, 0.18, 0.58);
    } else if (track.id === 'drums') {
      for (let beat = 0; beat < 4; beat++) {
        add(beat, 36, 0.15, beat % 2 ? 0.73 : 0.82);
        if (beat % 2) add(beat, 38, 0.12, 0.68);
        if ((!menu || beat % 2 === 0) && (!varied || beat !== hatRest)) add(beat + 0.5, 42, 0.06, 0.35);
        if (varied && !menu && answer.chance(0.3)) add(beat + 0.75, 42, 0.04, 0.2);
      }
      if (varied && !menu && bar % 2 && answer.chance(0.5)) add(2.75, 38, 0.06, 0.23);
      if (!menu && bar === 3 && fill) {
        add(3.5, 38, 0.08, 0.38);
        add(3.75, 38, 0.08, 0.52);
      }
    }
  });
}
