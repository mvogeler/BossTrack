export const INSTRUMENTS = {
  orbital_theme: { name: 'Orbital analog theme', part: 'keys', level: 0.4, pan: -0.08 },
  nebula_strings: { name: 'Nebula analog strings', part: 'pad', level: 0.16, pan: 0.15 },
  navigation_pulse: { name: 'Navigation filtered bass pulse', part: 'bass', level: 0.44, pan: 0 },
};

export function voiceDuration(id, note, len) {
  return len + ({ orbital_theme: 0.65, nebula_strings: 1.2, navigation_pulse: 0.12 }[id]);
}

export function movingFilter(source, sr, cutoff) {
  let ic1 = 0, ic2 = 0;
  return i => {
    const g = Math.tan(Math.PI * Math.min(sr * 0.22, Math.max(30, cutoff(i))) / sr);
    const v1 = (ic1 + g * (source(i) - ic2)) / (1 + 0.7 * g + g * g);
    const v2 = ic2 + g * v1;
    ic1 = 2 * v1 - ic1; ic2 = 2 * v2 - ic2;
    return Math.fround(v2);
  };
}

export function makeVoice(id, note, len, sr, seed, beatSeconds, nodes) {
  const { osc, adsr, add, gain, mul, f32 } = nodes;
  const dur = voiceDuration(id, note, len);
  const hz = Math.min(sr * 0.18, 440 * 2 ** ((note.midi - 69) / 12));
  const phase = seed % 997 / 997 * Math.PI * 2;
  let source;
  if (id === 'navigation_pulse') {
    const body = add(gain(osc(sr, hz, 'saw'), -9), gain(osc(sr, hz, 'tri'), -6), gain(osc(sr, hz * 2), -20));
    const cutoff = i => 180 + 1600 * (1 - Math.exp(-i / sr / 0.004)) * Math.exp(-i / sr / 0.085);
    source = mul(movingFilter(body, sr, cutoff), adsr(sr, dur, 0.006, 0.14, 0.23, 0.12));
  } else if (id === 'orbital_theme') {
    const vibrato = i => hz * (1 + 0.0015 * Math.min(1, i / sr / 1.3) * Math.sin(i / sr * 29));
    const body = add(gain(osc(sr, vibrato, 'saw'), -11), gain(osc(sr, i => vibrato(i) * 1.003, 'saw'), -14), gain(osc(sr, hz, 'tri'), -5));
    const cutoff = i => hz * (1.7 + 2.5 * Math.min(1, i / sr / 1.4)) + 420;
    source = mul(movingFilter(body, sr, cutoff), adsr(sr, dur, Math.min(0.24, len * 0.2), 0.7, 0.8, 0.65));
  } else {
    const body = add(...[-0.004, 0, 0.004].map((detune, j) => gain(osc(sr, hz * (1 + detune), 'saw'), -16 - j)), gain(osc(sr, hz, 'tri'), -9));
    const cutoff = i => 1000 + 500 * Math.sin(i / sr * 0.55 + phase);
    source = mul(movingFilter(body, sr, cutoff), adsr(sr, dur, Math.min(0.65, len * 0.35), 0.7, 0.8, 1.2));
  }
  const frames = Math.round(dur * sr), fade = Math.max(1, Math.round(sr * 0.012));
  return { dur, source: i => f32(source(i) * Math.min(1, Math.max(0, frames - 1 - i) / fade)) };
}
