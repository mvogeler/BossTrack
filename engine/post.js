export function peak(channels) {
  let p = 0;
  for (const ch of channels) for (const v of ch) p = Math.max(p, Math.abs(v));
  return p;
}
