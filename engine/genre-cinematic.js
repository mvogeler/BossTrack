import { fillSpace } from './genre-space.js';
import { createRng } from './rng.js';
import { degree } from './kit/music.js';
import { addNote } from './song.js';

export function fillCinematic(song, track) {
  if (song.genre === 'space' && song.genreRevision === 2) return fillSpace(song, track);
  const rng = createRng(track.seed).fork('genre/' + song.genre);
  const command = song.genre === 'cinematic_command', space = song.genre === 'space';
  const leap = rng.pick([3, 4, 5]);
  const motif = [0, leap, leap - 1, 2, 1, 0];
  const beats = command ? [0, 1.5, 2, 4, 5.5, 6] : [0, 2, 3, 4.5, 6, 7];
  if (track.id === 'keys') {
    for (let phrase = 0; phrase < 2; phrase++) beats.forEach((beat, i) => {
      const bar = phrase * 2 + Math.floor(beat / 4), step = song.harmony.steps[bar];
      const offset = phrase && i === 5 ? -step : motif[i] + (phrase && i === 3 ? 1 : 0);
      const gap = (beats[i + 1] ?? 8) - beat;
      addNote(track, phrase * 8 + beat, degree(song.harmony.scale, step + offset), gap * 0.9,
        (command ? 0.68 : 0.5) + (i === 1 ? 0.17 : 0) + rng.range(-0.04, 0.04));
    });
    return;
  }
  song.harmony.steps.forEach((step, bar) => {
    const base = bar * 4, chord = song.harmony.chords[bar];
    if (track.id === 'pad') {
      if (command) {
        for (const beat of [0, 0.5, 1.5, 2, 2.5, 3.5]) for (const midi of chord.notes) addNote(track, base + beat, midi, 0.28, beat % 2 ? 0.48 : 0.65);
      } else for (const midi of chord.notes) addNote(track, base, midi + (space ? 12 : 0), 3.85, rng.range(0.38, 0.57));
    } else if (track.id === 'bass') {
      const entries = command ? [0, 1.5, 2, 3] : space ? [0, 2.5] : [0, 2];
      entries.forEach((beat, i) => addNote(track, base + beat, degree(song.harmony.scale, step + (i % 2 ? 4 : 0)) - 24,
        ((entries[i + 1] ?? 4) - beat) * 0.86, command ? 0.72 : 0.58));
    } else if (track.id === 'drums') {
      if (space) {
        for (const beat of [0, 2.5]) addNote(track, base + beat, 36, 0.2, beat ? 0.44 : 0.68);
        if (bar % 2) addNote(track, base + 2, 38, 0.15, 0.55);
        for (const beat of [0.5, 1.5, 2.5, 3.5]) addNote(track, base + beat, 42, 0.08, 0.2);
      } else {
        addNote(track, base, 36, 0.2, command ? 0.8 : 0.52);
        if (command) for (const beat of [1, 3]) addNote(track, base + beat, 38, 0.15, 0.52);
        if (command || bar % 2) addNote(track, base + 2, 45, 0.3, command ? 0.6 : 0.38);
        if (!command && bar === 1) addNote(track, base + 1.5, 42, 0.1, 0.35);
        if (bar === 0) addNote(track, base, 49, 0.2, command ? 0.5 : 0.28);
        if (bar === 3) {
          addNote(track, base + 2, 54, 0.2, 0.48);
          if (command) for (const beat of [3, 3.25, 3.5, 3.75]) addNote(track, base + beat, 38, 0.12, 0.35 + (beat - 3) * 0.4);
        }
      }
    }
  });
}
