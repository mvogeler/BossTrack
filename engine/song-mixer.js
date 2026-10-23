import { MAX_PARTS, PARTS, partType } from './song-instruments.js';

export const MIX_CEILING = 10 ** (-1 / 20);
export const mixPeakGain = peak => peak > MIX_CEILING ? MIX_CEILING / peak : 1;

export function panLevels(pan = 0) {
  return [pan > 0 ? Math.cos(pan * Math.PI / 2) : 1,
    pan < 0 ? Math.cos(pan * Math.PI / 2) : 1];
}

export function validMix(mix, ids) {
  const object = x => x !== null && typeof x === 'object' && !Array.isArray(x);
  return object(mix) && Array.isArray(mix.muted) && Array.isArray(mix.solo) &&
    mix.muted.length <= MAX_PARTS && mix.solo.length <= MAX_PARTS &&
    [...mix.muted, ...mix.solo].every(id => ids.includes(id)) && object(mix.gains) &&
    Object.entries(mix.gains).every(([id, n]) => ids.includes(id) && Number.isFinite(n) && n >= 0 && n <= 2) &&
    (mix.pans === undefined || object(mix.pans) && Object.entries(mix.pans).every(([id, n]) =>
      ids.includes(id) && Number.isFinite(n) && n >= -1 && n <= 1));
}

export function validMixPreset(preset) {
  return preset !== null && typeof preset === 'object' && !Array.isArray(preset) &&
    Object.keys(preset).every(key => ['name', 'parts'].includes(key)) &&
    typeof preset.name === 'string' && !!preset.name.trim() && preset.name.length <= 80 &&
    Array.isArray(preset.parts) && preset.parts.length <= MAX_PARTS && preset.parts.every(p =>
      p !== null && typeof p === 'object' && Object.keys(p).every(key => ['part', 'gain', 'pan'].includes(key)) &&
      PARTS.includes(p.part) && Number.isFinite(p.gain) && p.gain >= 0 && p.gain <= 2 &&
      Number.isFinite(p.pan) && p.pan >= -1 && p.pan <= 1);
}

export function captureMixPreset(song, mix, name) {
  const preset = { name: name.trim(), parts: song.tracks.map(t => ({ part: partType(t), gain: mix.gains[t.id] ?? 1, pan: mix.pans?.[t.id] ?? 0 })) };
  if (!validMixPreset(preset)) throw new Error('Invalid balance preset');
  return preset;
}

export function applyMixPreset(song, mix, preset, locks = {}) {
  if (!validMixPreset(preset)) throw new Error('Invalid balance preset');
  const next = { ...mix, gains: { ...mix.gains }, pans: { ...mix.pans } }, used = {};
  for (const track of song.tracks) {
    const part = partType(track), index = used[part] ?? 0;
    used[part] = index + 1;
    const saved = preset.parts.filter(p => p.part === part)[index];
    if (!saved || locks[track.id]?.mix) continue;
    next.gains[track.id] = saved.gain;
    next.pans[track.id] = saved.pan;
  }
  return next;
}
