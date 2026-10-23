import { createRng } from './rng.js';
import { degree } from './kit/music.js';
import { addNote } from './song.js';
import { chooseMelody } from './song-melodies.js';
import { FEELINGS } from './song-feelings.js';
import { USES } from './song-uses.js';

const RHYTHMS = [[0, 1, 1.5, 2, 3], [0, 0.5, 1.5, 2.5, 3], [0, 1, 2, 2.5, 3.5]];

export function fillMelody(song, track) {
  const rng = createRng(track.seed);
  const feel = FEELINGS[song.feeling ?? 'neutral'];
  const spaced = USES[song.use ?? 'sketch'].spaced;
  const family = chooseMelody(song, track.seed);
  const rhythm = family.rhythm ?? feel.rhythm ?? rng.pick(RHYTHMS);
  const motif = family.motif ?? feel.motif ?? [rng.pick([0, 2]), 2, rng.pick([1, 3]), 4, rng.pick([0, 2])];
  const lift = rng.pick([0, 1]);
  song.harmony.steps.forEach((step, bar) => {
    rhythm.forEach((beat, slot) => {
      if (spaced && slot % 2 && slot !== rhythm.length - 1) return;
      let offset = motif[slot];
      if (bar === 2 && slot === 2) offset += lift;
      let midi = degree(song.harmony.scale, step + offset) + 12;
      if (bar === 3 && slot === rhythm.length - 2) midi = degree(song.harmony.scale, -1) + 12;
      if (bar === 3 && slot === rhythm.length - 1) midi = song.harmony.root + 12;
      midi += feel.register ?? 0;
      const next = (spaced ? rhythm.find((_, i) => i > slot && (i % 2 === 0 || i === rhythm.length - 1)) : rhythm[slot + 1]) ?? 4;
      const len = (next - beat) * (bar === 3 && slot === rhythm.length - 1 ? 0.95 : 0.78);
      const vel = (slot === 0 || slot === 3 ? 0.82 : 0.62) * rng.range(0.94, 1.04);
      addNote(track, bar * 4 + beat, midi, len, vel);
    });
  });
}
