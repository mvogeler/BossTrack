const MODES = {
  major: [0, 2, 4, 5, 7, 9, 11],
  minor: [0, 2, 3, 5, 7, 8, 10],
  dorian: [0, 2, 3, 5, 7, 9, 10],
  phrygian: [0, 1, 3, 5, 7, 8, 10],
  lydian: [0, 2, 4, 6, 7, 9, 11],
  mixolydian: [0, 2, 4, 5, 7, 9, 10],
  locrian: [0, 1, 3, 5, 6, 8, 10],
  pentatonic: [0, 2, 4, 7, 9],
  minorPentatonic: [0, 3, 5, 7, 10],
  wholeTone: [0, 2, 4, 6, 8, 10],
  harmonicMinor: [0, 2, 3, 5, 7, 8, 11],
  chromatic: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11],
};

const CHORDS = {
  maj: [0, 4, 7],
  min: [0, 3, 7],
  sus2: [0, 2, 7],
  sus4: [0, 5, 7],
  maj7: [0, 4, 7, 11],
  min7: [0, 3, 7, 10],
  dom7: [0, 4, 7, 10],
  add9: [0, 4, 7, 14],
};

const LETTERS = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };

export function noteNumber(root, octave = 4) {
  if (typeof root === 'number') return root;
  const m = /^([A-Ga-g])([#b]*)$/.exec(root);
  if (!m) throw new Error(`Unknown note name: ${root}`);
  let pc = LETTERS[m[1].toUpperCase()];
  for (const acc of m[2]) pc += acc === '#' ? 1 : -1;
  return 12 * (octave + 1) + pc;
}

export const midiHz = (m) => 440 * 2 ** ((m - 69) / 12);

export function scale(root, mode = 'major', octave = 4) {
  const steps = MODES[mode];
  if (!steps) throw new Error(`Unknown mode: ${mode}`);
  const base = noteNumber(root, octave);
  return steps.map((s) => base + s);
}

export function degree(notes, i) {
  const oct = Math.floor(i / notes.length);
  return notes[i - oct * notes.length] + 12 * oct;
}

export function chord(root, quality = 'maj', octave = 4) {
  const steps = CHORDS[quality];
  if (!steps) throw new Error(`Unknown chord quality: ${quality}`);
  const base = noteNumber(root, octave);
  return steps.map((s) => base + s);
}

export function music({ n }) {
  return {
    scale,
    chord,
    degree,
    midiHz,

    seq(notes, voice, { tail = 0 } = {}) {
      const placed = notes.map((note) => {
        const full = { vel: 1, ...note };
        const out = (full.voice ?? voice)(this, full);
        return { at: n(full.t), out: Array.isArray(out) ? out : [out], end: n(full.t + (full.len ?? 0) + tail) };
      });
      const len = Math.max(0, ...placed.map((p) => Math.max(p.end, p.at + p.out[0].length)));
      const chans = Math.max(1, ...placed.map((p) => p.out.length));
      const mix = Array.from({ length: chans }, () => new Float32Array(len));
      for (const { at, out } of placed) {
        mix.forEach((ch, c) => {
          const src = out[Math.min(c, out.length - 1)];
          for (let i = 0; i < src.length; i++) ch[at + i] += src[i];
        });
      }
      return chans === 1 ? mix[0] : mix;
    },
  };
}
