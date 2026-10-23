import { createRng } from './rng.js';
import { degree } from './kit/music.js';
import { addNote } from './song.js';

export function fillIncremental(song, track) {
  if (song.genreRevision === 2 && track.id !== 'keys') return fillIncrementalBacking(song, track);
  const rng = createRng(track.seed).fork('genre/incremental');
  const order = rng.pick([[0, 1, 2, 1], [0, 2, 1, 2], [1, 0, 2, 1], [2, 1, 0, 1]]);
  const spacing = song.use === 'menu' ? 1 : 0.5;
  song.harmony.chords.slice(0, 4).forEach((chord, bar) => {
    const add = (beat, midi, len, vel) => addNote(track, bar * 4 + beat, midi, Math.min(len, 4 - beat), vel);
    if (track.id === 'keys') {
      for (let beat = 0, i = 0; beat < 4; beat += spacing, i++) {
        const index = order[(i + (bar % 2 ? 1 : 0)) % order.length];
        let midi = chord.notes[index];
        while (midi < 60) midi += 12;
        add(beat, midi, spacing * 0.82, rng.range(0.24, 0.34));
      }
    } else if (track.id === 'pad') {
      for (const midi of chord.notes) add(0, midi, 3.8, rng.range(0.16, 0.21));
    } else if (track.id === 'bass') {
      let midi = chord.root - 24;
      while (midi < 28) midi += 12;
      add(0, midi, 2.8, rng.range(0.2, 0.26));
      if (bar % 2) add(3, midi, 0.7, 0.17);
    } else if (track.id === 'drums') {
      add(0, 36, 0.12, 0.16);
      if (song.use !== 'menu') add(2, 38, 0.08, 0.07);
      for (const beat of [1, 3]) add(beat, 42, 0.04, rng.range(0.04, 0.07));
    }
  });
  return track;
}

function fillIncrementalBacking(song, track) {
  const rng = createRng(track.seed).fork('genre/incremental/backing');
  const swing = createRng(song.seed).fork('incremental/swing').pick([0.06, 0.1, 0.14]);
  const menu = song.use === 'menu';
  song.harmony.chords.slice(0, 4).forEach((chord, bar) => {
    const add = (beat, midi, len, vel) => addNote(track, bar * 4 + beat, midi, Math.min(len, 4 - beat), vel);
    if (track.id === 'pad') {
      chord.notes.forEach(midi => add(0, midi, 1.7, rng.range(0.12, 0.16)));
      add(2, chord.notes[0], 1.7, 0.13);
      for (const beat of menu ? [3 + swing] : [1.5 + swing, 3 + swing]) {
        chord.notes.slice(1).forEach(midi => add(beat, midi, 0.65, rng.range(0.1, 0.14)));
      }
    } else if (track.id === 'bass') {
      let midi = chord.root - 24;
      while (midi < 28) midi += 12;
      add(0, midi, 1.7, rng.range(0.22, 0.27));
      add(2, midi, 0.95, rng.range(0.17, 0.22));
      if (!menu && bar % 2) {
        let fifth = degree(song.harmony.scale, song.harmony.steps[bar] + 4) - 24;
        while (fifth < 28) fifth += 12;
        add(3.5 + swing, fifth, 0.25, 0.13);
      }
    } else if (track.id === 'drums') {
      add(0, 36, 0.12, 0.16);
      if (!menu) { add(2, 36, 0.1, 0.1); add(2, 38, 0.08, 0.06); }
      for (const beat of menu ? [1.5, 3.5] : [0.5, 1.5, 2.5, 3.5]) {
        add(beat + swing, 42, 0.04, rng.range(0.035, 0.06));
      }
    }
  });
  return track;
}

export function fillMuzak(song, track) {
  const rng = createRng(track.seed).fork('genre/muzak');
  const rhythm = rng.pick([[0, 1, 2.5, 3], [0.5, 1, 2, 3.5], [0, 1.5, 2, 3], [0, 0.5, 2, 3]]);
  const motif = [rng.pick([0, 2, 4])];
  for (let i = 1; i < rhythm.length; i++) motif.push(Math.max(0, Math.min(6, motif.at(-1) + rng.pick([-2, -1, 1, 2]))));
  const comp = rng.pick([[0, 2], [0.5, 2.5], [0, 1.5, 3]]);
  song.harmony.chords.slice(0, 4).forEach((chord, bar) => {
    const step = song.harmony.steps[bar];
    const add = (beat, midi, len, vel) => addNote(track, bar * 4 + beat, midi, Math.min(len, 4 - beat), vel);
    if (track.id === 'keys') {
      rhythm.forEach((beat, i) => {
        if (song.use === 'menu' && i === 1 || bar % 2 && i === 2 && rng.chance(0.4)) return;
        let midi = degree(song.harmony.scale, step + motif[i]);
        while (midi > 84) midi -= 12;
        if (bar === 3 && i === rhythm.length - 1) midi = chord.root;
        add(beat, midi, rng.pick([0.65, 0.85, 1.1]), rng.range(0.4, 0.55));
      });
    } else if (track.id === 'pad') {
      comp.forEach(beat => {
        for (const offset of [2, 4, 6, ...(rng.chance(0.5) ? [8] : [])]) {
          add(beat, degree(song.harmony.scale, step + offset), Math.min(1.6, 4 - beat), rng.range(0.22, 0.3));
        }
      });
    } else if (track.id === 'bass') {
      for (const beat of [0, 2]) {
        let midi = degree(song.harmony.scale, step + (beat ? rng.pick([0, 4]) : 0)) - 24;
        while (midi < 28) midi += 12;
        add(beat, midi, 1.5, rng.range(0.38, 0.46));
      }
    } else if (track.id === 'drums') {
      for (const beat of [0, 2]) add(beat, 36, 0.12, 0.24);
      for (const beat of [1, 3]) add(beat, 38, 0.06, 0.15);
      for (let beat = 0; beat < 4; beat += 0.5) if (rng.chance(0.8)) add(beat, 42, 0.04, rng.range(0.08, 0.14));
    }
  });
  return track;
}

export function fillNewAge(song, track) {
  const rng = createRng(track.seed).fork('genre/newage');
  const shape = rng.pick([[0, 4, 7, 9, 7, 4], [0, 2, 4, 7, 4, 2], [2, 4, 7, 11, 7, 4], [0, 7, 4, 9, 4, 7]]);
  const start = rng.pick([0, 0.5, 1]);
  const spacing = rng.pick([0.5, 0.75]);
  song.harmony.chords.slice(0, 4).forEach((chord, bar) => {
    const step = song.harmony.steps[bar];
    const add = (beat, midi, len, vel) => addNote(track, bar * 4 + beat, midi, Math.min(len, 4 - beat), vel);
    if (track.id === 'keys') {
      shape.forEach((offset, i) => {
        const beat = start + i * spacing;
        if (beat >= 4 || song.use === 'menu' && i % 2 || bar % 2 && rng.chance(0.15)) return;
        let midi = degree(song.harmony.scale, step + offset);
        while (midi > 88) midi -= 12;
        add(beat, midi, rng.pick([0.9, 1.3, 1.8]), rng.range(0.28, 0.43));
      });
    } else if (track.id === 'pad') {
      for (const offset of [0, 4, 7, rng.pick([8, 9])]) {
        const beat = rng.pick([0, 0.25, 0.5]);
        add(beat, degree(song.harmony.scale, step + offset), 4 - beat, rng.range(0.2, 0.28));
      }
    } else if (track.id === 'bass') {
      let midi = chord.root - 24;
      while (midi < 28) midi += 12;
      add(0, midi, 3.9, 0.3);
    }
  });
  return track;
}
