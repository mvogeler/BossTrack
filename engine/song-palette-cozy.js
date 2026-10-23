import { createRng } from './rng.js';

export const INSTRUMENTS = {
  marimba: { name: 'Marimba synth', part: 'keys', level: 0.46, pan: -0.12 },
  vibraphone: { name: 'Vibraphone synth', part: 'keys', level: 0.4, pan: 0.12 },
  celesta: { name: 'Celesta synth', part: 'keys', level: 0.36, pan: -0.08 },
  musicbox: { name: 'Music box synth', part: 'keys', level: 0.35, pan: 0.18 },
  tine_box: { name: 'Soft tine music box', part: 'keys', level: 0.42, pan: 0 },
  softmallet: { name: 'Soft mallet', part: 'keys', level: 0.46, pan: -0.1 },
  tubular_bell: { name: 'Tubular bell synth', part: 'keys', level: 0.32, pan: 0.1 },
  kalimba: { name: 'Kalimba synth', part: 'keys', level: 0.42, pan: -0.14 },
  harp: { name: 'Harp synth', part: 'keys', level: 0.42, pan: 0.12 },
  nylon_pluck: { name: 'Nylon guitar synth', part: 'keys', level: 0.46, pan: -0.18 },
  felt_keys: { name: 'Felt piano synth', part: 'keys', level: 0.44, pan: 0.08 },
};

const tones = {
  marimba: { attack: 0.003, decay: 0.65, release: 0.16, modes: [[1, 1, 1], [4, 0.32, 0.22], [10, 0.12, 0.09]] },
  vibraphone: { attack: 0.004, decay: 2.6, release: 0.45, tremolo: 5.2, modes: [[1, 1, 1], [4, 0.3, 0.48], [9.7, 0.16, 0.18]] },
  celesta: { attack: 0.0015, decay: 1.2, release: 0.3, modes: [[1, 0.75, 1], [2, 0.4, 0.6], [2.76, 0.28, 0.32], [5.4, 0.16, 0.15]] },
  musicbox: { attack: 0.001, decay: 0.9, release: 0.24, modes: [[1, 1, 1], [2.01, 0.16, 0.3], [5.96, 0.42, 0.3], [11.8, 0.16, 0.11]] },
  tine_box: { attack: 0.003, decay: 0.55, release: 0.9, modes: [[1, 1, 1], [2, 0.35, 0.18], [5.03, 0.12, 0.068]] },
  softmallet: { attack: 0.014, decay: 0.42, release: 0.12, modes: [[1, 1, 1], [2, 0.12, 0.3], [3, 0.05, 0.18]] },
  tubular_bell: { attack: 0.002, decay: 3.2, release: 0.65, modes: [[0.5, 0.35, 1], [1, 0.65, 1], [1.414, 0.38, 0.65], [2.4, 0.32, 0.5], [3.76, 0.22, 0.28]] },
  kalimba: { attack: 0.0015, decay: 0.75, release: 0.18, noise: 0.055, modes: [[1, 1, 1], [2.82, 0.42, 0.19], [5.1, 0.17, 0.08]] },
  harp: { attack: 0.003, decay: 1.65, release: 0.35, noise: 0.025, modes: [[1, 1, 1], [2, 0.48, 0.65], [3, 0.28, 0.43], [4, 0.16, 0.3], [5, 0.09, 0.18]] },
  nylon_pluck: { attack: 0.002, decay: 0.9, release: 0.18, noise: 0.08, modes: [[1, 1, 1], [2, 0.3, 0.7], [3, 0.46, 0.4], [4, 0.12, 0.25], [6, 0.08, 0.14]] },
  felt_keys: { attack: 0.008, decay: 1.1, release: 0.32, noise: 0.035, modes: [[1, 1, 1], [2.003, 0.32, 0.63], [3.012, 0.12, 0.3], [4.027, 0.04, 0.14]] },
};

export function voiceDuration(id, note, len) {
  return len + tones[id].release;
}

export function makeVoice(id, note, len, sr, seed, beatSeconds, nodes) {
  const tone = tones[id];
  const hz = 440 * 2 ** ((note.midi - 69) / 12);
  const dur = voiceDuration(id, note, len);
  const rng = createRng(seed).fork(id);
  const pitchDecay = Math.max(0.35, Math.min(1.6, (440 / hz) ** 0.25));
  const modes = tone.modes.filter(([ratio]) => ratio * hz < sr * 0.45).map(([ratio, gain, decay]) => ({
    osc: nodes.osc(sr, hz * ratio), gain,
    damping: Math.exp(-1 / (sr * tone.decay * decay * pitchDecay)), amplitude: 1,
  }));
  const scale = 0.8 / Math.max(1, modes.reduce((sum, mode) => sum + mode.gain, 0) + (tone.noise || 0));
  let noise = 0;
  return { dur, source: (i) => {
    const t = i / sr;
    let value = 0;
    for (const mode of modes) {
      value += mode.osc(i) * mode.gain * mode.amplitude;
      mode.amplitude *= mode.damping;
    }
    if (tone.noise) {
      noise += 0.24 * (rng.range(-1, 1) - noise);
      value += noise * tone.noise * Math.exp(-t / 0.012);
    }
    const attack = Math.min(1, t / tone.attack);
    const release = Math.max(0, Math.min(1, (dur - t) / tone.release));
    const tremolo = tone.tremolo ? 0.84 + 0.16 * Math.cos(2 * Math.PI * tone.tremolo * t) : 1;
    return nodes.f32(value * scale * attack * release * release * tremolo);
  } };
}
