import { filters } from './filter.js';
import { valueAt } from './util.js';

const TAU = 2 * Math.PI;

const allpassCoef = (f, sr) => {
  const t = Math.tan((Math.PI * f) / sr);
  return (t - 1) / (t + 1);
};

export function plucks({ sr, n, rng }) {
  const { filter } = filters({ sr });
  let calls = 0;

  function pluck(dur, freq, { damping = 0.5, brightness = 0.5, pick = 0.13 } = {}) {
    const r = rng.fork(`pluck${calls++}`);
    const out = new Float32Array(n(dur));
    const f = Math.min(Math.max(freq, 20), sr / 8);
    const period = sr / f;
    const w = (TAU * f) / sr;

    const s = 0.1 + 0.4 * damping;
    const re = 1 - s + s * Math.cos(w);
    const im = s * Math.sin(w);
    const lpDelay = Math.atan2(im, re) / w;
    const t60 = 3 * 0.015 ** damping;
    const g = Math.min(0.99999, 10 ** (-3 / (t60 * f)) / Math.hypot(re, im));

    const rest = period - lpDelay;
    const len = Math.floor(rest - 0.5);
    const frac = rest - len;
    const c = Math.sin((w * (1 - frac)) / 2) / Math.sin((w * (1 + frac)) / 2);

    const exc = new Float32Array(Math.round(period));
    for (let i = 0; i < exc.length; i++) exc[i] = r.range(-1, 1);
    const mean = exc.reduce((a, v) => a + v, 0) / exc.length;
    const cut = Math.min(0.45 * sr, f * 2 ** (1 + 6 * brightness));
    let burst = filter(exc.map((v) => v - mean), 'lp', cut);
    const gap = Math.round(pick * period);
    if (gap > 0) burst = burst.map((v, i) => v - (i >= gap ? burst[i - gap] : 0));

    const line = new Float32Array(len);
    let pos = 0;
    let lp1 = 0;
    let apx = 0;
    let apy = 0;
    let peak = 0;
    for (let i = 0; i < out.length; i++) {
      const back = line[pos];
      const lp = (1 - s) * back + s * lp1;
      lp1 = back;
      apy = c * lp + apx - c * apy;
      apx = lp;
      const y = (burst[i] ?? 0) + g * apy;
      line[pos] = y;
      pos = (pos + 1) % len;
      out[i] = y;
      peak = Math.max(peak, Math.abs(y));
    }
    if (peak > 0) for (let i = 0; i < out.length; i++) out[i] /= peak;
    return out;
  }

  return {
    pluck,

    dispersion(sig, { stages = 24, freq = 1000 } = {}) {
      const lowest = typeof freq === 'number' ? freq : freq.reduce((m, v) => Math.min(m, v));
      const a0 = allpassCoef(lowest, sr);
      const tail = Math.min(n(2), Math.ceil((stages * (1 - a0)) / (1 + a0)));
      const out = new Float32Array(sig.length + tail);
      const xs = new Float64Array(stages);
      const ys = new Float64Array(stages);
      let lastF = NaN;
      let a = 0;
      for (let i = 0; i < out.length; i++) {
        const f = valueAt(freq, i);
        if (f !== lastF) {
          a = allpassCoef(f, sr);
          lastF = f;
        }
        let x = sig[i] ?? 0;
        for (let j = 0; j < stages; j++) {
          const y = a * x + xs[j] - a * ys[j];
          xs[j] = x;
          ys[j] = y;
          x = y;
        }
        out[i] = x;
      }
      return out;
    },

    split(sig, freq) {
      const low = filter(filter(sig, 'lp', freq), 'lp', freq);
      const high = filter(filter(sig, 'hp', freq), 'hp', freq);
      return [low, high];
    },
  };
}
