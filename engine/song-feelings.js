import { degree } from './kit/music.js';

export const FEELINGS = {
  neutral: { name: 'Original', tempo: 108 },
  cozy: { name: 'Cozy', tempo: 92, mode: 'major', steps: [0, 3, 5, 0], groove: 'half-time',
    rhythm: [0, 1.5, 3], motif: [0, 2, 1], register: -12, hats: 1, levels: { keys: 0.82, pad: 0.9, bass: 0.82, drums: 0.72 } },
  tense: { name: 'Tense', tempo: 120, mode: 'minor', steps: [0, 1, 4, 0], groove: 'syncopated',
    rhythm: [0, 0.5, 1, 1.5, 2.5, 3.5], motif: [0, 1, 0, 1, 2, 1], hats: 0.25, levels: { keys: 0.95, pad: 0.8 } },
  uplifting: { name: 'Uplifting', tempo: 124, mode: 'major', steps: [0, 3, 4, 0], groove: 'steady',
    rhythm: [0, 0.5, 1.5, 2, 3], motif: [0, 2, 4, 3, 4], hats: 0.5 },
  melancholy: { name: 'Melancholy', tempo: 76, mode: 'minor', paths: [[0, 5, 2, 3], [0, 3, 2, 0]],
    groove: 'half-time', contour: [4, 3, 2, 0], spacing: 1, gate: 0.92, style: 'gentle',
    levels: { keys: 0.82, pad: 0.88, bass: 0.75, drums: 0.48 } },
  romantic: { name: 'Romantic', tempo: 84, mode: 'major', paths: [[0, 5, 1, 4], [0, 3, 1, 0]],
    groove: 'half-time', contour: [0, 2, 4, 2], spacing: 1, gate: 0.96, style: 'gentle',
    levels: { keys: 0.9, pad: 0.9, bass: 0.78, drums: 0.55 } },
  hype: { name: 'Hype', tempo: 140, paths: [[0, 4, 5, 3], [0, 3, 4, 0]],
    groove: 'steady', contour: [0, 2, 4, 5], spacing: 0.5, gate: 0.62, style: 'driving',
    levels: { keys: 0.96, pad: 0.82, bass: 1, drums: 1 } },
  menacing: { name: 'Menacing / intimidation', tempo: 96, mode: 'minor', paths: [[0, 1, 6, 0], [0, 6, 5, 0]],
    groove: 'half-time', contour: [0, 0, 1, 0], spacing: 1, gate: 0.55, register: -12, style: 'driving',
    levels: { keys: 0.85, pad: 0.78, bass: 1, drums: 0.9 } },
};

export function shapeFeeling(song, track) {
  const feel = FEELINGS[song.feeling ?? 'neutral'];
  if (!feel.contour || song[track.id === 'keys' ? 'melody' : track.id] !== 'auto') return;
  const ppq = song.ppq;
  if (track.id === 'keys') {
    track.notes = track.notes.filter(n => n.tick % (feel.spacing * ppq) === 0);
    const slots = new Map();
    for (const n of track.notes) {
      const bar = Math.floor(n.tick / (4 * ppq)), slot = slots.get(bar) ?? 0;
      slots.set(bar, slot + 1);
      n.midi = degree(song.harmony.scale, song.harmony.steps[bar % 4] + feel.contour[slot % feel.contour.length]) + 12 + (feel.register ?? 0);
      const next = track.notes.find(other => other.tick > n.tick);
      n.len = Math.max(1, Math.round(Math.min((next?.tick ?? (bar + 1) * 4 * ppq) - n.tick, 2 * ppq) * feel.gate));
    }
  }
  if (track.id === 'drums' && ['melancholy', 'romantic', 'menacing'].includes(song.feeling)) {
    track.notes = track.notes.filter(n => n.midi !== 42 || n.tick % ppq === 0);
  }
  track.notes.forEach((n, i) => { n.id = track.id + '-' + i; });
}
