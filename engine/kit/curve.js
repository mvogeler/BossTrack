import { shapeAt, valueAt } from './util.js';

function wave(shape, f, a, b) {
  switch (shape) {
    case 'sine':
      return Math.sin(2 * Math.PI * f);
    case 'tri':
      return f < 0.25 ? 4 * f : f < 0.75 ? 2 - 4 * f : 4 * f - 4;
    case 'square':
      return f < 0.5 ? 1 : -1;
    case 'saw':
      return 2 * f - 1;
    case 'sh':
      return a;
    case 'smooth':
      return a + (b - a) * (0.5 - 0.5 * Math.cos(Math.PI * f));
    default:
      throw new Error(`Unknown LFO shape: ${shape}`);
  }
}

export function curves({ sr, n, rng }) {
  function lfo(dur, rate, depth = 1, shape = 'sine', phase = 0, { dropout = 0 } = {}) {
    const out = new Float32Array(n(dur));
    const draw = () => {
      const v = rng.range(-1, 1);
      return dropout > 0 && rng.chance(dropout) ? null : v;
    };
    let ph = phase;
    let cycle = Math.floor(ph);
    let a = draw();
    let b = draw();
    for (let i = 0; i < out.length; i++) {
      if (Math.floor(ph) !== cycle) {
        cycle = Math.floor(ph);
        a = b;
        b = draw();
      }
      const f = ph - cycle;
      if (a === null && shape !== 'smooth') out[i] = 0;
      else out[i] = depth * wave(shape, f, a ?? 0, b ?? 0);
      ph += valueAt(rate, i) / sr;
    }
    return out;
  }

  return {
    lfo,

    sweep(dur, from, to, shape = 'exp') {
      const out = new Float32Array(n(dur));
      const last = Math.max(1, out.length - 1);
      for (let i = 0; i < out.length; i++) {
        const x = i / last;
        out[i] = shape === 'exp' ? from * (to / from) ** x : from + (to - from) * shapeAt(x, shape);
      }
      return out;
    },

    jitter: (dur, rate, amount) => lfo(dur, rate, amount, 'smooth'),
  };
}
