import { decayAt, valueAt } from './util.js';

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

function sample(type, t, dt, pw) {
  switch (type) {
    case 'sine':
      return Math.sin(2 * Math.PI * t);
    case 'tri':
      return t < 0.25 ? 4 * t : t < 0.75 ? 2 - 4 * t : 4 * t - 4;
    case 'saw':
      return 2 * t - 1 - blep(t, dt);
    case 'square':
    case 'pulse': {
      const w = type === 'square' ? 0.5 : pw;
      return (t < w ? 1 : -1) + blep(t, dt) - blep((t - w + 1) % 1, dt);
    }
    default:
      throw new Error(`Unknown oscillator type: ${type}`);
  }
}

export function oscillators({ sr, n, rng }) {
  function osc(dur, freq, { type = 'sine', pw = 0.5, phase = 0 } = {}) {
    const out = new Float32Array(n(dur));
    let t = phase % 1;
    for (let i = 0; i < out.length; i++) {
      const dt = Math.max(0, valueAt(freq, i)) / sr;
      out[i] = sample(type, t, dt, valueAt(pw, i));
      t += dt;
      t -= Math.floor(t);
    }
    return out;
  }

  return {
    osc,

    click({ tone = 0.5, freq = 500 * 32 ** tone, length = 0.004, noise = 0.3 } = {}) {
      const out = new Float32Array(Math.max(1, n(length * 2)));
      for (let i = 0; i < out.length; i++) {
        const t = i / sr;
        const body = Math.cos(2 * Math.PI * freq * t) * (1 - noise) + rng.range(-1, 1) * noise;
        out[i] = body * decayAt(t, length);
      }
      return out;
    },

    chirp(dur, f0, f1) {
      const out = osc(dur, sweepFreq(n(dur), f0, f1));
      const fadeIn = Math.max(1, n(0.0005));
      for (let i = 0; i < out.length; i++) {
        out[i] *= Math.min(1, i / fadeIn) * decayAt(i / sr, dur);
      }
      return out;
    },
  };
}

function sweepFreq(len, f0, f1) {
  const out = new Float32Array(len);
  const last = Math.max(1, len - 1);
  for (let i = 0; i < len; i++) out[i] = f0 * (f1 / f0) ** (i / last);
  return out;
}
