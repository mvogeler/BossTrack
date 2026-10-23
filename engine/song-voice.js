import { decayAt, shapeAt } from './kit/util.js';
import { createRng } from './rng.js';
import { PALETTE, paletteDuration, paletteVoice } from './song-palette.js';

const f32 = Math.fround;

export function songVoiceFrames(instrument, note, len, sr) {
  if (Object.hasOwn(PALETTE, instrument)) return Math.max(0, Math.round(paletteDuration(instrument, note, len) * sr));
  const short = note.articulation === 'short';
  const release = { chip: 0.02, lead: 0.25, pad: short ? 0.08 : 0.4, bass: 0,
    organ: short ? 0.08 : 0.3, bright: short ? 0.08 : 0.3, growl: 0.08,
    keys: 0.55, flute: 0.12, pluck: 0.12, pluckbass: 0.12, wobble: 0.06, chug: 0.035 }[instrument];
  let dur = len + release;
  if (instrument === 'drums') dur = note.midi === 36 ? 0.28 : note.midi === 38 ? 0.18 : 0.07;
  if (instrument === 'electronic' || instrument === 'chipdrums') {
    dur = note.midi === 36 ? (instrument === 'chipdrums' ? 0.12 : 0.4) : note.midi === 38 ? 0.2 : 0.05;
  }
  return Math.max(0, Math.round(dur * sr));
}

function blep(t, dt) {
  if (t < dt) {
    t /= dt;
    return t + t - t * t - 1;
  }
  if (t > 1 - dt) {
    t = (t - 1) / dt;
    return t * t + t + t + 1;
  }
  return 0;
}

export function songOsc(sr, freq, type = 'sine', pw = 0.5) {
  let phase = 0;
  const fixed = typeof freq !== 'function';
  const step = fixed ? Math.max(0, freq) / sr : 0;
  return (i) => {
    const dt = fixed ? step : Math.max(0, freq(i)) / sr;
    let value;
    if (type === 'sine') value = Math.sin(2 * Math.PI * phase);
    else if (type === 'tri') value = phase < 0.25 ? 4 * phase : phase < 0.75 ? 2 - 4 * phase : 4 * phase - 4;
    else if (type === 'saw') value = 2 * phase - 1 - blep(phase, dt);
    else {
      const width = type === 'square' ? 0.5 : pw;
      value = (phase < width ? 1 : -1) + blep(phase, dt) - blep((phase - width + 1) % 1, dt);
    }
    phase += dt;
    phase -= Math.floor(phase);
    return f32(value);
  };
}

export function songAdsr(sr, dur, attack, decay, sustain, release) {
  const held = 1 + (sustain - 1) * shapeAt(1, 'exp');
  const hold = (t) => {
    if (t < attack) return t / attack;
    if (decay > 0 && t - attack >= decay) return held;
    const x = Math.min(1, (t - attack) / decay);
    return 1 + (sustain - 1) * shapeAt(x, 'exp');
  };
  const relAt = Math.max(0, dur - release);
  const relFrom = hold(relAt);
  return (i) => {
    const t = i / sr;
    return f32(t < relAt ? hold(t) : relFrom * (1 - shapeAt(Math.min(1, (t - relAt) / release), 'exp')));
  };
}

export const songPerc = (sr, attack, decay) => (i) => f32(i / sr < attack ? i / sr / attack : decayAt(i / sr - attack, decay));
export const songGain = (source, db) => {
  const gain = 10 ** (db / 20);
  return (i) => f32(source(i) * gain);
};
export const songMul = (source, envelope) => (i) => f32(source(i) * envelope(i));
export const songAdd = (...sources) => (i) => sources.reduce((sum, source) => f32(sum + source(i)), 0);

function filter(source, sr, type, freq) {
  const w = 2 * Math.PI * Math.min(Math.max(freq, 10), sr * 0.49) / sr;
  const cs = Math.cos(w);
  const alpha = Math.sin(w) / (2 * Math.SQRT1_2);
  const a0 = 1 + alpha;
  const b0 = (type === 'lp' ? (1 - cs) / 2 : (1 + cs) / 2) / a0;
  const b1 = (type === 'lp' ? 1 - cs : -(1 + cs)) / a0;
  const b2 = b0;
  const a1 = -2 * cs / a0;
  const a2 = (1 - alpha) / a0;
  let x1 = 0, x2 = 0, y1 = 0, y2 = 0;
  return (i) => {
    const x = source(i);
    const y = b0 * x + b1 * x1 + b2 * x2 - a1 * y1 - a2 * y2;
    x2 = x1;
    x1 = x;
    y2 = y1;
    y1 = y;
    return f32(y);
  };
}

export { filter as songFilter };

function chirp(sr, dur, f0, f1) {
  const frames = Math.max(0, Math.round(dur * sr));
  const osc = songOsc(sr, (i) => f32(f0 * (f1 / f0) ** (i / Math.max(1, frames - 1))));
  const fadeIn = Math.max(1, Math.round(0.0005 * sr));
  return (i) => f32(osc(i) * (Math.min(1, i / fadeIn) * decayAt(i / sr, dur)));
}

function keys(sr, hz, dur) {
  const index = songPerc(sr, 0.002, 0.3);
  let carrier = 0;
  let phase = 0;
  return (i) => {
    const mod = Math.min(index(i), Math.max(0, (sr / 2 - hz) / hz - 2)) * Math.sin(2 * Math.PI * phase);
    phase += hz / sr;
    phase -= Math.floor(phase);
    const t = carrier + mod / (2 * Math.PI);
    const value = f32(Math.sin(2 * Math.PI * (t - Math.floor(t))));
    carrier += hz / sr;
    carrier -= Math.floor(carrier);
    return value;
  };
}

function pluck(sr, hz, dur, damping, seed) {
  const rng = createRng(seed).fork('pluck').fork('pluck0');
  const f = Math.min(Math.max(hz, 20), sr / 8);
  const period = sr / f;
  const w = 2 * Math.PI * f / sr;
  const s = 0.1 + 0.4 * damping;
  const re = 1 - s + s * Math.cos(w);
  const im = s * Math.sin(w);
  const lpDelay = Math.atan2(im, re) / w;
  const t60 = 3 * 0.015 ** damping;
  const g = Math.min(0.99999, 10 ** (-3 / (t60 * f)) / Math.hypot(re, im));
  const rest = period - lpDelay;
  const length = Math.floor(rest - 0.5);
  const frac = rest - length;
  const c = Math.sin((w * (1 - frac)) / 2) / Math.sin((w * (1 + frac)) / 2);
  const exc = new Float32Array(Math.round(period));
  for (let i = 0; i < exc.length; i++) exc[i] = rng.range(-1, 1);
  const mean = exc.reduce((a, value) => a + value, 0) / exc.length;
  const cut = Math.min(0.45 * sr, f * 2 ** (1 + 6 * 0.65));
  const low = filter(i => f32(exc[i] - mean), sr, 'lp', cut);
  let burst = Float32Array.from(exc, (_, i) => low(i));
  const gap = Math.round(0.13 * period);
  if (gap > 0) burst = burst.map((value, i) => value - (i >= gap ? burst[i - gap] : 0));
  const state = () => {
    const line = new Float32Array(length);
    let pos = 0, lp1 = 0, apx = 0, apy = 0;
    return (i) => {
      const back = line[pos];
      const lp = (1 - s) * back + s * lp1;
      lp1 = back;
      apy = c * lp + apx - c * apy;
      apx = lp;
      const value = (burst[i] ?? 0) + g * apy;
      line[pos] = value;
      pos = (pos + 1) % length;
      return value;
    };
  };
  const probe = state();
  let peak = 0;
  for (let i = 0; i < Math.max(0, Math.round(dur * sr)); i++) peak = Math.max(peak, Math.abs(probe(i)));
  const play = state();
  return (i) => {
    const value = f32(play(i));
    return peak > 0 ? f32(value / peak) : value;
  };
}

export function songVoiceBlocks(instrument, note, len, sr, seed = 1, beatSeconds = 0.5) {
  const hz = 440 * 2 ** ((note.midi - 69) / 12);
  const osc = (freq, type, pw) => songOsc(sr, freq, type, pw);
  const adsr = (...args) => songAdsr(sr, ...args);
  const rng = createRng(seed).fork('noise').fork('noise0');
  const noise = () => f32(rng.range(-1, 1));
  let dur;
  let source;
  if (Object.hasOwn(PALETTE, instrument)) {
    ({ dur, source } = paletteVoice(instrument, note, len, sr, seed, beatSeconds, {
      osc: songOsc, adsr: songAdsr, filter, add: songAdd, gain: songGain,
      mul: songMul, perc: songPerc, f32,
    }));
  } else if (instrument === 'pluck' || instrument === 'pluckbass') {
    dur = len + 0.12;
    source = songMul(pluck(sr, hz, dur, instrument === 'pluck' ? 0.3 : 0.5, seed), adsr(dur, 0.002, 0.2, 0.8, 0.12));
  } else if (instrument === 'chip') {
    dur = len + 0.02;
    source = songMul(osc(hz, 'pulse', 0.25), adsr(dur, 0.002, 0.04, 0.65, 0.02));
  } else if (instrument === 'lead') {
    dur = len + 0.25;
    source = songMul(songAdd(osc(hz, 'tri'), songGain(osc(hz * 2), -18)), adsr(dur, 0.012, 0.18, 0.45, 0.25));
  } else if (instrument === 'pad') {
    const short = note.articulation === 'short';
    const release = short ? 0.08 : 0.4;
    dur = len + release;
    source = songMul(songAdd(osc(hz * 0.998, 'tri'), osc(hz * 1.002)), adsr(dur, short ? 0.008 : 0.18, short ? Math.min(0.08, len * 0.5) : 0.5, 0.55, release));
  } else if (instrument === 'bass') {
    dur = len;
    source = songMul(songAdd(osc(hz), songGain(osc(hz * 2), -14)), adsr(dur, 0.008, 0.2, 0.65, 0.08));
  } else if (instrument === 'organ') {
    const short = note.articulation === 'short';
    const release = short ? 0.08 : 0.3;
    dur = len + release;
    source = songMul(songAdd(osc(hz), songGain(osc(hz * 2), -8), songGain(osc(hz * 3), -12)), adsr(dur, short ? 0.008 : 0.01, 0.1, 0.7, release));
  } else if (instrument === 'bright') {
    const short = note.articulation === 'short';
    const release = short ? 0.08 : 0.3;
    dur = len + release;
    const tone = filter(songAdd(osc(hz * 0.997, 'saw'), osc(hz * 1.003, 'saw')), sr, 'lp', 3200);
    source = songMul(tone, adsr(dur, short ? 0.008 : 0.09, 0.1, 0.7, release));
  } else if (instrument === 'growl') {
    dur = len + 0.08;
    const tone = filter(songAdd(osc(hz, 'saw'), songGain(osc(hz / 2, 'square'), -8)), sr, 'lp', 900);
    source = songMul(tone, adsr(dur, 0.008, 0.15, 0.65, 0.08));
  } else if (instrument === 'wobble') {
    dur = len + 0.06;
    const rate = createRng(seed).fork('wobble').pick([1, 2, 4]);
    const saw = songAdd(osc(hz, 'saw'), songGain(osc(hz * 1.006, 'saw'), -9));
    const sub = osc(hz / 2);
    let low = 0, low2 = 0;
    const tone = (i) => {
      const motion = 0.5 - 0.5 * Math.cos(2 * Math.PI * rate * i / (sr * beatSeconds));
      const cutoff = 160 * 14 ** motion;
      const a = 1 - Math.exp(-2 * Math.PI * cutoff / sr);
      low += a * (saw(i) - low);
      low2 += a * (low - low2);
      return f32(Math.tanh(low2 * 2) * 0.7 + sub(i) * 0.3);
    };
    source = songMul(tone, adsr(dur, 0.005, 0.1, 0.85, 0.06));
  } else if (instrument === 'chug') {
    dur = len + 0.035;
    const highSr = sr * 4;
    const strings = songAdd(songOsc(highSr, hz, 'saw'), songGain(songOsc(highSr, hz * 2 ** (7 / 12), 'saw'), -6));
    const input = filter(strings, highSr, 'hp', 100);
    const drive = filter(i => f32(Math.tanh(input(i) * 5)), highSr, 'lp', 3300);
    const cabinet = filter(drive, highSr, 'lp', Math.min(6500, sr * 0.4));
    const tone = (i) => {
      let sum = 0;
      for (let j = 0; j < 4; j++) sum += cabinet(i * 4 + j);
      return f32(sum / 4);
    };
    source = songMul(tone, adsr(dur, 0.002, Math.min(0.06, len * 0.5), 0.32, 0.035));
  } else if (instrument === 'keys') {
    dur = len + 0.55;
    source = songMul(keys(sr, hz, dur), adsr(dur, 0.005, 0.8, 0.18, 0.55));
  } else if (instrument === 'flute') {
    dur = len + 0.12;
    const freq = (i) => {
      const t = i / sr;
      const depth = Math.min(1, Math.max(0, (t - 0.12) / 0.25));
      return f32(hz * (1 + 0.003 * depth * Math.sin(2 * Math.PI * 5 * t)));
    };
    const tone = songAdd(osc(freq), songGain(osc(i => f32(freq(i) * 2)), -20));
    const breath = filter(filter(noise, sr, 'hp', 1200), sr, 'lp', 5500);
    source = songMul(songAdd(tone, songGain(breath, -30)), adsr(dur, Math.min(0.035, len * 0.3), 0.12, 0.8, 0.12));
  } else if (instrument === 'electronic' || instrument === 'chipdrums' || instrument === 'drums') {
    const kick = note.midi === 36;
    const snare = note.midi === 38;
    const chip = instrument === 'chipdrums';
    if (instrument === 'drums') {
      dur = kick ? 0.28 : snare ? 0.18 : 0.07;
      const tone = filter(noise, sr, 'hp', snare ? 900 : 6500);
      source = kick ? songGain(chirp(sr, dur, 135, 45), 4) : songMul(snare ? songAdd(tone, songGain(osc(185), -12)) : tone, songPerc(sr, 0.001, dur));
    } else {
      dur = kick ? (chip ? 0.12 : 0.4) : snare ? 0.2 : 0.05;
      const tone = kick ? (chip ? osc(70, 'square') : chirp(sr, dur, 160, 38)) : filter(noise, sr, 'hp', snare ? 1800 : chip ? 9000 : 11000);
      source = songMul(snare && !chip ? songAdd(tone, songGain(osc(220), -8)) : tone, songPerc(sr, 0.001, dur * 0.8));
    }
  } else {
    throw new Error('Unsupported block voice: ' + instrument);
  }
  if (note.expression === 'swell') {
    const tone = source;
    source = i => f32(tone(i) * (0.58 + 0.42 * Math.sin(Math.PI * Math.min(1, i / (sr * Math.max(len, 0.001))))));
  }
  const frames = Math.max(0, Math.round(dur * sr));
  function* blocks(size) {
    if (!Number.isInteger(size) || size < 1) throw new Error('Invalid voice block size');
    for (let at = 0; at < frames; at += size) {
      const out = new Float32Array(Math.min(size, frames - at));
      for (let j = 0; j < out.length; j++) out[j] = source(at + j);
      yield [out];
    }
  }
  return { frames, channels: 1, blocks };
}
