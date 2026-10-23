import { createRng } from './rng.js';
import { degree } from './kit/music.js';
import { addNote } from './song.js';

const CELLS = [[0, 1, 2], [0, 1, 2, 3], [0, 2, 3], [0, 3], [0, 1, 2, 3, 3.5], [0, 1.5, 2], [0, 0.5, 1, 2], [0, 1, 1.5, 2, 3]];
const ENDS = [[0, 1, 2], [0, 2], [0, 1], [0]];
export const MUSICBOX_ARPS = { rolling: [0, 1, 2, 3, 2, 1, 0, 1], climb: [0, 1, 2, 3, 0, 1, 2, 3], alberti: [0, 2, 1, 2, 0, 2, 1, 2], wave: [0, 2, 3, 2, 1, 2, 3, 1] };
export const MUSICBOX_RANGES = { keys: [64, 91], pad: [53, 79], bass: [41, 57] };
const MOVES = [[1, 2, -1, 1, 3], [1, 2, -1, 1, 3], [2, -1, 1, -2], [-1, -2, -1, 1]];

const fold = (midi, [low, high]) => {
  while (midi < low) midi += 12;
  while (midi > high) midi -= 12;
  return midi;
};

export function fillMusicbox(song, track) {
  const rng = createRng(track.seed).fork('genre/musicbox');
  const menu = song.use === 'menu';
  const scale = song.harmony.scale;
  const steps = song.harmony.steps;
  if (track.id === 'keys') return melody(song, track, rng, menu);
  const arp = MUSICBOX_ARPS[rng.pick(Object.keys(MUSICBOX_ARPS))];
  const turn = rng.chance(0.4);
  const bassline = menu ? 'whole' : rng.pick(['halves', 'halves', 'fifth', 'whole']);
  song.harmony.chords.slice(0, 4).forEach((chord, bar) => {
    const r = rng.fork('bar/' + bar);
    const add = (beat, midi, len, vel) => addNote(track, bar * 4 + beat, midi, Math.min(len, 4 - beat), vel * r.range(0.93, 1));
    if (track.id === 'pad') {
      const root = fold(degree(scale, steps[bar]), [53, 64]);
      const tones = [root, root + degree(scale, steps[bar] + 2) - degree(scale, steps[bar]), root + degree(scale, steps[bar] + 4) - degree(scale, steps[bar]), root + 12];
      const count = bar === 3 && turn ? 4 : 8;
      for (let i = 0; i < count; i += menu ? 2 : 1) {
        const last = i === count - 1 && count === 4;
        add(i / 2, tones[arp[i]], last ? 4 - i / 2 : menu ? 1 : 0.5, i === 0 ? 0.5 : i % 2 ? 0.36 : 0.42);
      }
    } else if (track.id === 'bass') {
      const root = fold(degree(scale, steps[bar]), [41, 52]);
      const fifth = root + degree(scale, steps[bar] + 4) - degree(scale, steps[bar]);
      add(0, root, bassline === 'whole' ? 4 : 2, 0.62);
      if (bassline !== 'whole') add(2, bassline === 'fifth' && fifth <= 57 ? fifth : root, 2, 0.5);
    }
  });
  return track;
}

function melody(song, track, rng, menu) {
  const scale = song.harmony.scale;
  const steps = song.harmony.steps;
  const first = rng.pick(CELLS);
  const rhythms = [first, rng.chance(0.5) ? first : rng.pick(CELLS), rng.pick(CELLS), rng.pick(ENDS)];
  const sequence = rhythms[1] === first && rng.chance(0.6);
  const chordTone = (n, bar) => {
    const tones = [0, 2, 4].map(o => steps[bar] + o).flatMap(t => [t - 14, t - 7, t, t + 7, t + 14]);
    return tones.reduce((best, t) => Math.abs(t - n) < Math.abs(best - n) ? t : best);
  };
  const lowest = degree(scale, 0) >= 64 ? 0 : 7;
  let n = chordTone(lowest + rng.pick([2, 4, 7]), 0);
  const lines = [];
  rhythms.forEach((rhythm, bar) => {
    const line = [];
    rhythm.forEach((beat, i) => {
      if (bar === 1 && sequence) n = lines[0][i] + steps[1] - steps[0];
      else if (bar || i) n += rng.pick(MOVES[bar]);
      n = Math.max(lowest, Math.min(lowest + 9, n));
      if (beat % 2 === 0 || i === rhythm.length - 1 && bar === 3) n = chordTone(n, bar);
      line.push(n);
    });
    if (bar === 3 && steps[3] % 7 === 0) line[line.length - 1] = Math.abs(n - lowest) < Math.abs(n - lowest - 7) ? lowest : lowest + 7;
    lines.push(line);
  });
  rhythms.forEach((rhythm, bar) => rhythm.forEach((beat, i) => {
    if (menu && beat % 1 && i !== rhythm.length - 1) return;
    const next = rhythm[i + 1] ?? 4;
    const vel = (i === 0 ? 0.72 : beat % 1 ? 0.54 : 0.62) * rng.range(0.94, 1);
    addNote(track, bar * 4 + beat, fold(degree(scale, lines[bar][i]), MUSICBOX_RANGES.keys), next - beat, vel);
  }));
  return track;
}
