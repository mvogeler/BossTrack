import { valueAt } from './util.js';

function coeffs(type, w0, q, gain) {
  const cs = Math.cos(w0);
  const alpha = Math.sin(w0) / (2 * q);
  const A = 10 ** (gain / 40);
  const sq = 2 * Math.sqrt(A) * alpha;
  let c;
  switch (type) {
    case 'lp':
      c = [(1 - cs) / 2, 1 - cs, (1 - cs) / 2, 1 + alpha, -2 * cs, 1 - alpha];
      break;
    case 'hp':
      c = [(1 + cs) / 2, -(1 + cs), (1 + cs) / 2, 1 + alpha, -2 * cs, 1 - alpha];
      break;
    case 'bp':
      c = [alpha, 0, -alpha, 1 + alpha, -2 * cs, 1 - alpha];
      break;
    case 'notch':
      c = [1, -2 * cs, 1, 1 + alpha, -2 * cs, 1 - alpha];
      break;
    case 'peak':
      c = [1 + alpha * A, -2 * cs, 1 - alpha * A, 1 + alpha / A, -2 * cs, 1 - alpha / A];
      break;
    case 'lowshelf':
      c = [
        A * (A + 1 - (A - 1) * cs + sq), 2 * A * (A - 1 - (A + 1) * cs), A * (A + 1 - (A - 1) * cs - sq),
        A + 1 + (A - 1) * cs + sq, -2 * (A - 1 + (A + 1) * cs), A + 1 + (A - 1) * cs - sq,
      ];
      break;
    case 'highshelf':
      c = [
        A * (A + 1 + (A - 1) * cs + sq), -2 * A * (A - 1 + (A + 1) * cs), A * (A + 1 + (A - 1) * cs - sq),
        A + 1 - (A - 1) * cs + sq, 2 * (A - 1 - (A + 1) * cs), A + 1 - (A - 1) * cs - sq,
      ];
      break;
    default:
      throw new Error(`Unknown filter type: ${type}`);
  }
  return c.map((x) => x / c[3]);
}

const BUTTER4 = [0.5412, 1.3066];

export function filters({ sr }) {
  const clampHz = (f) => Math.min(Math.max(f, 10), sr * 0.49);

  function stage(sig, type, freq, q, gain) {
    const out = new Float32Array(sig.length);
    let x1 = 0, x2 = 0, y1 = 0, y2 = 0;
    let lastF = NaN;
    let b0, b1, b2, a1, a2;
    for (let i = 0; i < sig.length; i++) {
      const f = clampHz(valueAt(freq, i));
      if (f !== lastF) {
        [b0, b1, b2, , a1, a2] = coeffs(type, (2 * Math.PI * f) / sr, q, gain);
        lastF = f;
      }
      const x = sig[i];
      const y = b0 * x + b1 * x1 + b2 * x2 - a1 * y1 - a2 * y2;
      x2 = x1;
      x1 = x;
      y2 = y1;
      y1 = y;
      out[i] = y;
    }
    return out;
  }

  return {
    filter(sig, type, freq, q = Math.SQRT1_2, { slope = 12, gain = 0 } = {}) {
      if (slope === 12) return stage(sig, type, freq, q, gain);
      if (slope !== 24 || !['lp', 'hp', 'bp'].includes(type)) throw new Error(`No ${slope} dB ${type} filter`);
      const [qa, qb] = type === 'bp' ? [q, q] : [BUTTER4[0], BUTTER4[1] * q * Math.SQRT2];
      return stage(stage(sig, type, freq, qa, gain), type, freq, qb, gain);
    },

    svf(sig, freq, res = 0.3, mode = 'lp') {
      if (!['lp', 'bp', 'hp', 'notch'].includes(mode)) throw new Error(`Unknown svf mode: ${mode}`);
      const out = new Float32Array(sig.length);
      const k = 2 - 2 * Math.min(res, 0.99);
      let ic1 = 0, ic2 = 0;
      for (let i = 0; i < sig.length; i++) {
        const g = Math.tan((Math.PI * clampHz(valueAt(freq, i))) / sr);
        const a1 = 1 / (1 + g * (g + k));
        const a2 = g * a1;
        const v0 = sig[i];
        const v3 = v0 - ic2;
        const v1 = a1 * ic1 + a2 * v3;
        const v2 = ic2 + a2 * ic1 + g * a2 * v3;
        ic1 = 2 * v1 - ic1;
        ic2 = 2 * v2 - ic2;
        out[i] = mode === 'lp' ? v2 : mode === 'bp' ? v1 : mode === 'hp' ? v0 - k * v1 - v2 : v0 - k * v1;
      }
      return out;
    },
  };
}
