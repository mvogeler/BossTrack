import { createRng } from './rng.js';
import { movingFilter } from './song-palette-space.js';

export const INSTRUMENTS = {
  neon_lead: { name: 'Neon glide lead', part: 'keys', level: 0.34, pan: -0.1, echo: true },
  neon_pluck: { name: 'Neon arp pluck', part: 'keys', level: 0.26, pan: 0.16, echo: true },
  neon_chords: { name: 'Neon wide saw chords', part: 'pad', level: 0.13, pan: 0.12 },
  neon_bass: { name: 'Neon octave bass', part: 'bass', level: 0.3, pan: 0 },
  drums_neon: { name: 'Neon electro-pop kit', part: 'drums', level: 0.5, pan: 0 },
};

const RELEASE = { neon_lead: 0.22, neon_pluck: 0.14, neon_chords: 0.35, neon_bass: 0.06 };
const HITS = { 36: 0.5, 38: 0.36, 39: 0.3, 42: 0.08, 45: 0.4, 46: 0.48, 49: 2.2, 54: 0.1 };

export function voiceDuration(id, note, len) {
  if (id === 'drums_neon') return HITS[note.midi] ?? 0.1;
  return len + (id === 'neon_chords' && note.articulation === 'short' ? 0.1 : RELEASE[id]);
}

export function makeVoice(id, note, len, sr, seed, beatSeconds, nodes) {
  const { osc, adsr, filter, add, gain, mul, perc, f32 } = nodes;
  const dur = voiceDuration(id, note, len);
  const release = dur - len;
  const pitch = midi => Math.min(sr * 0.2, 440 * 2 ** ((midi - 69) / 12));
  const hz = pitch(note.midi);
  const from = note.slideFrom === undefined ? hz : pitch(note.slideFrom);
  const glide = i => from * (hz / from) ** Math.min(1, i / sr / Math.min(0.07, len * 0.3));
  const rng = createRng(seed).fork('neon-voice');
  const noise = () => f32(rng.next() * 2 - 1);
  const top = sr * 0.44;
  let source;
  if (id === 'neon_lead') {
    const sung = i => glide(i) * (1 + 0.0045 * Math.min(1, Math.max(0, i / sr - 0.18) / 0.3) * Math.sin(2 * Math.PI * 5.6 * i / sr));
    const body = add(gain(osc(sr, i => sung(i) * 0.996, 'saw'), -9), gain(osc(sr, i => sung(i) * 1.004, 'saw'), -9),
      gain(osc(sr, i => Math.min(top, sung(i) * 2), 'square'), -21));
    const cutoff = i => hz * 2.5 + 2400 + 3200 * Math.exp(-i / sr / 0.09);
    source = mul(movingFilter(body, sr, cutoff), adsr(sr, dur, 0.006, 0.22, 0.72, release));
  } else if (id === 'neon_pluck') {
    const body = add(gain(osc(sr, hz, 'square'), -8), gain(osc(sr, hz * 1.005, 'pulse', 0.3), -11), gain(osc(sr, Math.min(top, hz * 2), 'saw'), -17));
    const cutoff = i => 300 + hz * 1.5 + 7000 * Math.exp(-i / sr / 0.04);
    source = mul(movingFilter(body, sr, cutoff), adsr(sr, dur, 0.001, 0.17, 0.06, release));
  } else if (id === 'neon_chords') {
    const short = note.articulation === 'short';
    const spread = rng.range(0.005, 0.008);
    const body = add(...[-2, -1, 0, 1, 2].map(n => gain(osc(sr, hz * (1 + spread * n), 'saw'), -15 - Math.abs(n))), gain(osc(sr, hz * 0.5, 'tri'), -14));
    const cutoff = i => 2300 + hz + 2200 * (1 - Math.exp(-i / sr / 0.4));
    source = mul(movingFilter(body, sr, cutoff), adsr(sr, dur, short ? 0.004 : 0.03, short ? 0.12 : 0.5, short ? 0.35 : 0.8, release));
  } else if (id === 'neon_bass') {
    const body = add(gain(osc(sr, glide, 'saw'), -8), gain(osc(sr, glide, 'square'), -15));
    const cutoff = i => 200 + hz * 2 + 2600 * Math.exp(-i / sr / 0.06);
    source = mul(add(movingFilter(body, sr, cutoff), gain(osc(sr, glide), -4)), adsr(sr, dur, 0.003, 0.12, 0.75, release));
  } else if (note.midi === 36) {
    const thump = mul(gain(osc(sr, i => 50 + 190 * Math.exp(-i / sr / 0.022)), -1), perc(sr, 0.001, 0.38));
    const click = mul(gain(filter(noise, sr, 'hp', 3000), -14), perc(sr, 0.0005, 0.006));
    const kick = add(thump, click);
    source = i => f32(Math.tanh(kick(i) * 1.6) * 0.8);
  } else if (note.midi === 38 || note.midi === 39) {
    const clap = i => {
      const t = i / sr;
      return f32(Math.min(1, t / 0.0008) * ([0, 0.01, 0.021].reduce((sum, at) => sum + (t >= at ? Math.exp(-(t - at) / 0.006) : 0), 0) * 0.4 +
        Math.exp(-t / (note.midi === 39 ? 0.06 : 0.075)) * 0.55));
    };
    const air = filter(filter(noise, sr, 'hp', 1100), sr, 'lp', 9000);
    source = note.midi === 39 ? mul(gain(air, -2), clap)
      : add(mul(gain(air, -3), clap), mul(gain(osc(sr, i => 185 + 60 * Math.exp(-i / sr / 0.01)), -9), perc(sr, 0.001, 0.12)));
  } else if (note.midi === 45) {
    source = mul(add(gain(osc(sr, i => 115 + 85 * Math.exp(-i / sr / 0.02)), -3), gain(filter(noise, sr, 'lp', 2200), -22)), perc(sr, 0.001, 0.36));
  } else {
    const open = note.midi === 46, crash = note.midi === 49, shaker = note.midi === 54;
    const metal = add(gain(noise, -6), ...[3311, 4553, 6017, 7919].map(f => gain(osc(sr, Math.min(f, top), 'square'), -24)));
    const decay = crash ? 2.1 : open ? 0.45 : shaker ? 0.08 : 0.065;
    source = mul(filter(metal, sr, 'hp', crash ? 2800 : shaker ? 5200 : open ? 6500 : 7800), perc(sr, shaker ? 0.009 : 0.0005, decay));
  }
  const frames = Math.round(dur * sr), fade = Math.max(1, Math.round(sr * 0.006));
  return { dur, source: i => f32(source(i) * Math.min(1, Math.max(0, frames - 1 - i) / fade)) };
}
