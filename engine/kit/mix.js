import { valueAt } from './util.js';

const dbToGain = (db) => 10 ** (db / 20);

export function mixing({ sr, n }) {
  function stereo(sig, pan = 0) {
    const l = new Float32Array(sig.length);
    const r = new Float32Array(sig.length);
    for (let i = 0; i < sig.length; i++) {
      const a = ((valueAt(pan, i) + 1) * Math.PI) / 4;
      l[i] = sig[i] * Math.cos(a);
      r[i] = sig[i] * Math.sin(a);
    }
    return [l, r];
  }

  return {
    stereo,
    gain: (sig, db) => sig.map((v) => v * dbToGain(db)),
    mul: (sig, by) => sig.map((v, i) => v * valueAt(by, i)),

    add(...sigs) {
      const out = new Float32Array(Math.max(...sigs.map((s) => s.length)));
      for (const s of sigs) for (let i = 0; i < s.length; i++) out[i] += s[i];
      return out;
    },

    fadeOut(sig, sec) {
      const out = sig.slice();
      const len = Math.min(out.length, n(sec));
      for (let i = 0; i < len; i++) out[out.length - 1 - i] *= i / len;
      return out;
    },

    mix(layers) {
      const placed = layers.map(([sig, db = 0, offset = 0, pan = 0]) => {
        const at = n(offset);
        const g = dbToGain(db);
        let [l, r] = Array.isArray(sig) ? sig : stereo(sig, pan);
        if (Array.isArray(sig) && pan !== 0) {
          const [bl, br] = stereo(new Float32Array(l.length).fill(Math.SQRT2), pan);
          l = l.map((v, i) => v * bl[i]);
          r = r.map((v, i) => v * br[i]);
        }
        return { l, r, at, g };
      });
      const len = Math.max(0, ...placed.map((p) => p.at + p.l.length));
      const L = new Float32Array(len);
      const R = new Float32Array(len);
      for (const { l, r, at, g } of placed) {
        for (let i = 0; i < l.length; i++) {
          L[at + i] += l[i] * g;
          R[at + i] += r[i] * g;
        }
      }
      return [L, R];
    },
  };
}
