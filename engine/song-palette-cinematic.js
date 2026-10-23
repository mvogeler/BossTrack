export const INSTRUMENTS = {
  horizon_lead: { name: 'Horizon analog lead', part: 'keys', level: 0.26, pan: -0.12 },
  spectral_pad: { name: 'Evolving spectral pad', part: 'pad', level: 0.12, pan: 0.2 },
  clockwork_pulse: { name: 'Clockwork cinematic pulse', part: 'keys', level: 0.28, pan: -0.18 },
  abyss_bass: { name: 'Abyss cinematic bass', part: 'bass', level: 0.34, pan: 0 },
};

export function voiceDuration(id, note, len) {
  return len + ({ horizon_lead: 0.35, spectral_pad: 0.9, clockwork_pulse: 0.18, abyss_bass: 0.3 }[id]);
}

export function makeVoice(id, note, len, sr, seed, beatSeconds, nodes) {
  const { osc, adsr, filter, add, gain, mul, perc, f32 } = nodes;
  const dur = voiceDuration(id, note, len);
  const hz = Math.min(sr * 0.18, 440 * 2 ** ((note.midi - 69) / 12));
  const phase = (seed % 997) / 997 * Math.PI * 2;
  let source;
  if (id === 'horizon_lead') {
    const pitch = i => hz * (1 + 0.0025 * Math.min(1, i / sr / 0.6) * Math.sin(i / sr * 31));
    const body = add(gain(osc(sr, pitch, 'saw'), -9), gain(osc(sr, i => pitch(i) * 1.004, 'saw'), -14), gain(osc(sr, hz, 'tri'), -9));
    source = mul(filter(body, sr, 'lp', 1900), adsr(sr, dur, 0.04, 0.35, 0.7, 0.35));
  } else if (id === 'spectral_pad') {
    const layers = [1, 2, 3, 5].map((harmonic, j) => {
      const tone = osc(sr, Math.min(sr * 0.43, hz * harmonic * (1 + (j - 1.5) * 0.001)));
      const motion = i => f32(0.45 + 0.35 * Math.sin(i / sr * (0.5 + j * 0.17) + phase + j));
      return mul(gain(tone, -8 - j * 4), motion);
    });
    source = mul(add(...layers), adsr(sr, dur, Math.min(0.45, len * 0.3), 0.7, 0.85, 0.9));
  } else if (id === 'clockwork_pulse') {
    const body = add(gain(osc(sr, hz, 'tri'), -5), gain(osc(sr, Math.min(sr * 0.43, hz * 3)), -15));
    source = mul(filter(body, sr, 'lp', 3600), mul(perc(sr, 0.003, 0.16), adsr(sr, dur, 0.003, 0.12, 0.18, 0.18)));
  } else {
    const body = add(gain(osc(sr, hz), -4), gain(osc(sr, hz * 1.003, 'tri'), -12), gain(osc(sr, hz * 2), -21));
    const motion = i => f32(0.82 + 0.18 * Math.cos(i / (sr * beatSeconds) * Math.PI));
    source = mul(filter(body, sr, 'lp', 700), mul(motion, adsr(sr, dur, 0.025, 0.3, 0.75, 0.3)));
  }
  const frames = Math.round(dur * sr), fade = Math.max(1, Math.round(sr * 0.008));
  return { dur, source: i => f32(source(i) * Math.min(1, Math.max(0, frames - 1 - i) / fade)) };
}
