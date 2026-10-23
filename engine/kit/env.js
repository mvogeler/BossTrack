import { decayAt, shapeAt } from './util.js';

export function envelopes({ sr, n }) {
  const fill = (dur, fn) => {
    const out = new Float32Array(n(dur));
    for (let i = 0; i < out.length; i++) out[i] = fn(i / sr);
    return out;
  };

  return {
    perc: (dur, attack, decay) =>
      fill(dur, (t) => (t < attack ? t / attack : decayAt(t - attack, decay))),

    adsr(dur, attack, decay, sustain, release) {
      const hold = (t) => {
        if (t < attack) return t / attack;
        const x = Math.min(1, (t - attack) / decay);
        return 1 + (sustain - 1) * shapeAt(x, 'exp');
      };
      const relAt = Math.max(0, dur - release);
      const relFrom = hold(relAt);
      return fill(dur, (t) => {
        if (t < relAt) return hold(t);
        return relFrom * (1 - shapeAt(Math.min(1, (t - relAt) / release), 'exp'));
      });
    },

    points(dur, pts, shape = 'lin') {
      let j = 0;
      return fill(dur, (t) => {
        if (t <= pts[0][0]) return pts[0][1];
        while (j < pts.length - 2 && t >= pts[j + 1][0]) j++;
        const [t0, v0] = pts[j];
        const [t1, v1] = pts[j + 1];
        if (t >= t1) return v1;
        return v0 + (v1 - v0) * shapeAt((t - t0) / (t1 - t0), shape);
      });
    },
  };
}
