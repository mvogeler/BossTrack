import { performTrack, PLAYING } from './song-playing.js';
import { INSTRUMENTS, PARTS, MAX_PARTS, partType, fitPitchedInstrument } from './song-instruments.js';
import { createSong, addNote } from './song.js';
import { createRng } from './rng.js';
import { scale, degree } from './kit/music.js';
import { fillMelody } from './song-melody.js';
import { fillRhythm, GROOVES } from './song-rhythm.js';
import { FEELINGS, shapeFeeling } from './song-feelings.js';
import { arrangePart, FORMS } from './song-form.js';
import { MELODIES } from './song-melodies.js';
import { PADS, fillPad } from './song-pad.js';
import { HARMONIES, chooseHarmony } from './song-harmony.js';
import { BASS } from './song-bass.js';
import { DRUMS } from './song-drums.js';
import { USES, arrangePromoPart, shapeUse } from './song-uses.js';
import { longLayout, arrangeLongPart } from './song-long.js';
import { GENRES, genrePart, developGenre } from './song-genres.js';
import { genreDefault } from './song-defaults.js';
import { composeDeveloped, KEY_ROLES } from './song-development.js';
import { composeCue, composeCuePart } from './song-cue.js';

const PATHS = [[0, 5, 3, 0], [0, 3, 4, 0], [0, 1, 4, 0], [0, 5, 4, 0]];
const ROOTS = [60, 62, 65, 67];
export const KEYS = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

function checkSeed(seed) {
  if (!Number.isInteger(seed) || seed < 0 || seed > 0xffffffff) throw new Error('Seed must be a whole number from 0 to 4294967295');
}


function voicing(chord, previous) {
  let best = null;
  let cost = Infinity;
  for (let inversion = 0; inversion < 3; inversion++) {
    const voiced = chord.slice(inversion).concat(chord.slice(0, inversion).map((n) => n + 12));
    for (const shift of [-12, 0]) {
      const notes = voiced.map((n) => n + shift);
      const move = notes.reduce((sum, n, i) => sum + Math.abs(n - previous[i]), 0);
      if (notes[0] >= 48 && notes[2] <= 79 && move < cost) { best = notes; cost = move; }
    }
  }
  return best;
}

function makeHarmony(rng, feel, family, key, selectedMode) {
  const pickedRoot = rng.pick(ROOTS);
  const pickedMode = family.mode ?? feel.mode ?? rng.pick(['major', 'minor']);
  const root = key === null ? pickedRoot : 60 + KEYS.indexOf(key);
  const mode = selectedMode ?? pickedMode;
  const notes = scale(root, mode);
  const steps = family.paths ? [...rng.fork('chord-path').pick(family.paths)] : feel.steps ? [...feel.steps] : rng.pick(PATHS);
  let previous = [root, degree(notes, 2), degree(notes, 4)];
  const chords = steps.map((step) => {
    const raw = [0, 2, 4].map((offset) => degree(notes, step + offset));
    previous = voicing(raw, previous);
    return { root: raw[0], notes: previous };
  });
  return { root, mode, scale: notes, steps, chords, name: KEYS[root % 12] + ' ' + mode };
}

function finishPart(song, track) {
  if (song.arrangement !== 'developed-v1') { shapeFeeling(song, track); shapeUse(song, track); }
  if (song._material) return track;
  const level = (FEELINGS[song.feeling ?? 'neutral'].levels?.[track.id] ?? 1) *
    (USES[song.use ?? 'sketch'].levels?.[track.id] ?? 1);
  if (song.arrangement !== 'developed-v1') arrangePart(song, track);
  if (song.arrangement === 'returning-v1') arrangeLongPart(song, track);
  if (song.arrangement !== 'developed-v1') developGenre(song, track);
  arrangePromoPart(song, track);
  const lowest = GENRES[song.genre ?? 'original'].lowest?.[track.id];
  for (const note of track.notes) {
    note.vel *= level;
    while (note.midi < lowest) note.midi += 12;
  }
  return track;
}

export function composePart(song, id, seed, instance = id, role = 'auto', options = {}) {
  if (song.arrangement === 'composed-v1') return composeCuePart(song, instance, seed, options);
  if (GENRES[song.genre ?? 'original'].silent?.includes(id) && song[id === 'keys' ? 'melody' : id] === 'auto') return { id, instrument: id, seed, notes: [] };
  if (song.arrangement === 'developed-v1') {
    return finishPart(song, composeDeveloped(song, id, seed, (local, nextSeed) => composePart(local, id, nextSeed), instance, role));
  }
  const track = { id, instrument: id, seed, notes: [] };
  if (genrePart(song, track)) return finishPart(song, track);
  if (id === 'keys') { fillMelody(song, track); return finishPart(song, track); }
  if (id === 'bass' || id === 'drums') { fillRhythm(song, track); return finishPart(song, track); }
  if (id === 'pad' && song.pad && song.pad !== 'original') { fillPad(song, track); return finishPart(song, track); }
  if (id !== 'pad') throw new Error('Unknown song part: ' + id);
  const rng = createRng(seed);
  const lift = rng.chance(0.5);
  song.harmony.chords.forEach((chord, bar) => {
    const notes = chord.notes.map((midi, i) => lift && i === 0 && midi < 67 ? midi + 12 : midi);
    notes.forEach((midi) => addNote(track, bar * 4, midi, rng.range(3.2, 3.8), rng.range(0.45, 0.6)));
  });
  return finishPart(song, track);
}

export function createProceduralSong(seed, feeling = 'neutral', use = 'sketch', form = 'sketch', melody = 'original', drums = 'original', bass = 'original', progression = 'original', pad = 'original', lengthSeconds = null, tempo = null, key = null, mode = null, genre = 'original', options = {}) {
  if (!Object.hasOwn(GENRES, genre)) throw new Error('Unknown genre: ' + genre);
  if (!Object.hasOwn(PADS, pad)) throw new Error('Unknown pad pattern: ' + pad);
  if (!Object.hasOwn(HARMONIES, progression)) throw new Error('Unknown harmony: ' + progression);
  if (!Object.hasOwn(BASS, bass)) throw new Error('Unknown bass pattern: ' + bass);
  if (!Object.hasOwn(DRUMS, drums)) throw new Error('Unknown drum pattern: ' + drums);
  if (!Object.hasOwn(MELODIES, melody)) throw new Error('Unknown melody: ' + melody);
  if (!Object.hasOwn(FORMS, form)) throw new Error('Unknown form: ' + form);
  if (!Object.hasOwn(USES, use)) throw new Error('Unknown use: ' + use);
  if (!Object.hasOwn(FEELINGS, feeling)) throw new Error('Unknown feeling: ' + feeling);
  if (key !== null && !KEYS.includes(key)) throw new Error('Unknown key: ' + key);
  if (mode !== null && !['major', 'minor'].includes(mode)) throw new Error('Unknown mode: ' + mode);
  const feel = FEELINGS[feeling];
  checkSeed(seed);
  if (GENRES[genre].composed) return composeCue(genre, use === 'menu' ? 'menu' : 'game', seed, { tempo, key }, options);
  const rng = createRng(seed);
  const purpose = USES[use];
  const theme = feel.paths ? feel : purpose.paths ? purpose : null;
  const harmonyFamily = ['auto', 'original'].includes(progression) && theme ? theme : progression === 'auto' && genre !== 'original' ? GENRES[genre] : chooseHarmony({ progression, feeling, use, seed });
  const song = { ...createSong({ tempo: tempo ?? (feel.paths ? feel.tempo : purpose.tempo) ?? GENRES[genre].tempo ?? feel.tempo }), seed, generator: use !== 'sketch' ? 'electronic-v3' : feeling === 'neutral' ? 'electronic-v1' : 'electronic-v2',
    ...(feeling === 'neutral' && use === 'sketch' ? {} : { feeling }), ...(use === 'sketch' ? {} : { use }), harmony: makeHarmony(rng.fork('harmony'), feel, harmonyFamily, key, mode),
    groove: (feel.paths ? feel.groove : null) ?? USES[use].groove ?? feel.groove ?? rng.fork('groove').pick(Object.keys(GROOVES)) };
  if (form !== 'sketch') Object.assign(song, { form, sectionAnswer: 'phrased', sectionDrums: 'contrast', sectionBass: 'response', sectionPad: 'entry', bars: form === 'song' ? 9 : 8, generator: 'electronic-v4', feeling, use });
  if (melody !== 'original') Object.assign(song, { melody, form, feeling, use, generator: 'electronic-v5' });
  if (drums !== 'original') Object.assign(song, { drums, melody, form, feeling, use, generator: 'electronic-v6' });
  if (bass !== 'original') Object.assign(song, { bass, drums, melody, form, feeling, use, generator: 'electronic-v7' });
  if (progression !== 'original') Object.assign(song, { progression, bass, drums, melody, form, feeling, use, generator: 'electronic-v8' });
  if (pad !== 'original') Object.assign(song, { pad, progression, bass, drums, melody, form, feeling, use, generator: 'electronic-v9' });
  if (genre !== 'original') Object.assign(song, { genre, pad, progression, bass, drums, melody, form, feeling, use, generator: 'genre-v1' });
  if (GENRES[genre].revision) song.genreRevision = GENRES[genre].revision;
  if (lengthSeconds !== null) {
    song.arrangement = 'developed-v1';
    Object.assign(song, longLayout(song, lengthSeconds), { lengthSeconds });
  }
  song.performance = 'instrument-v1';
  song.tracks = ['keys', 'pad', 'bass', 'drums'].map((id) => composePart(song, id, rng.fork(id).seed));
  const chosen = genre !== 'original' ? genreInstruments(song, options) : song;
  return { ...chosen, tracks: chosen.tracks.map(t => performTrack(chosen, t)) };
}

function genreInstruments(song, options) {
  song.tracks.forEach(t => {
    const { instrument, effects } = genreDefault(song.genre, partType(t), options);
    t.instrument = instrument;
    if (effects) t.effects = structuredClone(effects);
  });
  for (const track of song.tracks.filter(t => partType(t) !== 'drums')) {
    song = fitPitchedInstrument(song, track.id, track.instrument).song;
  }
  return song;
}

function fitPlayedPart(song, id) {
  const track = song.tracks.find(t => t.id === id), range = INSTRUMENTS[track.instrument].range;
  if (song.performance === 'instrument-v1' && range && track.notes.length) {
    const low = Math.min(...track.notes.map(n => n.midi)), high = Math.max(...track.notes.map(n => n.midi));
    const fits = Array.from({ length: 21 }, (_, i) => i - 10).some(n => low + n * 12 >= range[0] && high + n * 12 <= range[1]);
    if (!fits) {
      const offset = Math.round((range[0] + range[1] - low - high) / 24);
      const fold = midi => { midi += offset * 12; while (midi < range[0]) midi += 12; while (midi > range[1]) midi -= 12; return midi; };
      const next = { ...track, octaves: (track.octaves ?? 0) + offset,
        notes: track.notes.map(n => ({ ...n, midi: fold(n.midi), ...(n.slideFrom === undefined ? {} : { slideFrom: fold(n.slideFrom) }) })) };
      return { ...song, tracks: song.tracks.map(t => t.id === id ? next : t) };
    }
  }
  return fitPitchedInstrument(song, id, track.instrument).song;
}

export function rerollPart(song, id, seed) {
  checkSeed(seed);
  const old = song.tracks.find((track) => track.id === id);
  if (!old) throw new Error('Unknown song part: ' + id);
  const part = { ...identifyPart(composePart(song, partType(old), seed, old.id, old.role), old.id), instrument: old.instrument };
  if (old.role !== undefined) part.role = old.role;
  if (old.playing !== undefined) part.playing = old.playing;
  if (old.effects !== undefined) part.effects = structuredClone(old.effects);
  const played = performTrack(song, part);
  if (old.octaves) {
    played.octaves = old.octaves;
    played.notes = played.notes.map(n => ({ ...n, midi: n.midi + old.octaves * 12, ...(n.slideFrom === undefined ? {} : { slideFrom: n.slideFrom + old.octaves * 12 }) }));
  }
  const next = { ...song, tracks: song.tracks.map((track) => track.id === id ? played : track) };
  return song.performance === 'instrument-v1' && partType(old) !== 'drums'
    ? fitPlayedPart(next, id) : next;
}

function identifyPart(track, id) {
  if (id === track.id) return track;
  return { ...track, id, part: track.id, notes: track.notes.map((n, i) => ({ ...n, id: id + '-' + i })) };
}

export function addPart(song, part, seed, options = {}) {
  if (!PARTS.includes(part)) throw new Error('Unknown part: ' + part);
  if (song.tracks.length >= MAX_PARTS) throw new Error('Songs support up to ' + MAX_PARTS + ' parts');
  let id = part, n = 2;
  while (song.tracks.some(t => t.id === id)) id = part + '-' + n++;
  if (seed === undefined) seed = createRng(song.seed).fork(id).seed;
  checkSeed(seed);
  const track = identifyPart(composePart(song, part, seed, id, 'auto', options), id);
  const source = song.tracks.find(t => partType(t) === part);
  if (source) {
    track.instrument = source.instrument;
    if (source.playing !== undefined) track.playing = source.playing;
    if (source.effects !== undefined) track.effects = structuredClone(source.effects);
  } else if (song.genre) {
    track.instrument = genreDefault(song.genre, part, options).instrument;
  }
  const played = performTrack(song, track);
  if (source?.octaves !== undefined) {
    played.octaves = source.octaves;
    played.notes = played.notes.map(n => ({ ...n, midi: n.midi + source.octaves * 12,
      ...(n.slideFrom === undefined ? {} : { slideFrom: n.slideFrom + source.octaves * 12 }) }));
  }
  const next = { ...song, trackLayout: 'multi-v1', tracks: [...song.tracks, played] };
  return part === 'drums' ? next : fitPlayedPart(next, track.id);
}

export function removePart(song, id) {
  if (!song.tracks.some(t => t.id === id)) throw new Error('Unknown song part: ' + id);
  return { ...song, trackLayout: 'multi-v1', tracks: song.tracks.filter(t => t.id !== id) };
}

export function keepPartLayout(song, previous, options = {}) {
  if (!previous || previous.trackLayout !== 'multi-v1' && !previous.tracks.some(t => t.role !== undefined || t.playing !== undefined)) return song;
  const rng = createRng(song.seed);
  const tracks = previous.tracks.map(t => {
    const base = song.tracks.find(b => b.id === t.id);
    if (base && !t.role && !t.playing) return base;
    const next = identifyPart(composePart(song, partType(t), base?.seed ?? rng.fork(t.id).seed, t.id, t.role, options), t.id);
    next.instrument = base?.instrument ?? (song.genre ? genreDefault(song.genre, partType(t), options).instrument : partType(t));
    if (t.playing !== undefined) next.playing = t.playing;
    return performTrack(song, next);
  });
  let next = { ...song, trackLayout: 'multi-v1', tracks };
  for (const track of tracks.filter(t => partType(t) !== 'drums')) next = fitPlayedPart(next, track.id);
  return next;
}

export function changeKeyRole(song, id, role) {
  const track = song.tracks.find(t => t.id === id);
  if (!track || partType(track) !== 'keys' || !Object.hasOwn(KEY_ROLES, role)) throw new Error('Unknown Keys role');
  if (song.arrangement !== 'developed-v1' || song.melody !== 'auto') throw new Error('Roles need a new long track with an Auto melody');
  const next = { ...song, tracks: song.tracks.map(t => {
    if (t.id !== id) return t;
    const copy = { ...t };
    if (role === 'auto') delete copy.role; else copy.role = role;
    return copy;
  }) };
  const rerolled = rerollPart(next, id, track.seed);
  const changed = rerolled.tracks.find(t => t.id === id);
  if (track.effects !== undefined) changed.effects = structuredClone(track.effects);
  return fitPitchedInstrument(rerolled, id, track.instrument).song;
}

export function changePlaying(song, id, playing) {
  const track = song.tracks.find(t => t.id === id);
  if (!track || !Object.hasOwn(PLAYING[partType(track)], playing)) throw new Error('Unknown playing style');
  const next = { ...song, performance: 'instrument-v1', tracks: song.tracks.map(t => t.id === id ? { ...t, playing } : t) };
  return rerollPart(next, id, track.seed);
}
