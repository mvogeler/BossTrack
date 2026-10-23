import { createRng } from './rng.js';
import { degree } from './kit/music.js';
import { addNote } from './song.js';
import { FEELINGS } from './song-feelings.js';
import { fillBass } from './song-bass.js';
import { fillDrums } from './song-drums.js';
import { USES } from './song-uses.js';

export const GROOVES = {
  steady: { kicks: [0, 1, 2, 3], snares: [1, 3] },
  syncopated: { kicks: [0, 1.5, 2, 3.5], snares: [1, 3] },
  'half-time': { kicks: [0, 2.5], snares: [2] },
};

export function fillRhythm(song, track) {
  if (track.id === 'bass' && song.bass && song.bass !== 'original') return fillBass(song, track);
  if (track.id === 'drums' && song.drums && song.drums !== 'original') return fillDrums(song, track);
  const rng = createRng(track.seed);
  const groove = GROOVES[song.groove];
  const use = USES[song.use ?? 'sketch'];
  const kicks = song.use === 'combat' ? [...new Set([...groove.kicks, ...use.kicks])].sort((a, b) => a - b) : use.kicks ?? groove.kicks;
  const hatStep = use.hats ?? FEELINGS[song.feeling ?? 'neutral'].hats ?? rng.pick([0.5, 0.5, 1]);
  const fifths = rng.chance(0.5);
  const extraBass = use.bassBeats ?? rng.pick([[3.5], [0.5, 3.5], [1.75, 3.5], [0.75, 2.75, 3.5]]);
  song.harmony.steps.forEach((step, bar) => {
    if (track.id === 'bass') {
      const beats = [...new Set([...kicks, ...extraBass])].sort((a, b) => a - b);
      beats.forEach((beat, i) => {
        const offset = fifths && i % 2 === 1 && bar !== 3 ? 4 : 0;
        const midi = degree(song.harmony.scale, step + offset) - 24;
        const next = beats[i + 1] ?? 4;
        addNote(track, bar * 4 + beat, midi, Math.min(0.8, (next - beat) * 0.8), (beat === 0 ? 0.85 : 0.65) * rng.range(0.94, 1.04));
      });
      return;
    }
    kicks.forEach((beat) => addNote(track, bar * 4 + beat, 36, 0.2, rng.range(0.7, 0.85)));
    (use.snares ?? groove.snares).forEach((beat) => addNote(track, bar * 4 + beat, 38, 0.18, rng.range(0.65, 0.8)));
    for (let beat = 0; beat < 4; beat += hatStep) {
      addNote(track, bar * 4 + beat, 42, 0.07, (Number.isInteger(beat) ? 0.28 : 0.4) * rng.range(0.9, 1.1));
    }
    if (bar === 3 && (use.fill ?? rng.chance(0.7))) {
      addNote(track, bar * 4 + 3.25, 38, 0.12, 0.35);
      addNote(track, bar * 4 + 3.75, 38, 0.12, 0.45);
    }
  });
}
