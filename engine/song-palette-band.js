import { createRng } from './rng.js';

export const INSTRUMENTS = {
  guitar_clean: { name: 'Clean electric synth guitar', part: 'keys', level: 0.3, pan: -0.18 },
  guitar_muted: { name: 'Muted electric synth guitar', part: 'keys', level: 0.32, pan: -0.15 },
  guitar_drive: { name: 'Sustained driven synth guitar', part: 'keys', level: 0.23, pan: -0.2 },
  guitar_heavy: { name: 'Heavy gated synth guitar', part: 'keys', level: 0.24, pan: -0.18 },
  pizzicato: { name: 'Pizzicato synth strings', part: 'keys', level: 0.32, pan: 0.15 },
  bowed: { name: 'Bowed synth strings', part: 'pad', level: 0.2, pan: 0.15 },
  brass_warm: { name: 'Warm synth brass', part: 'pad', level: 0.2, pan: -0.1 },
  reed: { name: 'Airy synth reed', part: 'keys', level: 0.3, pan: 0.12 },
  soft_flute: { name: 'Soft flute', part: 'keys', level: 0.24, pan: -0.1 },
  drums_analog: { name: 'Punchy analog drums', part: 'drums', level: 0.45, pan: 0 },
  drums_tight: { name: 'Tight rock synth drums', part: 'drums', level: 0.45, pan: 0 },
};

export function voiceDuration(id, note, len) {
  if (id.startsWith('drums_')) {
    return note.midi === 36 ? (id === 'drums_analog' ? 0.42 : 0.25)
      : note.midi === 38 ? (id === 'drums_analog' ? 0.22 : 0.17) : 0.075;
  }
  const short = note.articulation === 'short';
  return len + ({ guitar_clean: 0.18, guitar_muted: 0.025, guitar_drive: 0.15,
    guitar_heavy: 0.035, pizzicato: 0.08, bowed: short ? 0.1 : 0.5,
    brass_warm: short ? 0.08 : 0.25, reed: 0.12, soft_flute: 0.2 }[id]);
}

export function makeVoice(id, note, len, sr, seed, beatSeconds, nodes) {
  const { osc, adsr, filter, add, gain, mul, perc, f32 } = nodes;
  const dur = voiceDuration(id, note, len);
  const hz = 440 * 2 ** ((note.midi - 69) / 12);
  const rng = createRng(seed).fork('band-voice');
  const noise = () => f32(rng.next() * 2 - 1);
  const partial = (multiple, db, type = 'sine') => gain(osc(sr, Math.min(hz * multiple, sr * 0.45), type), db);
  let source;
  if (id === 'guitar_clean') {
    const body = add(partial(1, -3), mul(partial(2, -9), perc(sr, 0.002, 0.24)),
      mul(partial(3, -14), perc(sr, 0.002, 0.13)), partial(1.003, -18));
    source = mul(body, adsr(sr, dur, 0.003, 0.35, 0.16, 0.18));
  } else if (id === 'guitar_muted') {
    const body = filter(add(partial(1, -7, 'tri'), partial(2, -16), gain(noise, -27)), sr, 'lp', 2500);
    source = mul(body, mul(perc(sr, 0.0015, 0.085), adsr(sr, dur, 0.001, 0.08, 0.08, 0.025)));
  } else if (id === 'guitar_drive' || id === 'guitar_heavy') {
    const heavy = id === 'guitar_heavy';
    const rate = sr * 2;
    const main = osc(rate, hz, 'saw');
    const detune = osc(rate, hz * 1.002, 'pulse', 0.44);
    const fifth = osc(rate, hz * 1.5, 'saw');
    const drive = heavy ? 5.2 : 2.5;
    const clipped = (i) => f32(Math.tanh((main(i) * 0.65 + detune(i) * 0.2 + fifth(i) * 0.15) * drive));
    const cabinet = filter(filter(clipped, rate, 'hp', heavy ? 100 : 150), rate, 'lp', heavy ? 3400 : 4600);
    const down = filter(cabinet, rate, 'lp', sr * 0.2);
    const body = (i) => f32((down(i * 2) + down(i * 2 + 1)) * 0.5);
    source = mul(gain(body, -4), adsr(sr, dur, 0.003, heavy ? 0.055 : 0.16, heavy ? 0.34 : 0.7, heavy ? 0.035 : 0.15));
  } else if (id === 'pizzicato') {
    const body = add(partial(1, -5, 'tri'), mul(partial(2, -13), perc(sr, 0.001, 0.06)),
      mul(partial(3, -19), perc(sr, 0.001, 0.035)));
    source = mul(filter(body, sr, 'lp', 5400), mul(perc(sr, 0.003, 0.2), adsr(sr, dur, 0.002, 0.2, 0.12, 0.08)));
  } else if (id === 'bowed') {
    const body = add(partial(0.997, -12, 'saw'), partial(1.003, -12, 'saw'), partial(2, -23, 'tri'), gain(noise, -39));
    const envelope = adsr(sr, dur, note.articulation === 'short' ? 0.02 : 0.16, 0.3, 0.82, dur - len);
    source = mul(filter(body, sr, 'lp', 2600), envelope);
  } else if (id === 'brass_warm') {
    const body = add(partial(1, -11, 'saw'), partial(1.004, -17, 'saw'), partial(2, -22, 'square'));
    const bright = mul(partial(3, -22, 'tri'), perc(sr, 0.015, 0.18));
    source = mul(add(filter(body, sr, 'lp', 1500), gain(bright, -9)), adsr(sr, dur, 0.025, 0.17, 0.63, dur - len));
  } else if (id === 'soft_flute') {
    const pitch = (i) => {
      const t = i / sr;
      const depth = Math.min(1, Math.max(0, (t - 0.2) / 0.4));
      return Math.min(sr * 0.44, hz * (1 + Math.sin(2 * Math.PI * 4.6 * t) * 0.0015 * depth));
    };
    const tone = add(gain(osc(sr, pitch), -3),
      gain(osc(sr, i => Math.min(sr * 0.44, pitch(i) * 2)), -25), partial(3, -38));
    const breath = gain(filter(filter(noise, sr, 'hp', 600), sr, 'lp', 2200), -42);
    source = mul(add(tone, breath), adsr(sr, dur, Math.min(0.065, len * 0.3), 0.16, 0.72, 0.2));
  } else if (id === 'reed') {
    const pitch = (i) => Math.min(sr * 0.44, hz * (1 + Math.sin(2 * Math.PI * i / sr * 5.1) * 0.0025 * Math.min(1, i / sr / 0.18)));
    const body = add(gain(osc(sr, pitch, 'square'), -12), partial(1, -10), gain(filter(noise, sr, 'hp', 1700), -31));
    source = mul(filter(body, sr, 'lp', 4200), adsr(sr, dur, 0.023, 0.1, 0.75, 0.12));
  } else {
    const analog = id === 'drums_analog';
    if (note.midi === 36) {
      const pitch = (i) => (analog ? 46 : 57) + (analog ? 110 : 150) * Math.exp(-i / sr / 0.022);
      const body = mul(osc(sr, pitch), perc(sr, 0.001, analog ? 0.13 : 0.065));
      const click = mul(filter(noise, sr, 'hp', 2000), perc(sr, 0.0005, 0.006));
      source = add(gain(body, -2), gain(click, analog ? -20 : -13));
    } else if (note.midi === 38) {
      const body = mul(add(gain(osc(sr, analog ? 180 : 210), -9), gain(osc(sr, 330), -15)), perc(sr, 0.001, 0.04));
      const wire = mul(filter(filter(noise, sr, 'hp', 1000), sr, 'lp', 8500), perc(sr, 0.001, analog ? 0.065 : 0.04));
      source = add(body, gain(wire, analog ? -4 : -3));
    } else {
      const metal = add(gain(osc(sr, 4100, 'square'), -16), gain(osc(sr, 5677, 'square'), -18), gain(noise, -12));
      source = mul(filter(metal, sr, 'hp', analog ? 6200 : 4800), perc(sr, 0.0005, analog ? 0.022 : 0.014));
    }
  }
  const frames = Math.max(0, Math.round(dur * sr));
  const fade = Math.max(1, Math.round(sr * 0.008));
  return { dur, source: (i) => f32(source(i) * Math.min(1, Math.max(0, frames - 1 - i) / fade)) };
}
