import { addNote } from './song.js';
import { createRng } from './rng.js';

export function fillTrance(song, track) {
  const rng = createRng(track.seed).fork('genre/trance');
  const arp = rng.pick([[0, 1, 2, 1], [0, 2, 1, 2], [2, 1, 0, 1], [0, 1, 0, 2]]);
  const lift = rng.pick([0, 12]);
  const gate = rng.pick([0.12, 0.18, 0.22]);
  song.harmony.chords.slice(0, 4).forEach((chord, bar) => {
    const r = rng.fork('bar/' + bar);
    const skip = r.pick([1, 3, 5, 7, 9, 11, 13]);
    const add = (beat, midi, len, vel) => {
      if (track.id !== 'drums') {
        const [lo, hi] = track.id === 'bass' ? [28, 68] : track.id === 'keys' ? [48, 84] : [24, 96];
        while (midi > hi) midi -= 12;
        while (midi < lo) midi += 12;
      }
      addNote(track, bar * 4 + beat, midi, len, vel * r.range(0.91, 1));
      if (track.id === 'pad') track.notes.at(-1).articulation = 'short';
    };
    if (track.id === 'keys') {
      const phase = r.pick([0, 1, 2, 3]);
      for (let i = 0; i < 16; i++) {
        if (i === skip || song.use === 'menu' && i % 2) continue;
        add(i / 4, chord.notes[arp[(i + phase) % 4]] + lift, gate, i % 4 === 0 ? 0.66 : 0.48);
      }
    } else if (track.id === 'pad') {
      const offset = r.pick([0, 0.25, 0.5]);
      const beats = [offset, 1.5 + r.pick([0, 0.25]), 3 + r.pick([0, 0.25])];
      for (const beat of song.use === 'menu' ? beats.slice(0, 1) : beats) {
        chord.notes.forEach(midi => add(beat, midi, 0.45, 0.35));
      }
    } else if (track.id === 'bass') {
      const rest = r.pick([3, 5, 7]);
      for (let i = 0; i < 8; i++) {
        if (i === rest || song.use === 'menu' && i % 2) continue;
        add(i / 2 + 0.25, chord.root - 24 + (i % 2 ? 12 : 0), 0.2, 0.68);
      }
    } else if (track.id === 'drums') {
      for (let beat = 0; beat < 4; beat++) {
        add(beat, 36, 0.14, 0.78);
        if (beat % 2) add(beat, 38, 0.1, 0.65);
        if (song.use !== 'menu' || beat % 2 === 0) add(beat + 0.5, 42, 0.07, 0.34);
        if (r.chance(0.4) && song.use !== 'menu') add(beat + 0.75, 42, 0.04, 0.2);
      }
    }
  });
}
