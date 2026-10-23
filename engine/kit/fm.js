import { curves } from './curve.js';
import { filters } from './filter.js';
import { valueAt } from './util.js';

const TAU = 2 * Math.PI;

function readAt(sig, pos) {
  const i = Math.floor(pos);
  const f = pos - i;
  const at = (j) => (j >= 0 && j < sig.length ? sig[j] : 0);
  const y0 = at(i - 1);
  const y1 = at(i);
  const y2 = at(i + 1);
  const y3 = at(i + 2);
  const c1 = 0.5 * (y2 - y0);
  const c2 = y0 - 2.5 * y1 + 2 * y2 - 0.5 * y3;
  const c3 = 0.5 * (y3 - y0) + 1.5 * (y1 - y2);
  return ((c3 * f + c2) * f + c1) * f + y1;
}

function besselI0(x) {
  const q = (x * x) / 4;
  return 1 + q + (q * q) / 4 + (q * q * q) / 36;
}

export function fmSynth({ sr, n, rng }) {
  const { filter } = filters({ sr });
  let calls = 0;
  const nyq = sr / 2;

  const indexCap = (f, fm) => (fm > 0 ? Math.max(0, (nyq - f) / fm - 2) : 0);

  function fm(dur, carrier, { ratio = 1, index = 1, feedback = 0, type = 'sine', ops = [] } = {}) {
    if (type !== 'sine' && type !== 'tri') throw new Error(`Unknown fm carrier: ${type}`);
    const out = new Float32Array(n(dur));
    const stack = [{ ratio, index }, ...ops];
    const top = stack.length - 1;
    const phase = new Float64Array(stack.length);
    let pc = 0;
    let fb1 = 0;
    let fb2 = 0;
    for (let i = 0; i < out.length; i++) {
      const fc = valueAt(carrier, i);
      let mod = 0;
      for (let j = top; j >= 0; j--) {
        const fj = fc * valueAt(stack[j].ratio, i);
        const below = j === 0 ? fc : fc * valueAt(stack[j - 1].ratio, i);
        let x = TAU * phase[j] + mod;
        if (j === top && feedback > 0) {
          x += feedback * Math.min(1, sr / (16 * fj)) * Math.PI * 0.5 * (fb1 + fb2);
        }
        const y = Math.sin(x);
        if (j === top) {
          fb2 = fb1;
          fb1 = y;
        }
        mod = Math.min(valueAt(stack[j].index, i), indexCap(below, fj)) * y;
        phase[j] += fj / sr;
        phase[j] -= Math.floor(phase[j]);
      }
      const t = pc + mod / TAU;
      const u = t - Math.floor(t);
      out[i] = type === 'sine' ? Math.sin(TAU * u) : u < 0.25 ? 4 * u : u < 0.75 ? 2 - 4 * u : 4 * u - 4;
      pc += fc / sr;
      pc -= Math.floor(pc);
    }
    return out;
  }

  function varispeed(sig, rateAt) {
    const out = new Float32Array(sig.length);
    let off = 0;
    for (let i = 0; i < sig.length; i++) {
      out[i] = readAt(sig, i + off);
      off += rateAt(i) - 1;
    }
    return out;
  }

  return {
    fm,

    ring(sig, freq, mix = 1) {
      const out = new Float32Array(sig.length);
      let ph = 0;
      for (let i = 0; i < sig.length; i++) {
        out[i] = sig[i] * (1 - mix + mix * Math.sin(TAU * ph));
        ph += valueAt(freq, i) / sr;
        ph -= Math.floor(ph);
      }
      return out;
    },

    am(sig, rate, depth = 1) {
      const out = new Float32Array(sig.length);
      let ph = 0;
      for (let i = 0; i < sig.length; i++) {
        out[i] = sig[i] * (1 - valueAt(depth, i) * (0.5 - 0.5 * Math.cos(TAU * ph)));
        ph += valueAt(rate, i) / sr;
        ph -= Math.floor(ph);
      }
      return out;
    },

    tremolo(sig, rate, depth = 0.5, shape = 'sine') {
      const { lfo } = curves({ sr, n, rng: rng.fork(`tremolo${calls++}`) });
      const w = lfo(sig.length / sr, rate, 1, shape, 0.25);
      const a = Math.exp(-1 / (0.002 * sr));
      const out = new Float32Array(sig.length);
      let g = 1;
      for (let i = 0; i < sig.length; i++) {
        const target = 1 - depth * (0.5 - 0.5 * w[i]);
        g = target + a * (g - target);
        out[i] = sig[i] * g;
      }
      return out;
    },

    vibrato(sig, rate, depthCents) {
      let ph = 0;
      return varispeed(sig, (i) => {
        const c = valueAt(depthCents, i);
        const r = 2 ** ((c * Math.sin(TAU * ph)) / 1200) / besselI0((c * Math.LN2) / 1200);
        ph += valueAt(rate, i) / sr;
        ph -= Math.floor(ph);
        return r;
      });
    },

    pitchEnv(sig, cents) {
      const rate = (p) => Math.min(16, Math.max(1 / 16, 2 ** (valueAt(cents, Math.floor(p)) / 1200)));
      let len = 0;
      let top = 0;
      for (let p = 0; p < sig.length; p += rate(p)) {
        top = Math.max(top, rate(p));
        len++;
      }
      let src = sig;
      if (top > 1) {
        const cut = Float32Array.from(sig, (_, i) => (0.45 * sr) / Math.max(1, rate(i)));
        src = filter(sig, 'lp', cut, Math.SQRT1_2, { slope: 24 });
      }
      const out = new Float32Array(len);
      let p = 0;
      for (let i = 0; i < len; i++) {
        out[i] = readAt(src, p);
        p += rate(p);
      }
      return out;
    },

    chorus(sig, { voices = 3, depthMs = 3, rate = 0.8, mix = 0.5 } = {}) {
      const vs = Array.from({ length: voices }, (_, v) => {
        const pan = voices === 1 ? 0 : -1 + (2 * v) / (voices - 1);
        const a = ((pan + 1) * Math.PI) / 4;
        return {
          base: (0.01 + 0.0027 * v) * sr,
          swing: (depthMs / 2000) * sr,
          rate: rate * (1 + 0.23 * v),
          phase: v / voices,
          l: Math.cos(a),
          r: Math.sin(a),
        };
      });
      const sumL = vs.reduce((s, v) => s + v.l, 0);
      const sumR = vs.reduce((s, v) => s + v.r, 0);
      const tail = Math.ceil(Math.max(...vs.map((v) => v.base + 2 * v.swing))) + 2;
      const L = new Float32Array(sig.length + tail);
      const R = new Float32Array(sig.length + tail);
      for (let i = 0; i < L.length; i++) {
        const dry = (sig[i] ?? 0) * (1 - mix);
        let wl = 0;
        let wr = 0;
        for (const v of vs) {
          const d = v.base + v.swing * (1 + Math.sin(TAU * (v.phase + (v.rate * i) / sr)));
          const x = readAt(sig, i - d);
          wl += x * v.l;
          wr += x * v.r;
        }
        L[i] = dry + (mix * wl) / sumL;
        R[i] = dry + (mix * wr) / sumR;
      }
      return [L, R];
    },

    crush(sig, bits = 8, downsample = 1) {
      const out = new Float32Array(sig.length);
      const hold = Math.max(1, downsample);
      let held = 0;
      let count = hold;
      for (let i = 0; i < sig.length; i++) {
        if (count >= hold) {
          count -= hold;
          const steps = 2 ** (Math.max(1, valueAt(bits, i)) - 1);
          held = Math.round(sig[i] * steps) / steps;
        }
        out[i] = held;
        count++;
      }
      return out;
    },
  };
}
