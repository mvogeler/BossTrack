import { createRng } from './rng.js';

export const MELODIES = {
  auto: { name: 'Auto (seed)' },
  original: { name: 'Original' },
  singing: { name: 'Singing / themes', rhythms: [[0, 0.75, 1.5, 2.5, 3.5], [0, 1, 2, 2.75, 3.5]],
    motifs: [[0, 2, 4, 3, 1], [2, 1, 0, 2, 4]] },
  wandering: { name: 'Wandering / exploration', rhythms: [[0, 0.5, 1.75, 2.5, 3.25], [0, 1.25, 2, 2.5, 3.5]],
    motifs: [[0, 1, 2, 1, 0], [2, 1, 0, -1, 1]] },
  rising: { name: 'Rising / action', rhythms: [[0, 0.5, 1.5, 2, 3], [0, 0.75, 1.5, 2.5, 3.5]],
    motifs: [[0, 1, 2, 4, 5], [0, 2, 3, 4, 6]] },
  falling: { name: 'Falling / reflection', rhythms: [[0, 1, 1.5, 2.5, 3.5], [0, 0.5, 1.25, 2, 3]],
    motifs: [[6, 4, 3, 2, 0], [4, 3, 2, 1, -1]] },
  arch: { name: 'Arch / adventure', rhythms: [[0, 1, 1.5, 2.5, 3], [0, 0.5, 1.5, 2.25, 3.5]],
    motifs: [[0, 2, 4, 2, 0], [1, 3, 5, 3, 1]] },
  pulse: { name: 'Pulse / stealth', rhythms: [[0, 0.5, 1.5, 2, 2.5, 3.5], [0, 0.75, 1.5, 2.25, 3, 3.5]],
    motifs: [[0, 0, 1, 0, 0, 2], [2, 2, 0, 2, 2, 1]] },
  leaps: { name: 'Leaps / fanfare', rhythms: [[0, 1.5, 2.25, 3], [0, 0.75, 2, 3.5]],
    motifs: [[0, 4, 1, 5], [2, 6, 0, 4]] },
  arpeggio: { name: 'Arpeggio / puzzles', rhythms: [[0, 0.5, 1, 1.5, 2, 2.5, 3, 3.5], [0, 0.25, 0.75, 1.25, 1.75, 2.25, 2.75, 3.5]],
    motifs: [[0, 2, 4, 2, 0, 2, 4, 6], [4, 2, 0, 2, 4, 6, 4, 2]] },
};

export function chooseMelody(song, seed) {
  if (!song.melody || song.melody === 'original') return MELODIES.original;
  const rng = createRng(seed).fork('melody');
  const id = song.melody === 'auto' ? rng.pick(Object.keys(MELODIES).filter(id => !['auto', 'original'].includes(id))) : song.melody;
  const family = MELODIES[id];
  return { name: family.name, rhythm: rng.pick(family.rhythms), motif: rng.pick(family.motifs) };
}
