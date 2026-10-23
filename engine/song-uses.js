import { addNote } from './song.js';

export const USES = {
  sketch: { name: 'Sketch' },
  menu: { name: 'Menu', groove: 'half-time', spaced: true, kicks: [0, 2], snares: [2], hats: 1, bassBeats: [], fill: false,
    levels: { keys: 0.8, bass: 0.7, drums: 0.6 } },
  combat: { name: 'Combat', kicks: [0, 1, 2, 3], hats: 0.25, bassBeats: [0.5, 1.5, 2.5, 3.5], fill: true,
    levels: { keys: 0.92, pad: 0.8 } },
  love: { name: 'Love song', tempo: 84, mode: 'major', paths: [[0, 5, 1, 4], [0, 3, 1, 0]], style: 'gentle',
    kicks: [0, 2.5], snares: [2], hats: 1, bassBeats: [0, 2.5], gate: 0.85,
    levels: { keys: 0.9, pad: 0.9, bass: 0.78, drums: 0.55 } },
  hype: { name: 'Hype / entrance', tempo: 140, style: 'driving',
    kicks: [0, 1.5, 2, 3.5], snares: [1, 3], hats: 0.5, bassBeats: [0, 1.5, 2, 3.5], gate: 0.65 },
  intimidation: { name: 'Intimidation', tempo: 96, mode: 'minor', paths: [[0, 1, 6, 0], [0, 6, 5, 0]], style: 'driving',
    kicks: [0, 2], snares: [2], hats: 1, bassBeats: [0, 2], gate: 0.55,
    levels: { keys: 0.82, pad: 0.85, bass: 1, drums: 0.9 } },
  workout: { name: 'Workout / steady drive', tempo: 132, style: 'driving', continuous: true,
    kicks: [0, 1, 2, 3], snares: [1, 3], hats: 0.5, bassBeats: [0, 1, 2, 3], gate: 0.72 },
  promo: { name: 'Promo / game trailer', fill: true },
};

export function arrangePromoPart(song, track) {
  if (song.use !== 'promo') return;
  const barTicks = song.ppq * 4;
  const bars = song.bars - (song.form === 'song' ? 1 : 0);
  for (const note of track.notes) {
    const bar = Math.floor(note.tick / barTicks);
    const gain = bar >= bars ? 1.2 : 0.95 + 0.15 * note.tick / (bars * barTicks);
    note.vel = Math.min(1, note.vel * gain);
  }
}

export function shapeUse(song, track) {
  const use = USES[song.use ?? 'sketch'];
  if (!use.tempo || song[track.id === 'keys' ? 'melody' : track.id] !== 'auto') return;
  const ppq = song.ppq;
  if (track.id === 'keys' && song.use === 'love') {
    track.notes = track.notes.filter(n => n.tick % ppq === 0);
    for (const n of track.notes) n.len = Math.min(2 * ppq, n.len * 2, 16 * ppq - n.tick);
  }
  if (track.id === 'drums') {
    track.notes = track.notes.filter(n => ![36, 38, 42].includes(n.midi));
    for (let bar = 0; bar < 4; bar++) {
      use.kicks.forEach(beat => addNote(track, bar * 4 + beat, 36, 0.18, beat === 0 ? 0.8 : 0.68));
      use.snares.forEach(beat => addNote(track, bar * 4 + beat, 38, 0.15, 0.68));
      for (let beat = 0; beat < 4; beat += use.hats) addNote(track, bar * 4 + beat, 42, 0.07, Number.isInteger(beat) ? 0.28 : 0.34);
    }
  }
  if (track.id === 'bass') {
    track.notes = [];
    song.harmony.chords.forEach((chord, bar) => use.bassBeats.forEach((beat, i) => {
      const next = use.bassBeats[i + 1] ?? 4;
      addNote(track, bar * 4 + beat, chord.root - 24, (next - beat) * use.gate, beat === 0 ? 0.74 : 0.62);
    }));
  }
  track.notes.sort((a, b) => a.tick - b.tick || a.midi - b.midi);
  track.notes.forEach((n, i) => { n.id = track.id + '-' + i; });
}
