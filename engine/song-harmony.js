import { createRng } from './rng.js';

export const HARMONIES = {
  auto: { name: 'Auto (seed)' }, original: { name: 'Original' },
  stable: { name: 'Stable', mode: 'major', paths: [[0, 0, 4, 0], [0, 3, 4, 0], [0, 1, 4, 0]] },
  warm: { name: 'Warm', mode: 'major', paths: [[0, 5, 3, 0], [0, 3, 5, 0], [0, 5, 1, 0]] },
  wistful: { name: 'Wistful', mode: 'minor', paths: [[0, 5, 2, 0], [0, 2, 5, 0], [0, 3, 2, 0]] },
  dark: { name: 'Dark', mode: 'minor', paths: [[0, 5, 6, 0], [0, 6, 3, 0], [0, 3, 6, 0]] },
  suspense: { name: 'Suspense', mode: 'minor', paths: [[0, 1, 6, 0], [0, 6, 1, 0], [0, 1, 4, 0]] },
  heroic: { name: 'Heroic', mode: 'major', paths: [[0, 4, 3, 0], [0, 3, 1, 0], [0, 4, 5, 0]] },
  floating: { name: 'Floating', mode: 'major', paths: [[0, 1, 3, 0], [0, 2, 3, 0], [0, 3, 3, 0]] },
  wandering: { name: 'Wandering', paths: [[0, 2, 6, 0], [0, 6, 2, 0], [0, 2, 1, 0]] },
};

export function chooseHarmony(song) {
  if (!song.progression || song.progression === 'original') return HARMONIES.original;
  const choices = song.feeling === 'cozy' ? ['stable', 'warm', 'wistful', 'floating'] : song.feeling === 'tense' ? ['dark', 'suspense', 'wistful', 'wandering'] :
    song.feeling === 'uplifting' ? ['stable', 'heroic', 'warm', 'floating'] : Object.keys(HARMONIES).slice(2);
  const id = song.progression === 'auto' ? createRng(song.seed).fork('harmony-family').pick(choices) : song.progression;
  return HARMONIES[id];
}
