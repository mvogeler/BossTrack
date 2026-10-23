import { addPart } from './song-compose.js';
import { INSTRUMENTS, MAX_PARTS, partType, fitPitchedInstrument } from './song-instruments.js';
import { createRng } from './rng.js';

export const SOUND_PRESETS = {
  gritty: { name: 'Gritty signal', description: 'Buzzy pulse melody, rough bass and a worn digital edge.' },
  'echo-tide': { name: 'Echo tide', description: 'Clear melody over a lower repeating figure with dark echoes.' },
};

const VOICES = {
  gritty: { keys: 'pulse_lead', pad: 'analog_pad', bass: 'reese_bass', drums: 'drums_analog' },
  'echo-tide': { keys: 'fm_glass', pad: 'shimmer_pad', bass: 'sub_bass', drums: 'drums_tight' },
};

function effects(preset, part, background) {
  if (preset === 'gritty') {
    if (part === 'keys') return { crush: { mix: 0.52, bits: 7, rate: 5 },
      delay: { mix: 0.16, beats: 0.75, feedback: 0.24, damp: 0.6 } };
    if (part === 'bass') return { crush: { mix: 0.28, bits: 8, rate: 3 } };
    if (part === 'drums') return { crush: { mix: 0.18, bits: 10, rate: 2 } };
    return { reverb: { mix: 0.12, size: 0.4, damp: 0.7 } };
  }
  if (background) return { delay: { mix: 0.43, beats: 0.75, feedback: 0.58, damp: 0.72 },
    reverb: { mix: 0.28, size: 0.8, damp: 0.6 } };
  if (part === 'pad') return { reverb: { mix: 0.38, size: 0.9, damp: 0.65 } };
  return {};
}

function repeatingFigure(song, track) {
  const rng = createRng(song.seed).fork('echo-tide:' + track.id);
  const order = rng.pick([[0, 1, 2, 1], [0, 2, 1, 2], [0, 1, 0, 2]]);
  const notes = [];
  for (let bar = 0; bar < song.bars; bar++) {
    const chord = song.harmony.chords[bar % song.harmony.chords.length].notes;
    for (let step = 0; step < 8; step++) {
      if (song.form !== 'loop' && bar === song.bars - 1 && step > 3) continue;
      const midi = chord[order[step % order.length]] - 12;
      notes.push({ id: track.id + '-' + notes.length, tick: Math.round((bar * 4 + step / 2) * song.ppq),
        len: Math.round(song.ppq * 0.28), midi, vel: rng.range(0.22, 0.34) });
    }
  }
  const next = { ...track, seed: rng.seed, notes };
  delete next.octaves;
  return next;
}

export function applySoundPreset(song, id, options = {}) {
  if (!Object.hasOwn(SOUND_PRESETS, id)) throw new Error('Unknown sound preset: ' + id);
  let next = { ...song, soundPreset: id, tracks: song.tracks.map(t => ({ ...t, notes: t.notes.map(n => ({ ...n })) })) };
  const keys = next.tracks.filter(t => partType(t) === 'keys');
  let background = id === 'echo-tide' ? keys[1]?.id : null;
  if (id === 'echo-tide' && keys.length && !background && next.tracks.length < MAX_PARTS && next.harmony) {
    next = addPart(next, 'keys', createRng(song.seed).fork('echo-tide-background').seed);
    background = next.tracks.at(-1).id;
  }
  for (const source of [...next.tracks]) {
    const lock = options.locks?.[source.id] ?? {};
    const part = partType(source);
    const isBackground = source.id === background;
    let track = isBackground && !lock.notes && next.harmony ? repeatingFigure(next, source) : source;
    if (!lock.mix) track = { ...track, effects: effects(id, part, isBackground) };
    next = { ...next, tracks: next.tracks.map(t => t.id === track.id ? track : t) };
    if (lock.instrument) {
      if (isBackground && !lock.notes) next = fitPitchedInstrument(next, track.id, track.instrument).song;
      continue;
    }
    const instrument = isBackground ? 'edm_pluck' : VOICES[id][part];
    const range = INSTRUMENTS[instrument].range ?? [0, 127];
    if (lock.notes && track.notes.some(n => n.midi < range[0] || n.midi > range[1])) continue;
    next = part === 'drums' || lock.notes
      ? { ...next, tracks: next.tracks.map(t => t.id === track.id ? { ...t, instrument } : t) }
      : fitPitchedInstrument(next, track.id, instrument).song;
  }
  return next;
}
