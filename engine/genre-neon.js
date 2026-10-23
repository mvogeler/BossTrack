import { createRng } from './rng.js';
import { degree } from './kit/music.js';
import { addNote } from './song.js';

export const NEON_KICKS = { floor: [0, 1, 2, 3], tresillo: [0, 0.75, 1.5, 2, 2.75, 3.5], skip: [0, 1, 1.75, 2, 3] };
const HOOKS = [[0, 0.5, 0.75, 1.5, 2, 2.5, 3], [0.5, 0.75, 1.25, 2, 2.75, 3.25], [0, 0.75, 1.5, 2.5, 2.75, 3.5],
  [0.25, 0.5, 1, 1.75, 2.25, 3], [0, 0.25, 0.75, 1.5, 2, 3], [0.5, 1, 1.5, 1.75, 2.5, 3.5], [0, 0.75, 1, 1.75, 2.5, 3]];
const ANSWERS = [[0, 0.5, 1, 2], [0, 0.75, 1.5, 2.5], [0.5, 1, 1.5, 2], [0, 0.5, 1.25, 2]];
const PADS = { held: [[0, 4]], push: [[0, 1.5], [1.5, 2.5]], stabs: [[0.5, 0.3], [1.5, 0.3], [2.5, 0.3], [3.5, 0.3]] };
const RANGES = { keys: [48, 84], pad: [24, 96], bass: [28, 68] };

export const neonGroove = song => createRng(song.seed ?? 0).fork('genre/neon/groove').pick(Object.keys(NEON_KICKS));

export function fillNeon(song, track) {
  const rng = createRng(track.seed).fork('genre/neon');
  const menu = song.use === 'menu';
  const groove = neonGroove(song);
  const scale = song.harmony.scale;
  const hook = rng.pick(HOOKS);
  const answer = rng.pick(ANSWERS);
  const start = rng.pick([4, 6, 7]);
  const line = [start];
  for (let i = 1; i < hook.length; i++) line.push(rng.chance(0.35) ? line[i - 1] : Math.max(2, Math.min(11, line[i - 1] + rng.pick([-2, -1, 1, 2, 3]))));
  const tail = rng.pick([-2, -1, 1, 2]);
  const gate = rng.pick([0.55, 0.8, 0.95]);
  const pad = rng.pick(['held', 'held', 'push', 'stabs']);
  const bassline = rng.pick(['octave', 'kick', 'drive']);
  const rest = rng.pick([-1, 3, 5]);
  const pickup = rng.chance(0.5);
  const busy = rng.chance(0.6);
  song.harmony.chords.slice(0, 4).forEach((chord, bar) => {
    const r = rng.fork('bar/' + bar);
    const step = song.harmony.steps[bar];
    const add = (beat, midi, len, vel, short = false) => {
      if (track.id !== 'drums') {
        const [low, high] = RANGES[track.id];
        while (midi < low) midi += 12;
        while (midi > high) midi -= 12;
      }
      addNote(track, bar * 4 + beat, midi, Math.min(len, 4 - beat), vel * r.range(0.93, 1));
      if (short) track.notes.at(-1).articulation = 'short';
    };
    if (track.id === 'keys') {
      const snap = n => {
        const tones = [0, 2, 4].map(o => step + o);
        return tones.flatMap(t => [t - 7, t, t + 7]).reduce((best, t) => Math.abs(t - n) < Math.abs(best - n) ? t : best);
      };
      const rhythm = bar === 3 ? answer : hook;
      rhythm.forEach((beat, i) => {
        if (menu && i % 2) return;
        let n = bar === 3 ? line[0] - i : line[i] + (bar === 1 && i >= hook.length - 2 ? tail : 0);
        if (beat % 1 === 0 || bar === 3 && i === rhythm.length - 1) n = snap(n);
        const last = i === rhythm.length - 1;
        const len = last && bar === 3 ? 4 - beat : ((rhythm[i + 1] ?? 4) - beat) * gate;
        add(beat, degree(scale, n), len, i === 0 ? 0.8 : beat % 1 ? 0.64 : 0.72);
      });
    } else if (track.id === 'pad') {
      for (const [beat, len] of menu ? PADS.held : PADS[pad]) {
        chord.notes.forEach(midi => add(beat, midi, len, pad === 'stabs' && !menu ? 0.44 : 0.5, pad === 'stabs' && !menu));
      }
    } else if (track.id === 'bass') {
      const root = degree(scale, step) - 36;
      const approach = degree(scale, step + r.pick([4, -1])) - 36;
      if (menu) {
        add(0, root, 1.8, 0.75);
        add(2, root, 1.8, 0.7);
      } else if (bassline === 'kick') {
        const hits = NEON_KICKS[groove];
        hits.forEach((beat, i) => add(beat, bar === 3 && i === hits.length - 1 ? approach : root, ((hits[i + 1] ?? 4) - beat) * 0.85, i === 0 ? 0.82 : 0.72));
        if (pickup && bar % 2 === 0 && !hits.includes(3.5)) add(3.5, root + 12, 0.3, 0.6);
      } else {
        for (let i = 0; i < 8; i++) {
          if (bar % 2 && i === rest) continue;
          const up = bassline === 'octave' ? i % 2 : i >= 6 || pickup && i === 3;
          add(i / 2, bar === 3 && i === 7 ? approach : root + (up ? 12 : 0), 0.4, i % 2 ? 0.62 : 0.8);
        }
      }
    } else if (track.id === 'drums') {
      for (const beat of menu ? [0, 2] : NEON_KICKS[groove]) add(beat, 36, 0.12, beat % 1 ? 0.74 : 0.86);
      for (const beat of [1, 3]) {
        add(beat, 38, 0.12, 0.8);
        if (!menu) add(beat, 39, 0.1, 0.48);
      }
      if (!menu && bar === 0) add(0, 49, 0.1, 0.48);
      const opens = !menu && (groove === 'floor' || r.chance(0.3));
      for (let beat = 0; beat < 4; beat += menu ? 0.5 : busy ? 0.25 : 0.5) {
        if (opens && beat % 1 === 0.5) {
          add(beat, 46, 0.08, 0.32);
          continue;
        }
        if (r.chance(0.12)) continue;
        add(beat, 42, 0.04, beat % 1 === 0.5 ? 0.3 : beat % 1 ? 0.16 : 0.24);
      }
      if (!menu && bar === 1 && r.chance(0.6)) add(3.75, 38, 0.06, 0.36);
    }
  });
}
