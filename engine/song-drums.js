import { createRng } from './rng.js';
import { addNote } from './song.js';

export const DRUMS = {
  auto: { name: 'Auto (seed)' }, original: { name: 'Original' },
  drive: { name: 'Steady drive', kicks: [[0, 1, 2, 3], [0, 0.75, 2, 3]], snares: [1, 3], hats: 0.5 },
  half: { name: 'Half-time', kicks: [[0, 2.5], [0, 1.5, 2.75]], snares: [2], hats: 0.5 },
  broken: { name: 'Broken beat', kicks: [[0, 1.75, 2.5], [0, 0.75, 2, 3.5]], snares: [1, 3], hats: 0.25 },
  sparse: { name: 'Sparse', kicks: [[0], [0, 2]], snares: [2], hats: 1 },
  bounce: { name: 'Offbeat bounce', kicks: [[0, 1.5, 3], [0, 2.5]], snares: [1, 3], hats: 0.5 },
  rolling: { name: 'Rolling action', kicks: [[0, 0.75, 2, 2.75], [0, 1.25, 2, 3.25]], snares: [1, 3], hats: 0.25 },
  march: { name: 'March', kicks: [[0, 2], [0, 1, 2]], snares: [0.5, 1.5, 2.5, 3.5], hats: 1 },
  swing: { name: 'Swing', kicks: [[0, 5 / 3, 2], [0, 2, 11 / 3]], snares: [1, 3], hats: 0.5 },
};

export function chooseDrums(song, seed) {
  if (!song.drums || song.drums === 'original') return DRUMS.original;
  const choices = song.use === 'menu' || (song.use !== 'combat' && song.feeling === 'cozy') ? ['half', 'sparse', 'bounce', 'swing'] :
    song.use === 'combat' || song.feeling === 'tense' ? ['drive', 'broken', 'rolling', 'march'] : Object.keys(DRUMS).slice(2);
  return DRUMS[song.drums === 'auto' ? createRng(seed).fork('drum-family').pick(choices) : song.drums];
}

export function fillDrums(song, track) {
  const family = chooseDrums(song, track.seed);
  const rng = createRng(track.seed).fork('drum-pattern');
  for (let bar = 0; bar < 4; bar++) {
    const hit = (beat, midi, vel) => addNote(track, bar * 4 + beat, midi, midi === 42 ? 0.07 : 0.18, vel * rng.range(0.92, 1.06));
    rng.pick(family.kicks).forEach(beat => hit(beat, 36, 0.78));
    family.snares.forEach(beat => hit(beat, 38, family === DRUMS.march ? 0.5 : 0.72));
    const step = song.use === 'menu' ? Math.max(0.5, family.hats) : family.hats;
    for (let beat = 0; beat < 4; beat += step) {
      if (!Number.isInteger(beat) && rng.chance(0.2)) continue;
      const at = family === DRUMS.swing && beat % 1 ? beat + 1 / 6 : beat;
      hit(at, 42, family === DRUMS.bounce && beat % 1 ? 0.42 : 0.28);
    }
    if (bar === 3 && song.use !== 'menu' && family !== DRUMS.sparse && rng.chance(0.65)) {
      for (const beat of [3.25, 3.75]) if (!family.snares.includes(beat)) hit(beat, 38, 0.35);
    }
  }
}
