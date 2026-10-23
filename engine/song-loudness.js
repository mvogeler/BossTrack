function stage([b0, b1, b2, a1, a2]) {
  let x1 = 0, x2 = 0, y1 = 0, y2 = 0;
  return x => {
    const y = b0 * x + b1 * x1 + b2 * x2 - a1 * y1 - a2 * y2;
    x2 = x1; x1 = x; y2 = y1; y1 = y;
    return y;
  };
}

function weighting(sr) {
  let k = Math.tan(Math.PI * 1681.974450955533 / sr);
  let q = 0.7071752369554196;
  const vh = 10 ** (3.999843853973347 / 20);
  const vb = vh ** 0.4996667741545416;
  let a = 1 + k / q + k * k;
  const shelf = stage([(vh + vb * k / q + k * k) / a, 2 * (k * k - vh) / a,
    (vh - vb * k / q + k * k) / a, 2 * (k * k - 1) / a, (1 - k / q + k * k) / a]);
  k = Math.tan(Math.PI * 38.13547087602444 / sr);
  q = 0.5003270373238773;
  a = 1 + k / q + k * k;
  const hp = stage([1, -2, 1, 2 * (k * k - 1) / a, (1 - k / q + k * k) / a]);
  return x => hp(shelf(x));
}

const level = energy => energy > 0 ? -0.691 + 10 * Math.log10(energy) : -Infinity;

export function integratedLoudness(channels, sr) {
  if (![1, 2].includes(channels.length) || !Number.isFinite(sr) || sr < 8000 ||
      channels.some(ch => ch.length !== channels[0].length)) throw new Error('Expected aligned mono or stereo audio');
  const meter = createLoudnessMeter(channels.length, sr);
  meter.push(channels);
  return meter.read().lufs;
}

export function createLoudnessMeter(count, sr) {
  if (![1, 2].includes(count) || !Number.isFinite(sr) || sr < 8000) throw new Error('Expected mono or stereo audio');
  const win = Math.round(sr * 0.4);
  const hop = Math.round(sr * 0.1);
  const ring = new Float64Array(win);
  const filters = Array.from({ length: count }, () => weighting(sr));
  const blocks = [];
  let sum = 0, frame = 0, peak = 0;
  function push(channels) {
    if (channels.length !== count || channels.some(ch => ch.length !== channels[0].length)) throw new Error('Expected aligned audio blocks');
    for (let i = 0; i < channels[0].length; i++) {
      let energy = 0;
      for (let c = 0; c < count; c++) {
        peak = Math.max(peak, Math.abs(channels[c][i]));
        const y = filters[c](channels[c][i]);
        energy += y * y;
      }
      const at = frame % win;
      sum += energy - ring[at];
      ring[at] = energy;
      frame++;
      if (frame >= win && (frame - win) % hop === 0) blocks.push(Math.max(0, sum / win));
    }
  }
  function read() {
    const absolute = blocks.filter(energy => level(energy) > -70);
    if (!absolute.length) return { lufs: -Infinity, peak };
    const mean = values => values.reduce((total, value) => total + value, 0) / values.length;
    const gate = level(mean(absolute)) - 10;
    return { lufs: level(mean(absolute.filter(energy => level(energy) > gate))), peak };
  }
  return { push, read };
}

export function loudnessGain(lufs, peak, target = -16, ceiling = -1) {
  if (!Number.isFinite(target) || !Number.isFinite(ceiling) || ceiling > 0 || !Number.isFinite(peak) || peak < 0)
    throw new Error('Invalid loudness target or peak');
  if (lufs === -Infinity || peak === 0) return 1;
  if (!Number.isFinite(lufs)) throw new Error('Invalid loudness reading');
  return Math.min(10 ** ((target - lufs) / 20), 10 ** (ceiling / 20) / peak);
}
