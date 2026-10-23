import { GENRES } from './song-genres.js';
import { INSTRUMENTS, PARTS, partType, swapInstrument, fitPitchedInstrument } from './song-instruments.js';
import { INSTRUMENT_POOLS } from './song-instrument-pools.js';
import { validEffects } from './song-effects.js';

export const instrumentBank = id => INSTRUMENTS[id]?.sample ? INSTRUMENTS[id].cache : null;

export const instrumentReady = (id, available) => !instrumentBank(id) || !available || available.has(instrumentBank(id));

function defaultLevels(genre, part, options) {
  const built = GENRES[genre] ?? {}, own = options.genreDefaults?.[genre];
  const levels = [];
  if (own?.instruments?.[part]) levels.push({ instrument: own.instruments[part], effects: own.effects ? own.effects[part] : built.effects?.[part] });
  if (built.instruments?.[part]) levels.push({ instrument: built.instruments[part], effects: built.effects?.[part] });
  levels.push({ instrument: part });
  return levels.filter(l => INSTRUMENTS[l.instrument]?.part === part && instrumentReady(l.instrument, options.available));
}

export const mergeGenreDefaults = (personal = {}, saved = {}) => ({ ...personal, ...saved });

export function genreDefault(genre, part, options = {}) {
  return defaultLevels(genre, part, options)[0];
}

export const instrumentPool = (genre, part, options = {}) => options.pools?.[genre]?.[part] ?? INSTRUMENT_POOLS[genre][part];

export function cueInstrument(genre, id, options = {}) {
  const own = options.cues?.[genre]?.[id];
  return own && INSTRUMENTS[own]?.part === INSTRUMENTS[id].part && instrumentReady(own, options.available) ? own : id;
}

export function personalOptions(file = {}) {
  const fits = (id, part) => INSTRUMENTS[id]?.part === part;
  const genreDefaults = Object.fromEntries(Object.entries(file.genres ?? {}).filter(([genre, entry]) => Object.hasOwn(GENRES, genre) && validGenreDefault(entry)));
  const pools = Object.fromEntries(Object.entries(file.pools ?? {}).filter(([genre]) => Object.hasOwn(INSTRUMENT_POOLS, genre)).map(([genre, parts]) =>
    [genre, Object.fromEntries(Object.entries(parts).filter(([part, ids]) => PARTS.includes(part) && Array.isArray(ids) && ids.length && ids.every(id => fits(id, part))))]));
  const cues = Object.fromEntries(Object.entries(file.cues ?? {}).filter(([genre]) => GENRES[genre]?.composed).map(([genre, swaps]) =>
    [genre, Object.fromEntries(Object.entries(swaps).filter(([id, own]) => INSTRUMENTS[id] && fits(own, INSTRUMENTS[id].part)))]));
  return { genreDefaults, pools, cues };
}

export function installedSong(song, options = {}) {
  const swapped = [];
  let next = song;
  for (const track of song.tracks) {
    if (instrumentReady(track.instrument, options.available)) continue;
    const part = partType(track);
    for (const { instrument } of defaultLevels(song.genre ?? 'original', part, options)) {
      try {
        next = part === 'drums' ? swapInstrument(next, track.id, instrument) : fitPitchedInstrument(next, track.id, instrument).song;
      } catch { continue; }
      swapped.push({ id: track.id, from: track.instrument, to: instrument });
      break;
    }
  }
  return { song: next, swapped };
}

export function validGenreDefault(entry) {
  if (!entry || typeof entry !== 'object' || Array.isArray(entry)) return false;
  if (Object.keys(entry).some(key => !['instruments', 'effects'].includes(key))) return false;
  const { instruments, effects } = entry;
  if (!instruments || typeof instruments !== 'object' || Array.isArray(instruments)) return false;
  if (!Object.entries(instruments).every(([part, id]) => PARTS.includes(part) && INSTRUMENTS[id]?.part === part)) return false;
  if (effects === undefined) return true;
  if (!effects || typeof effects !== 'object' || Array.isArray(effects)) return false;
  return Object.entries(effects).every(([part, value]) => PARTS.includes(part) && validEffects(value));
}

export function captureGenreDefault(song) {
  const entry = { instruments: {}, effects: {} };
  for (const part of PARTS) {
    const track = song.tracks.find(t => t.id === part);
    if (!track) continue;
    entry.instruments[part] = track.instrument;
    if (track.effects !== undefined) entry.effects[part] = structuredClone(track.effects);
  }
  if (!validGenreDefault(entry)) throw new Error('Invalid genre default');
  return entry;
}
