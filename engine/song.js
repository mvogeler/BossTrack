export const PPQ = 960;

export function createSong({ tempo = 108, bars = 4, tracks = [], sampleRate = 48000 } = {}) {
  if (!Number.isFinite(tempo) || tempo < 30 || tempo > 300) throw new Error('Tempo must be between 30 and 300 BPM');
  if (!Number.isInteger(bars) || bars < 1 || bars > 256) throw new Error('Length must be between 1 and 256 bars');
  if (![44100, 48000].includes(sampleRate)) throw new Error('Unsupported song sample rate');
  return { v: 1, tempo, ppq: PPQ, bars, tracks, output: { sampleRate, bitDepth: 24 } };
}

export function tickSample(song, tick) {
  return Math.round(tick * 60 * song.output.sampleRate / (song.tempo * song.ppq));
}

export function createDemoSong() {
  const tracks = ['keys', 'pad', 'bass', 'drums'].map((id) => ({ id, instrument: id, notes: [] }));
  const add = (track, beat, midi, len, vel) => tracks[track].notes.push({
    id: tracks[track].id + '-' + tracks[track].notes.length,
    tick: Math.round(beat * PPQ), len: Math.round(len * PPQ), midi, vel,
  });
  const harmony = [[60, 64, 67], [57, 60, 64], [53, 57, 60], [60, 64, 67]];
  const melody = [[72, 76, 79, 76], [72, 71, 69, 76], [69, 72, 77, 76], [74, 71, 72, 72]];
  harmony.forEach((chord, bar) => {
    chord.forEach((midi) => add(1, bar * 4, midi, 3.8, 0.55));
    melody[bar].forEach((midi, beat) => add(0, bar * 4 + beat, midi, bar === 3 && beat === 3 ? 0.9 : 0.7, beat === 0 ? 0.85 : 0.65));
    for (let beat = 0; beat < 4; beat++) {
      add(2, bar * 4 + beat, chord[0] - 24, 0.75, beat % 2 === 0 ? 0.85 : 0.65);
      add(3, bar * 4 + beat, beat % 2 === 0 ? 36 : 38, 0.2, 0.75);
      add(3, bar * 4 + beat + 0.5, 42, 0.08, 0.35);
    }
  });
  return createSong({ tracks });
}

export function addNote(track, beat, midi, len, vel) {
  track.notes.push({ id: track.id + '-' + track.notes.length, tick: Math.round(beat * PPQ), len: Math.round(len * PPQ), midi, vel });
}
