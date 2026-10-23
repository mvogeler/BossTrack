import { rerollPart } from './song-compose.js';
import { INSTRUMENTS, partType, fitPitchedInstrument, swapInstrument } from './song-instruments.js';
import { createRng } from './rng.js';
import { instrumentReady, instrumentPool } from './song-defaults.js';

function fits(track, instrument, exact, available) {
  const voice = INSTRUMENTS[instrument];
  if (!voice || voice.part !== partType(track) || !instrumentReady(instrument, available)) return false;
  const range = voice.range ?? [0, 127];
  const offsets = exact || partType(track) === 'drums' ? [0] : Array.from({ length: 21 }, (_, i) => i - 10);
  return !exact && voice.foldRange || offsets.some(offset => Math.abs((track.octaves ?? 0) + offset) <= 10 &&
    track.notes.every(n => n.midi + offset * 12 >= range[0] && n.midi + offset * 12 <= range[1]));
}

export function instrumentChoices(song, track, options = {}) {
  const exact = !!options.locks?.[track.id]?.notes;
  const favorites = [...new Set(options.favorites ?? [])].filter(id => fits(track, id, exact, options.available));
  const pool = instrumentPool(song.genre ?? 'original', partType(track), options);
  const candidates = [...new Set([track.instrument, ...pool])].filter(id => fits(track, id, exact, options.available));
  return { instruments: options.favoritesOnly && favorites.length ? favorites : candidates,
    favoritesFallback: !!options.favoritesOnly && !favorites.length };
}

export function selectPartInstrument(song, track, options = {}) {
  if (!options.varyInstruments && fits(track, track.instrument, !!options.locks?.[track.id]?.notes, options.available)) return track;
  const { instruments } = instrumentChoices(song, track, options);
  if (!instruments.length) throw new Error('No instrument can play the locked notes in ' + track.id);
  const instrument = createRng(song.seed).fork('instrument:' + track.id).pick(instruments);
  const next = { ...song, tracks: [track] };
  const fitted = options.locks?.[track.id]?.notes || partType(track) === 'drums'
    ? swapInstrument(next, track.id, instrument) : fitPitchedInstrument(next, track.id, instrument).song;
  return fitted.tracks[0];
}

export function generateChoices(next, previous, options = {}) {
  const tracks = next.tracks.map(fresh => {
    const old = previous?.tracks.find(t => t.id === fresh.id);
    const lock = options.locks?.[fresh.id] ?? {};
    let track = { ...fresh, notes: fresh.notes.map(n => ({ ...n })) };
    if (old?.playing !== undefined) track.playing = old.playing;
    if (old?.effects !== undefined) track.effects = structuredClone(old.effects);
    if (old && lock.notes) {
      if (previous.ppq !== next.ppq || old.notes.some(n => n.tick + n.len > next.bars * 4 * next.ppq)) {
        throw new Error('Locked notes in ' + fresh.id + ' exceed the new duration. Unlock notes or keep a longer duration.');
      }
      const extended = ['returning-v1', 'developed-v1', 'composed-v1'].includes(next.arrangement);
      if (old.notes.length > (extended ? 16384 : 512) || extended && old.notes.some(n => n.len > 16 * next.ppq)) {
        throw new Error('Locked notes in ' + fresh.id + ' exceed the note length or count limit for this arrangement. Unlock notes or keep the previous arrangement.');
      }
      if (old.notes.some(n => n.articulation !== undefined) && next.performance !== 'instrument-v1' && !['genre-v1', 'electronic-v9'].includes(next.generator)) {
        throw new Error('Locked notes in ' + fresh.id + ' use short chord articulations. Unlock notes or keep a genre or chord pattern that supports them.');
      }
      track.notes = old.notes.map(n => ({ ...n }));
      track.seed = old.seed;
      if (old.role !== undefined) track.role = old.role;
      else delete track.role;
      if (old.octaves !== undefined) track.octaves = old.octaves;
      else delete track.octaves;
    } else if (old && partType(track) !== 'drums') {
      const offset = (old.octaves ?? 0) - (track.octaves ?? 0);
      if (track.notes.every(n => n.midi + offset * 12 >= 0 && n.midi + offset * 12 <= 127)) {
        track.notes = track.notes.map(n => ({ ...n, midi: n.midi + offset * 12 }));
        if (old.octaves !== undefined) track.octaves = old.octaves;
        else delete track.octaves;
      }
    }
    if (old && lock.instrument && instrumentReady(old.instrument, options.available)) {
      if (!fits(track, old.instrument, !!lock.notes)) throw new Error(INSTRUMENTS[old.instrument].name + ' cannot play this part within the octave range');
      const song = { ...next, tracks: [track] };
      return lock.notes || partType(track) === 'drums' ? swapInstrument(song, track.id, old.instrument).tracks[0]
        : fitPitchedInstrument(song, track.id, old.instrument).song.tracks[0];
    }
    if (options.varyInstruments || lock.notes && !fits(track, track.instrument, true)) return selectPartInstrument(next, track, options);
    const song = { ...next, tracks: [track] };
    return lock.notes || partType(track) === 'drums' ? swapInstrument(song, track.id, track.instrument).tracks[0]
      : fitPitchedInstrument(song, track.id, track.instrument).song.tracks[0];
  });
  let chosen = { ...next, tracks };
  if (next.performance === 'instrument-v1') for (const track of tracks) {
    if (!options.locks?.[track.id]?.notes && track.instrument !== next.tracks.find(t => t.id === track.id).instrument) chosen = rerollPart(chosen, track.id, track.seed);
  }
  return chosen;
}
