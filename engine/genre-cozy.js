import { createRng } from './rng.js';
import { degree } from './kit/music.js';
import { addNote } from './song.js';

export function fillCozy(song, track) {
  if (song.genreRevision === 2) return fillVariedCozy(song, track);
  const rng = createRng(track.seed).fork('genre/cozy');
  const rhythm = rng.pick([[0, 1, 2.5], [0.5, 1.5, 2.5]]);
  const motif = rng.pick([[0, 1, 2], [2, 1, 0], [0, 2, 1]]);
  const order = rng.pick([[0, 1, 2, 1], [0, 2, 1, 2]]);
  const menu = song.use === 'menu';
  song.harmony.chords.forEach((chord, bar) => {
    const start = bar * 4, step = song.harmony.steps[bar];
    if (track.id === 'keys') {
      rhythm.forEach((beat, i) => {
        if (menu && i === 1) return;
        const answer = bar % 2 === 1;
        const offset = answer ? motif[motif.length - 1 - i] : motif[i];
        let midi = degree(song.harmony.scale, step + offset);
        if (bar === 3 && i === 2) midi = song.harmony.root;
        while (midi > 84) midi -= 12;
        const next = rhythm[i + 1] ?? 4;
        addNote(track, start + beat, midi, (next - beat) * (answer && i === 2 ? 0.98 : 0.82),
          (i === 0 ? 0.7 : 0.55) * rng.range(0.94, 1.02));
      });
    } else if (track.id === 'pad') {
      const beats = menu ? [0, 2] : [0, 1, 2, 3];
      beats.forEach((beat, i) => {
        const midi = chord.notes[order[(i + bar % 2) % order.length]];
        addNote(track, start + beat, midi, 0.85, rng.range(0.38, 0.48));
      });
    } else if (track.id === 'bass') {
      let root = chord.root - 24;
      while (root < 28) root += 12;
      addNote(track, start, root, 2.65, rng.range(0.58, 0.68));
      if (!menu && bar % 2 === 0) {
        const next = song.harmony.steps[(bar + 1) % 4];
        let approach = degree(song.harmony.scale, next - 1) - 24;
        while (approach < 28) approach += 12;
        addNote(track, start + 3.5, approach, 0.4, 0.48);
      }
    } else {
      addNote(track, start, 36, 0.2, 0.5);
      if (!menu || bar % 2) addNote(track, start + 2, 38, 0.15, 0.36);
      for (const beat of menu ? [1, 3] : [0.5, 1.5, 2.5, 3.5]) {
        addNote(track, start + beat, 42, 0.07, rng.range(0.17, 0.25));
      }
    }
  });
  return track;
}

function fillVariedCozy(song, track) {
  const rng = createRng(track.seed).fork('genre/cozy/phrasing');
  const rhythm = rng.pick([[0, 1, 2.5], [0.5, 1.5, 3], [0, 1.5, 2, 3], [0.5, 2, 3.5]]);
  const motif = [rng.pick([0, 2, 4])];
  rhythm.slice(1).forEach(() => motif.push(Math.max(0, Math.min(5, motif.at(-1) + rng.pick([-2, -1, 1, 2])))));
  const backing = rng.pick([[0, 1, 2, 3], [0, 1.5, 2.5], [0.5, 2, 3], [0, 2.5]]);
  const order = rng.pick([[0, 1, 2, 1], [0, 2, 1, 2], [2, 1, 0, 1]]);
  const gate = rng.pick([0.65, 0.82, 0.96]);
  const menu = song.use === 'menu';
  song.harmony.chords.slice(0, 4).forEach((chord, bar) => {
    const add = (beat, midi, len, vel) => addNote(track, bar * 4 + beat, midi, len, vel);
    if (track.id === 'keys') {
      rhythm.forEach((beat, i) => {
        if ((menu && i === 1) || (bar % 2 && i === 1 && rng.chance(0.4))) return;
        let midi = degree(song.harmony.scale, song.harmony.steps[bar] + motif[bar % 2 ? motif.length - 1 - i : i]);
        if (bar === 3 && i === rhythm.length - 1) midi = song.harmony.root;
        while (midi > 84) midi -= 12;
        add(beat, midi, ((rhythm[i + 1] ?? 4) - beat) * gate, rng.range(0.5, 0.7));
      });
    } else if (track.id === 'pad') {
      backing.forEach((beat, i) => {
        if ((menu && i % 2) || (bar % 2 && i === 1 && rng.chance(0.4))) return;
        add(beat, chord.notes[order[(i + bar) % order.length]], Math.min(0.9, 4 - beat), rng.range(0.35, 0.46));
      });
    } else if (track.id === 'bass') {
      let midi = chord.root - 24;
      while (midi < 28) midi += 12;
      const beats = rng.pick([[0], [0, 2.5], [0.5, 3], [0, 3.5]]);
      beats.forEach((beat, i) => add(beat, midi + (i && rng.chance(0.4) ? 12 : 0), Math.min(i ? 0.45 : 2.4, 4 - beat), 0.6));
    } else if (track.id === 'drums') {
      add(0, 36, 0.2, 0.45);
      if (!menu && rng.chance(0.4)) add(rng.pick([1.5, 2.5, 3.5]), 36, 0.15, 0.32);
      if (!menu || bar % 2) add(2, 38, 0.12, 0.3);
      for (const beat of [0.5, 1.5, 2.5, 3.5]) {
        if (rng.chance(menu ? 0.45 : 0.8)) add(beat, 42, 0.06, rng.range(0.15, 0.23));
      }
    }
  });
  return track;
}
