import { INSTRUMENTS, MAX_PARTS, partType, fitPitchedInstrument } from './song-instruments.js';
import { validEffects } from './song-effects.js';

export function validUserPreset(preset) {
  if (!preset || typeof preset !== 'object' || Array.isArray(preset)) return false;
  if (Object.keys(preset).some(key => !['name', 'parts'].includes(key))) return false;
  if (typeof preset.name !== 'string' || !preset.name.trim() || preset.name.length > 80) return false;
  if (!Array.isArray(preset.parts) || preset.parts.length > MAX_PARTS) return false;
  return preset.parts.every(p => {
    if (!p || typeof p !== 'object' || Array.isArray(p)) return false;
    if (Object.keys(p).some(key => !['part', 'instrument', 'effects', 'octaves'].includes(key))) return false;
    if (!Object.hasOwn(INSTRUMENTS, p.instrument) || INSTRUMENTS[p.instrument].part !== p.part) return false;
    if (p.effects !== undefined && !validEffects(p.effects)) return false;
    return p.octaves === undefined || p.part !== 'drums' && Number.isInteger(p.octaves) && Math.abs(p.octaves) <= 10;
  });
}

export function captureSoundPreset(song, name) {
  const preset = { name: name.trim(), parts: song.tracks.map(t => {
    const part = { part: partType(t), instrument: t.instrument };
    if (t.effects !== undefined) part.effects = structuredClone(t.effects);
    if (t.octaves !== undefined) part.octaves = t.octaves;
    return part;
  }) };
  if (!validUserPreset(preset)) throw new Error('Invalid sound preset');
  return preset;
}

export function applyUserPreset(song, preset, options = {}) {
  if (!validUserPreset(preset)) throw new Error('Invalid sound preset');
  const used = {};
  const next = structuredClone(song);
  delete next.soundPreset;
  next.tracks = next.tracks.map(source => {
    const role = partType(source), index = used[role] ?? 0;
    used[role] = index + 1;
    const saved = preset.parts.filter(p => p.part === role)[index];
    if (!saved) return source;
    const lock = options.locks?.[source.id] ?? {};
    let track = source;
    if (!lock.mix) {
      track = { ...track };
      if (saved.effects === undefined) delete track.effects;
      else track.effects = structuredClone(saved.effects);
    }
    const instrument = lock.instrument ? source.instrument : saved.instrument;
    if (lock.notes) {
      const range = INSTRUMENTS[instrument].range ?? [0, 127];
      return track.notes.every(n => n.midi >= range[0] && n.midi <= range[1]) ? { ...track, instrument } : track;
    }
    if (role === 'drums') return { ...track, instrument };
    const offset = (saved.octaves ?? 0) - (source.octaves ?? 0);
    const notes = source.notes.map(n => ({ ...n, midi: n.midi + offset * 12 }));
    if (notes.some(n => n.midi < 0 || n.midi > 127)) return track;
    track = { ...track, notes, octaves: saved.octaves ?? 0 };
    const range = INSTRUMENTS[instrument].range ?? [0, 127];
    const fits = Array.from({ length: 21 }, (_, i) => i - 10).some(shift =>
      Math.abs(track.octaves + shift) <= 10 && notes.every(n => n.midi + shift * 12 >= range[0] && n.midi + shift * 12 <= range[1]));
    if (!fits) return { ...source, ...(lock.mix ? {} : { effects: track.effects }) };
    const fitted = fitPitchedInstrument({ ...next, tracks: [track] }, track.id, instrument).song.tracks[0];
    if (Math.abs(fitted.octaves ?? 0) > 10) return source;
    return fitted;
  });
  return next;
}
