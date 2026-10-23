function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hash(str) {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

export function createRng(seed) {
  seed >>>= 0;
  const next = mulberry32(seed);

  return {
    seed,
    next,
    range: (a, b) => a + (b - a) * next(),
    logRange: (a, b) => a * (b / a) ** next(),
    int: (a, b) => a + Math.floor(next() * (b - a + 1)),
    pick: (arr) => arr[Math.floor(next() * arr.length)],
    chance: (p) => next() < p,

    weighted(weights) {
      const keys = Object.keys(weights);
      let r = next() * keys.reduce((sum, k) => sum + weights[k], 0);
      for (const k of keys) {
        r -= weights[k];
        if (r < 0) return k;
      }
      return keys[keys.length - 1];
    },

    gauss(mu = 0, sigma = 1) {
      const u = 1 - next();
      return mu + sigma * Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * next());
    },

    fork: (name) => createRng(hash(`${seed}/${name}`)),
  };
}
