import { createRng } from './rng.js';

export const INSTRUMENTS = {
  guitar_palm: { name: 'Palm-muted metal synth guitar', part: 'keys', level: 0.34, pan: -0.18 },
  guitar_soaring: { name: 'Singing lead synth guitar', part: 'keys', level: 0.27, pan: -0.12 },
  guitar_power: { name: 'Driven power synth chords', part: 'pad', level: 0.16, pan: 0.18 },
  bass_grit: { name: 'Gritty picked synth bass', part: 'bass', level: 0.38, pan: 0 },
  bass_808: { name: 'Long 808 synth bass', part: 'bass', level: 0.42, pan: 0 },
  digital_pluck: { name: 'Bright digital pluck', part: 'keys', level: 0.28, pan: -0.18 },
  brass_impact: { name: 'Punchy synth brass', part: 'pad', level: 0.18, pan: 0.14 },
  drums_impact: { name: 'Pop impact synth kit', part: 'drums', level: 0.5, pan: 0 },
  drums_machine: { name: 'Industrial synth kit', part: 'drums', level: 0.48, pan: 0 },
};

export function voiceDuration(id, note, len) {
  if (id.startsWith('drums_')) return ({ 36: 0.36, 38: 0.24, 39: 0.2, 42: 0.09, 45: 0.32, 49: 1.4, 54: 0.12, 56: 0.65 }[note.midi] ?? 0.09);
  return len + ({ guitar_palm: 0.025, guitar_soaring: 0.22, guitar_power: 0.09,
    bass_grit: 0.06, bass_808: 0.24, digital_pluck: 0.2, brass_impact: 0.12 }[id]);
}

export function makeVoice(id, note, len, sr, seed, beatSeconds, nodes) {
  const { osc, adsr, filter, add, gain, mul, perc, f32 } = nodes;
  const dur = voiceDuration(id, note, len);
  const hz = Math.min(sr * 0.2, 440 * 2 ** ((note.midi - 69) / 12));
  const from = note.slideFrom === undefined ? hz : Math.min(sr * 0.2, 440 * 2 ** ((note.slideFrom - 69) / 12));
  const glide = t => from * (hz / from) ** Math.min(1, t / Math.min(0.09, len * 0.35));
  const rng = createRng(seed).fork('modern-voice');
  const noise = () => f32(rng.next() * 2 - 1);
  let source;
  if (id.startsWith('guitar_')) {
    const muted = id === 'guitar_palm';
    const lead = id === 'guitar_soaring';
    const rate = sr * 2;
    const pitch = i => glide(i / rate) * (1 + (lead ? 0.003 * Math.min(1, Math.max(0, i / rate - 0.15)) * Math.sin(i / rate * Math.PI * 10.4) : 0));
    const strings = add(...[1, 2, 3, 4, 5, 6].map((n, j) => {
      const tone = osc(rate, i => Math.min(rate * 0.44, pitch(i) * n));
      return gain(mul(tone, i => f32((0.25 + 0.75 * Math.exp(-i / rate / (0.15 / n))) * (j % 2 ? -1 : 1))), -j * 4 - 7);
    }), gain(osc(rate, hz * 2 ** (7 / 12), 'tri'), lead ? -30 : -15));
    const picked = add(strings, mul(gain(noise, -20), perc(rate, 0.0005, 0.006)));
    const driven = i => f32(Math.tanh(picked(i) * (muted ? 8 : 5)));
    const cabinet = filter(filter(filter(driven, rate, 'hp', 75), rate, 'lp', muted ? 2600 : 4100), rate, 'lp', sr * 0.2);
    const body = i => f32((cabinet(i * 2) + cabinet(i * 2 + 1)) * 0.5);
    const envelope = adsr(sr, dur, 0.002, muted ? 0.045 : 0.16, muted ? 0.17 : 0.68, dur - len);
    source = mul(gain(body, -3), envelope);
  } else if (id === 'bass_grit') {
    const body = add(gain(osc(sr, i => glide(i / sr)), -4), gain(osc(sr, i => glide(i / sr), 'saw'), -13));
    const click = mul(gain(filter(noise, sr, 'hp', 1600), -25), perc(sr, 0.001, 0.016));
    source = mul(add(filter(body, sr, 'lp', 1800), click), adsr(sr, dur, 0.002, 0.14, 0.64, 0.06));
  } else if (id === 'bass_808') {
    const pitch = i => glide(i / sr) * (1 + 0.18 * Math.exp(-i / sr / 0.014));
    const body = add(gain(osc(sr, pitch), -4), gain(osc(sr, i => pitch(i) * 2), -21), gain(osc(sr, i => Math.min(sr * 0.44, pitch(i) * 3)), -27));
    source = mul(body, adsr(sr, dur, 0.003, 0.45, 0.55, 0.24));
  } else if (id === 'digital_pluck') {
    const body = add(gain(osc(sr, hz), -5), mul(gain(osc(sr, Math.min(hz * 3, sr * 0.44)), -10), perc(sr, 0.001, 0.065)),
      mul(gain(osc(sr, Math.min(hz * 5, sr * 0.44)), -18), perc(sr, 0.001, 0.025)));
    source = mul(body, mul(perc(sr, 0.002, 0.18), adsr(sr, dur, 0.002, 0.15, 0.2, 0.2)));
  } else if (id === 'brass_impact') {
    const body = add(gain(osc(sr, hz, 'saw'), -10), gain(osc(sr, hz * 1.004, 'saw'), -13), gain(osc(sr, hz), -16));
    const bright = mul(gain(osc(sr, hz * 2, 'tri'), -14), perc(sr, 0.004, 0.07));
    source = mul(add(filter(body, sr, 'lp', 2800), bright), adsr(sr, dur, 0.008, 0.11, 0.45, 0.12));
  } else {
    const machine = id === 'drums_machine';
    if (note.midi === 36) {
      const pitch = i => 47 + 145 * Math.exp(-i / sr / 0.018);
      source = add(mul(gain(osc(sr, pitch), -2), perc(sr, 0.001, 0.105)),
        mul(gain(filter(noise, sr, 'hp', 2200), -15), perc(sr, 0.0005, 0.004)));
    } else if (note.midi === 38 || note.midi === 39) {
      const clap = note.midi === 39;
      const wire = filter(filter(noise, sr, 'hp', clap ? 900 : 1300), sr, 'lp', 7500);
      const envelope = i => {
        const t = i / sr;
        const bursts = clap ? [0, 0.012, 0.024].reduce((sum, at) => sum + (t >= at ? Math.exp(-(t - at) / 0.007) : 0), 0) : 0;
        return f32(Math.min(1, t / 0.001) * (bursts * 0.35 + Math.exp(-t / 0.055) * 0.6));
      };
      source = add(mul(gain(wire, -2), envelope), mul(gain(osc(sr, machine ? 220 : 185), clap ? -27 : -10), perc(sr, 0.001, 0.035)));
    } else if (note.midi === 45) {
      source = mul(add(gain(osc(sr, i => 110 + 70 * Math.exp(-i / sr / 0.015)), -3), gain(filter(noise, sr, 'lp', 1900), -21)), perc(sr, 0.001, 0.09));
    } else if (note.midi === 56) {
      const metal = add(...[413, 721, 1069, 1733, 2819].map((f, i) => gain(osc(sr, f), -7 - i * 3)));
      source = mul(metal, perc(sr, 0.001, machine ? 0.2 : 0.11));
    } else {
      const crash = note.midi === 49;
      const shaker = note.midi === 54;
      const metal = add(gain(noise, -7), ...[3209, 4217, 5791].map(f => gain(osc(sr, Math.min(f, sr * 0.44), 'square'), -22)));
      source = mul(filter(metal, sr, 'hp', crash ? 2500 : shaker ? 4200 : 6500), perc(sr, 0.0005, crash ? 0.35 : shaker ? 0.025 : 0.017));
    }
  }
  const frames = Math.round(dur * sr);
  const fade = Math.max(1, Math.round(sr * 0.006));
  return { dur, source: i => f32(source(i) * Math.min(1, Math.max(0, frames - 1 - i) / fade)) };
}
