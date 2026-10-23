import { createRng } from './rng.js';

export const INSTRUMENTS = {
  supersaw: { name: 'Supersaw', part: 'keys', level: 0.24, pan: -0.12, echo: true },
  analog_lead: { name: 'Analog lead', part: 'keys', level: 0.28, pan: -0.12, echo: true },
  pulse_lead: { name: 'Dual pulse lead', part: 'keys', level: 0.24, pan: 0.12, echo: true },
  harmonic_lead: { name: 'Harmonic lead', part: 'keys', level: 0.25, pan: -0.1, echo: true },
  fm_glass: { name: 'FM glass', part: 'keys', level: 0.3, pan: 0.15, echo: true },
  edm_pluck: { name: 'EDM pluck', part: 'keys', level: 0.3, pan: -0.15, echo: true },
  reese_bass: { name: 'Reese bass', part: 'bass', level: 0.3, pan: 0 },
  sub_bass: { name: 'Sub bass', part: 'bass', level: 0.38, pan: 0 },
  acid_bass: { name: 'Acid bass', part: 'bass', level: 0.3, pan: 0 },
  rubber_bass: { name: 'Rubber bass', part: 'bass', level: 0.34, pan: 0 },
  analog_pad: { name: 'Warm analog pad', part: 'pad', level: 0.18, pan: 0.2 },
  shimmer_pad: { name: 'Shimmer pad', part: 'pad', level: 0.18, pan: 0.2 },
};

const RELEASE = { supersaw: 0.2, analog_lead: 0.14, pulse_lead: 0.12,
  harmonic_lead: 0.15, fm_glass: 0.6, edm_pluck: 0.18, reese_bass: 0.07,
  sub_bass: 0.08, acid_bass: 0.06, rubber_bass: 0.07, analog_pad: 0.65, shimmer_pad: 0.9 };

export function voiceDuration(id, note, len) {
  return len + (note.articulation === 'short' && INSTRUMENTS[id].part === 'pad' ? 0.08 : RELEASE[id]);
}

function sweep(source, sr, cutoff, resonance = 0) {
  let low = 0, low2 = 0;
  return (i) => {
    const a = 1 - Math.exp(-2 * Math.PI * Math.min(sr * 0.2, cutoff(i)) / sr);
    low += a * (source(i) - low - resonance * (low2 - low));
    low2 += a * (low - low2);
    return Math.fround(low2);
  };
}

export function makeVoice(id, note, len, sr, seed, beatSeconds, nodes) {
  const { osc, adsr, filter, add, gain, mul, f32 } = nodes;
  const hz = 440 * 2 ** ((note.midi - 69) / 12);
  const dur = voiceDuration(id, note, len);
  const release = dur - len;
  const short = note.articulation === 'short';
  const rng = createRng(seed).fork(id);
  const partial = (ratio, type = 'sine') => osc(sr, Math.min(hz * ratio, sr * 0.44), type);
  const envelope = (a, d, s) => adsr(sr, dur, a, d, s, release);
  let source;
  if (id === 'supersaw') {
    const spread = rng.range(0.004, 0.008);
    const voices = [-3, -2, -1, 0, 1, 2, 3].map(n => gain(osc(sr, hz * (1 + spread * n), 'saw'), -17));
    source = mul(filter(add(...voices), sr, 'lp', 6200), envelope(0.012, 0.15, 0.72));
  } else if (id === 'analog_lead') {
    const frequency = i => hz * (1 + 0.0025 * Math.sin(2 * Math.PI * 5.2 * i / sr));
    const tone = add(gain(osc(sr, frequency, 'saw'), -4), gain(partial(1, 'tri'), -10));
    source = mul(sweep(tone, sr, i => 1800 + 4200 * Math.exp(-i / (sr * 0.12))), envelope(0.008, 0.16, 0.65));
  } else if (id === 'pulse_lead') {
    const tone = add(gain(osc(sr, hz, 'pulse', 0.2), -5), gain(osc(sr, hz * 1.003, 'pulse', 0.65), -8));
    source = mul(tone, envelope(0.004, 0.08, 0.58));
    const pulse = source;
    source = i => f32(pulse(i) * (0.82 + 0.18 * Math.cos(2 * Math.PI * i / (sr * beatSeconds * 2))));
  } else if (id === 'harmonic_lead') {
    const upper = mul(add(gain(partial(2, 'saw'), -10), gain(partial(3), -12)), i => f32(Math.exp(-i / (sr * 0.07))));
    source = mul(filter(add(gain(partial(1, 'saw'), -6), upper), sr, 'lp', 5000), envelope(0.003, 0.12, 0.52));
  } else if (id === 'fm_glass' || id === 'rubber_bass') {
    const glass = id === 'fm_glass';
    const ratio = glass ? 2.76 : 1;
    const modHz = Math.min(hz * ratio, sr * 0.4);
    const depth = Math.min(glass ? 2.5 : 3.8, Math.max(0, (sr * 0.45 - hz) / modHz));
    source = i => {
      const t = i / sr;
      const index = depth * Math.exp(-t / (glass ? 0.24 : 0.055));
      return f32(Math.sin(2 * Math.PI * hz * t + index * Math.sin(2 * Math.PI * modHz * t)));
    };
    source = mul(source, envelope(0.002, glass ? 0.8 : 0.15, glass ? 0.12 : 0.28));
  } else if (id === 'edm_pluck') {
    const tone = add(gain(partial(1, 'saw'), -5), gain(partial(2, 'tri'), -12));
    source = mul(sweep(tone, sr, i => 350 + 6500 * Math.exp(-i / (sr * 0.055))), envelope(0.0015, 0.18, 0.08));
  } else if (id === 'reese_bass') {
    const tone = add(gain(osc(sr, hz * 0.989, 'saw'), -9), gain(osc(sr, hz * 1.011, 'saw'), -9), gain(partial(1), -10));
    source = mul(filter(tone, sr, 'lp', 1800), envelope(0.012, 0.13, 0.85));
  } else if (id === 'sub_bass') {
    source = mul(add(gain(partial(1), -2), gain(partial(2), -22)), envelope(0.009, 0.12, 0.88));
  } else if (id === 'acid_bass') {
    const highSr = sr * 2;
    const saw = osc(highSr, hz, 'saw');
    const tone = sweep(saw, highSr, i => 150 + 6500 * Math.exp(-i / (highSr * 0.085)), 0.8);
    const saturated = filter(i => f32(Math.tanh(tone(i) * 1.8) * 0.72), highSr, 'lp', Math.min(8000, sr * 0.4));
    source = mul(i => f32((saturated(i * 2) + saturated(i * 2 + 1)) * 0.5), envelope(0.002, 0.16, 0.32));
  } else if (id === 'analog_pad') {
    const tone = add(gain(osc(sr, hz * 0.997, 'saw'), -9), gain(osc(sr, hz * 1.003, 'tri'), -7));
    source = mul(sweep(tone, sr, i => 950 + 500 * Math.sin(2 * Math.PI * 0.21 * i / sr)), envelope(short ? 0.007 : 0.26, 0.5, 0.72));
  } else if (id === 'shimmer_pad') {
    const upper = mul(add(gain(partial(2), -12), gain(partial(4), -18)), i => f32(0.55 + 0.45 * Math.sin(2 * Math.PI * 0.7 * i / sr) ** 2));
    source = mul(add(gain(osc(sr, hz * 0.998), -6), gain(osc(sr, hz * 1.002), -9), upper), envelope(short ? 0.007 : 0.35, 0.6, 0.75));
  } else {
    throw new Error('Unknown electronic voice: ' + id);
  }
  return { dur, source };
}
