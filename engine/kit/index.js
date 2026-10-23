import { createRng } from '../rng.js';
import { curves } from './curve.js';
import { envelopes } from './env.js';
import { filters } from './filter.js';
import { fmSynth } from './fm.js';
import { music } from './music.js';
import { mixing } from './mix.js';
import { noises } from './noise.js';
import { oscillators } from './osc.js';
import { plucks } from './pluck.js';

export function createKit({ sampleRate = 44100, seed = 1 } = {}) {
  const sr = sampleRate;
  const rng = createRng(seed);
  const n = (sec) => Math.max(0, Math.round(sec * sr));

  const k = {
    sr,
    rng,
    n,
    buf: (sec) => new Float32Array(n(sec)),
    env: envelopes({ sr, n }),
    curve: curves({ sr, n, rng: rng.fork('curve') }),
    noise: noises({ sr, n, rng: rng.fork('noise') }),
    ...oscillators({ sr, n, rng: rng.fork('osc') }),
    ...filters({ sr }),
    ...mixing({ sr, n }),
    ...fmSynth({ sr, n, rng: rng.fork('fm') }),
    ...plucks({ sr, n, rng: rng.fork('pluck') }),
    ...music({ n }),
  };
  return k;
}
