export const valueAt = (c, i) => (typeof c === 'number' ? c : c[Math.min(i, c.length - 1)]);

const EXP = 6.9;
const EXP_END = 1 - Math.exp(-EXP);

export function shapeAt(x, shape) {
  if (shape === 'exp') return (1 - Math.exp(-EXP * x)) / EXP_END;
  if (shape === 'smooth') return x * x * (3 - 2 * x);
  return x;
}

export const decayAt = (time, decay) => Math.exp((-EXP * time) / decay);
