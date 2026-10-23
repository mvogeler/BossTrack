import { PLAYING } from './song-playing.js';
import { validMix } from './song-mixer.js';
import { INSTRUMENTS, PARTS, MAX_PARTS, partType } from './song-instruments.js';
import { FEELINGS } from './song-feelings.js';
import { MELODIES } from './song-melodies.js';
import { PADS } from './song-pad.js';
import { HARMONIES } from './song-harmony.js';
import { BASS } from './song-bass.js';
import { DRUMS } from './song-drums.js';
import { USES } from './song-uses.js';
import { longLayout } from './song-long.js';
import { GENRES } from './song-genres.js';
import { validEffects } from './song-effects.js';
import { SOUND_PRESETS } from './song-presets.js';
import { KEY_ROLES } from './song-development.js';
import { CUE_PROFILES } from './song-cues.js';
import { cueLayout } from './song-cue.js';

const int = (n, lo, hi) => Number.isInteger(n) && n >= lo && n <= hi;
const list = (a, length, check) => Array.isArray(a) && a.length === length && a.every(check);
const pitch = (n) => int(n, 0, 127);

export function readSongFile(text) {
  const file = JSON.parse(text);
  if (file?.normalizeWav !== undefined && typeof file.normalizeWav !== 'boolean') throw new Error('Invalid saved normalization');
  if (file?.exportSeconds !== undefined && (!Number.isFinite(file.exportSeconds) || file.exportSeconds < 1 || file.exportSeconds > 900)) throw new Error('Invalid saved export duration');
  if (file?.library !== undefined) {
    const info = file.library;
    if (!info || typeof info !== 'object' || Array.isArray(info) || Object.keys(info).some(key => !['title', 'favorite', 'tags'].includes(key)) ||
        typeof info.title !== 'string' || info.title.length > 120 || typeof info.favorite !== 'boolean' ||
        !Array.isArray(info.tags) || info.tags.length > 12 || new Set(info.tags).size !== info.tags.length ||
        info.tags.some(tag => typeof tag !== 'string' || !tag.trim() || tag.length > 40)) throw new Error('Invalid saved library info');
  }
  const s = file?.song;
  if (s?.soundPreset !== undefined && (typeof s.soundPreset !== 'string' || !Object.hasOwn(SOUND_PRESETS, s.soundPreset))) throw new Error('Invalid saved sound preset');
  if (s?.performance !== undefined && s.performance !== 'instrument-v1') throw new Error('Invalid saved performance');
  const multi = s?.trackLayout === 'multi-v1';
  if (s?.trackLayout !== undefined && !multi) throw new Error('Invalid part layout');
  const h = s?.harmony;
  const m = file?.mix;
  const composed = s?.arrangement === 'composed-v1';
  if (composed ? s.generator !== 'genre-v1' || !Object.hasOwn(CUE_PROFILES, s.genre) || !Object.hasOwn(CUE_PROFILES[s.genre].cues, s.cue) || s.lengthSeconds !== undefined || s.form !== 'loop'
    : s?.cue !== undefined || GENRES[s?.genre]?.composed) throw new Error('Invalid saved cue');
  const extended = ['returning-v1', 'developed-v1'].includes(s?.arrangement) || composed;
  if ((s?.arrangement !== undefined && !extended) || (!extended && (s?.lengthSeconds !== undefined || s?.sections !== undefined))) throw new Error('Invalid saved arrangement');
  const layout = composed ? cueLayout(s.genre, s.cue) : extended ? longLayout(s, s.lengthSeconds) : null;
  if (extended && JSON.stringify(s.sections) !== JSON.stringify(layout.sections)) throw new Error('Invalid saved sections');
  const genre = s?.generator === 'genre-v1';
  if (genre ? !Object.hasOwn(GENRES, s.genre) || s.genre === 'original' : s?.genre !== undefined) throw new Error('Invalid saved genre');
  if (s?.genreRevision !== undefined && (!genre || s.genreRevision !== GENRES[s.genre]?.revision)) throw new Error('Invalid saved genre revision');
  const modern = ['electronic-v4', 'electronic-v5', 'electronic-v6', 'electronic-v7', 'electronic-v8', 'electronic-v9', 'genre-v1'].includes(s?.generator);
  if (file?.format !== 'bosstrack-song' || file.v !== 1 || file.renderer !== 'song-v1') throw new Error('Unsupported song file version');
  if (s?.v !== 1 || !['electronic-v1', 'electronic-v2', 'electronic-v3', 'electronic-v4', 'electronic-v5', 'electronic-v6', 'electronic-v7', 'electronic-v8', 'electronic-v9', 'genre-v1'].includes(s.generator) || s.bars !== (extended ? layout.bars : modern ? (s.form === 'sketch' ? 4 : s.form === 'song' ? 9 : 8) : 4) || s.ppq !== 960 ||
      !int(s.seed, 0, 0xffffffff) || !Number.isFinite(s.tempo) || s.tempo < 30 || s.tempo > 300 ||
      ![44100, 48000].includes(s.output?.sampleRate) || ![16, 24, 32].includes(s.output?.bitDepth)) throw new Error('Invalid song timing or output');
  if (s.generator === 'electronic-v1' ? s.feeling !== undefined && s.feeling !== 'neutral' :
      !Object.hasOwn(FEELINGS, s.feeling) || (s.generator === 'electronic-v2' && s.feeling === 'neutral')) throw new Error('Invalid saved feeling');
  if (modern && !['song', 'loop', ...(s.generator !== 'electronic-v4' ? ['sketch'] : [])].includes(s.form)) throw new Error('Invalid saved form');
  if (s.sectionAnswer !== undefined && (!modern || s.form === 'sketch' || !['developed', 'harmonic', 'phrased'].includes(s.sectionAnswer))) throw new Error('Invalid saved section answer');
  if (s.sectionDrums !== undefined && (!modern || s.form === 'sketch' || s.sectionDrums !== 'contrast')) throw new Error('Invalid saved drum section');
  if (s.sectionBass !== undefined && (!modern || s.form === 'sketch' || s.sectionBass !== 'response')) throw new Error('Invalid saved bass section');
  if (s.sectionPad !== undefined && (!modern || s.form === 'sketch' || s.sectionPad !== 'entry')) throw new Error('Invalid saved pad section');
  if (!modern && s.form !== undefined && s.form !== 'sketch') throw new Error('Invalid saved form');
  if (modern ? !Object.hasOwn(USES, s.use) : s.generator === 'electronic-v3' ? !Object.hasOwn(USES, s.use) || s.use === 'sketch' :
      s.use !== undefined && s.use !== 'sketch') throw new Error('Invalid saved use');
  if (genre ? !Object.hasOwn(PADS, s.pad) : s.generator === 'electronic-v9' ? !Object.hasOwn(PADS, s.pad) || s.pad === 'original' :
      s.pad !== undefined && s.pad !== 'original') throw new Error('Invalid saved pad pattern');
  if (genre || s.generator === 'electronic-v9' ? !Object.hasOwn(HARMONIES, s.progression) : s.generator === 'electronic-v8' ? !Object.hasOwn(HARMONIES, s.progression) || s.progression === 'original' :
      s.progression !== undefined && s.progression !== 'original') throw new Error('Invalid saved harmony');
  if (['electronic-v8', 'electronic-v9', 'genre-v1'].includes(s.generator) ? !Object.hasOwn(BASS, s.bass) : s.generator === 'electronic-v7' ? !Object.hasOwn(BASS, s.bass) || s.bass === 'original' :
      s.bass !== undefined && s.bass !== 'original') throw new Error('Invalid saved bass pattern');
  if (['electronic-v7', 'electronic-v8', 'electronic-v9', 'genre-v1'].includes(s.generator) ? !Object.hasOwn(DRUMS, s.drums) : s.generator === 'electronic-v6' ? !Object.hasOwn(DRUMS, s.drums) || s.drums === 'original' :
      s.drums !== undefined && s.drums !== 'original') throw new Error('Invalid saved drum pattern');
  if (['electronic-v6', 'electronic-v7', 'electronic-v8', 'electronic-v9', 'genre-v1'].includes(s.generator) ? !Object.hasOwn(MELODIES, s.melody) : s.generator === 'electronic-v5' ? !Object.hasOwn(MELODIES, s.melody) || s.melody === 'original' :
      s.melody !== undefined && s.melody !== 'original') throw new Error('Invalid saved melody');
  if (!pitch(h?.root) || !['major', 'minor'].includes(h.mode) || typeof h.name !== 'string' || h.name.length > 64 ||
      !list(h.scale, 7, pitch) || !list(h.steps, 4, (n) => int(n, 0, 6)) ||
      !list(h.chords, 4, (c) => pitch(c?.root) && list(c.notes, 3, pitch)) ||
      !['steady', 'syncopated', 'half-time'].includes(s.groove)) throw new Error('Invalid song harmony');
  if (!Array.isArray(s.tracks) || (multi ? s.tracks.length > MAX_PARTS : s.tracks.length !== 4) ||
      s.tracks.some(t => !t || !PARTS.includes(partType(t)) || (multi ? !new RegExp('^' + partType(t) + '(-[2-8])?$').test(t.id) : t.part !== undefined || t.id !== partType(t))) ||
      new Set(s.tracks.map(t => t.id)).size !== s.tracks.length) throw new Error('Invalid song parts');
  const ids = s.tracks.map(t => t.id);
  if (file.generation !== undefined) {
    const g = file.generation;
    const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);
    if (!object(g) || Object.keys(g).some(key => !['locks', 'varyInstruments', 'favorites', 'favoritesOnly', 'keepMix'].includes(key)) ||
        g.keepMix !== undefined && typeof g.keepMix !== 'boolean' || typeof g.varyInstruments !== 'boolean' || typeof g.favoritesOnly !== 'boolean' ||
        !Array.isArray(g.favorites) || g.favorites.length > Object.keys(INSTRUMENTS).length ||
        new Set(g.favorites).size !== g.favorites.length ||
        g.favorites.some(id => typeof id !== 'string' || !Object.hasOwn(INSTRUMENTS, id)) || !object(g.locks) ||
        Object.keys(g.locks).some(id => !ids.includes(id)) || Object.values(g.locks).some(lock =>
          !object(lock) || Object.entries(lock).some(([key, value]) => !['notes', 'instrument', 'mix'].includes(key) || typeof value !== 'boolean')))
      throw new Error('Probably missing an instrument that was saved in it.');
  }
  for (const t of s.tracks) {
    if (t.playing !== undefined && (typeof t.playing !== 'string' || !Object.hasOwn(PLAYING[partType(t)], t.playing))) throw new Error('Invalid saved playing style');
    if (t.role !== undefined && (partType(t) !== 'keys' || typeof t.role !== 'string' || !Object.hasOwn(KEY_ROLES, t.role))) throw new Error('Invalid saved Keys role');
    if (t.effects !== undefined && !validEffects(t.effects)) throw new Error('Invalid saved part effects');
    if (t.octaves !== undefined && (partType(t) === 'drums' || !int(t.octaves, -10, 10))) throw new Error('Invalid part octave shift');
    const instrument = INSTRUMENTS[t.instrument];
    if (!instrument) throw new Error('This song uses an instrument that is not installed: ' + t.instrument);
    if (instrument?.part !== partType(t) || !int(t.seed, 0, 0xffffffff) || !Array.isArray(t.notes) || t.notes.length > (extended ? 16384 : 512)) throw new Error('Invalid song instrument or part');
    if (new Set(t.notes.map((n) => n?.id)).size !== t.notes.length || t.notes.some((n) =>
      typeof n?.id !== 'string' || n.id.length > 64 || !int(n.tick, 0, s.bars * 3840 - 1) || !int(n.len, 1, s.bars * 3840 - n.tick) ||
      (extended && n.len > 16 * s.ppq) ||
      (n.articulation !== undefined && (!genre && s.generator !== 'electronic-v9' && s.performance !== 'instrument-v1' || !(partType(t) === 'pad' || s.performance === 'instrument-v1' && partType(t) === 'keys') || n.articulation !== 'short')) ||
      (n.expression !== undefined && (s.performance !== 'instrument-v1' || partType(t) === 'drums' || n.expression !== 'swell')) ||
      (n.slur !== undefined && (s.performance !== 'instrument-v1' || partType(t) === 'drums' || !['in', 'out', 'both'].includes(n.slur))) ||
      (n.slideFrom !== undefined && (s.performance !== 'instrument-v1' || !['keys', 'bass'].includes(partType(t)) || !pitch(n.slideFrom))) ||
      !pitch(n.midi) || !Number.isFinite(n.vel) || n.vel < 0 || n.vel > 1 ||
      (instrument.range && (n.midi < instrument.range[0] || n.midi > instrument.range[1])))) throw new Error('Invalid saved notes');
  }
  if (!validMix(m, ids) || typeof file.repeat !== 'boolean') throw new Error('Invalid saved mix');
  for (const t of s.tracks) if (INSTRUMENTS[t.instrument].sample && !/^[a-f0-9]{64}$/.test(file.assets?.[t.instrument])) throw new Error('Missing ' + INSTRUMENTS[t.instrument].name + ' asset identity');
  return file;
}
