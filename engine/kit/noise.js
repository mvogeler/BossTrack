export function noises({ sr, n, rng }) {
  let calls = 0;

  return function noise(dur, color = 'white', { density = 40 } = {}) {
    const r = rng.fork(`noise${calls++}`);
    const out = new Float32Array(n(dur));
    const white = () => r.range(-1, 1);

    if (color === 'white') {
      for (let i = 0; i < out.length; i++) out[i] = white();
    } else if (color === 'pink' || color === 'blue') {
      let b0 = 0;
      let b1 = 0;
      let b2 = 0;
      for (let i = 0; i < out.length; i++) {
        const w = white();
        b0 = 0.99765 * b0 + w * 0.099046;
        b1 = 0.963 * b1 + w * 0.2965164;
        b2 = 0.57 * b2 + w * 1.0526913;
        out[i] = (b0 + b1 + b2 + w * 0.1848) * 0.25;
      }
      if (color === 'blue') {
        for (let i = out.length - 1; i > 0; i--) out[i] = (out[i] - out[i - 1]) * 1.5;
        out[0] = 0;
      }
    } else if (color === 'brown') {
      let y = 0;
      for (let i = 0; i < out.length; i++) {
        y = (y + 0.02 * white()) / 1.02;
        out[i] = y * 3.5;
      }
    } else if (color === 'crackle') {
      const p = density / sr;
      for (let i = 0; i < out.length; i++) out[i] = r.next() < p ? white() : 0;
    } else {
      throw new Error(`Unknown noise color: ${color}`);
    }
    return out;
  };
}
