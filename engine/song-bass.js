import { createRng } from './rng.js';
import { degree } from './kit/music.js';
import { addNote } from './song.js';

export const BASS = {
  auto: { name: 'Auto (seed)' }, original: { name: 'Original' },
  held: { name: 'Held roots', rhythms: [[0], [0, 2]], motifs: [[0]], hold: 3.8 },
  pulse: { name: 'Downbeat pulses', rhythms: [[0, 1, 2, 3], [0, 1, 2.5, 3]], motifs: [[0]] },
  offbeat: { name: 'Offbeat pulses', rhythms: [[0.5, 1.5, 2.5, 3.5], [0.5, 1.75, 2.5, 3.5]], motifs: [[0]], hold: 0.4 },
  fifths: { name: 'Root / fifth', rhythms: [[0, 1.5, 2, 3.5], [0, 1, 2.5, 3.5]], motifs: [[0, 4, 0, 4], [0, 0, 4, 0]] },
  octaves: { name: 'Octave movement', rhythms: [[0, 0.75, 2, 2.75], [0, 1.5, 2.5, 3.5]], motifs: [[0, 7, 0, 7], [0, 0, 7, 0]] },
  walking: { name: 'Stepwise walking', rhythms: [[0, 1, 2, 3], [0, 1.25, 2, 3.25]], motifs: [[0, 1, 2, 4], [0, 2, 3, 4]], hold: 0.9 },
  riff: { name: 'Repeating riff', rhythms: [[0, 0.5, 1.5, 2.5, 3.5], [0, 0.75, 1.5, 2, 3.25]], motifs: [[0, 0, 4, 2, 0], [0, 4, 0, 2, 4]] },
  answer: { name: 'Melodic answer', rhythms: [[1, 2.5, 3.25], [0.75, 2, 3.5]], motifs: [[2, 1, 0], [4, 2, 0]] },
};

export function chooseBass(song, seed) {
  if (!song.bass || song.bass === 'original') return BASS.original;
  const choices = song.use === 'menu' ? ['held', 'fifths', 'answer'] : song.use === 'combat' ? ['pulse', 'offbeat', 'octaves', 'riff'] : Object.keys(BASS).slice(2);
  return BASS[song.bass === 'auto' ? createRng(seed).fork('bass-family').pick(choices) : song.bass];
}

export function fillBass(song, track) {
  const family = chooseBass(song, track.seed);
  const rng = createRng(track.seed).fork('bass-pattern');
  const motif = rng.pick(family.motifs);
  song.harmony.steps.forEach((step, bar) => {
    const beats = rng.pick(family.rhythms).filter((_, i) => song.use !== 'menu' || i % 2 === 0);
    beats.forEach((beat, i) => {
      let offset = motif[i % motif.length];
      if (family === BASS.walking && i === beats.length - 1 && bar < 3) offset = song.harmony.steps[bar + 1] - step - 1;
      if (bar === 3 && i === beats.length - 1) offset = -step;
      const len = Math.min(family.hold ?? 0.7, (beats[i + 1] ?? 4) - beat) * rng.range(0.88, 0.98);
      addNote(track, bar * 4 + beat, degree(song.harmony.scale, step + offset) - 24, len, (i === 0 ? 0.8 : 0.65) * rng.range(0.94, 1.04));
    });
  });
}
