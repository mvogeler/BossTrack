import { USES } from './song-uses.js';
import { fillCozy } from './genre-cozy.js';
import { fillElectronic } from './genre-electronic.js';
import { fillAdventure } from './genre-adventure.js';
import { fillLofi } from './genre-lofi.js';
import { fillBossa } from './genre-bossa.js';
import { fillFolk } from './genre-folk.js';
import { fillAmbient } from './genre-ambient.js';
import { fillHouse } from './genre-house.js';
import { fillTrance } from './genre-trance.js';
import { fillSynthwave } from './genre-synthwave.js';
import { fillDnb } from './genre-dnb.js';
import { fillDubstep } from './genre-dubstep.js';
import { fillRock } from './genre-rock.js';
import { fillMetal } from './genre-metal.js';
import { fillPop } from './genre-pop.js';
import { fillKpop } from './genre-kpop.js';
import { fillNeon } from './genre-neon.js';
import { fillMusicbox } from './genre-musicbox.js';
import { fillFunk } from './genre-funk.js';
import { fillMuzak, fillNewAge, fillIncremental } from './genre-soft.js';

import { fillCinematic } from './genre-cinematic.js';

export const GENRES = {
  cinematic_wonder: { name: 'Cinematic wonder', tempo: 82, mode: 'major', fill: fillCinematic,
    paths: [[0, 3, 5, 4], [0, 5, 3, 0], [0, 1, 3, 4]],
    instruments: { keys: 'horn_recorded', pad: 'violin_chords', bass: 'cello_bass', drums: 'drums_orchestral' } },
  cinematic_command: { name: 'Cinematic command', tempo: 112, mode: 'minor', fill: fillCinematic,
    paths: [[0, 5, 3, 4], [0, 3, 6, 0], [0, 1, 4, 0]],
    instruments: { keys: 'trumpet_recorded', pad: 'violin_spiccato', bass: 'tuba_recorded', drums: 'drums_orchestral' } },
  space: { name: 'Sci-fi horizon', tempo: 88, mode: 'minor', fill: fillCinematic, revision: 2,
    paths: [[0, 0, 3, 3], [0, 3, 0, 5], [0, 0, 5, 3]],
    effects: { keys: { reverb: { mix: 0.28, size: 0.8, damp: 0.55 }, delay: { mix: 0.16, beats: 0.75, feedback: 0.25, damp: 0.6 } },
      pad: { reverb: { mix: 0.28, size: 0.8, damp: 0.55 } }, bass: { delay: { mix: 0.15, beats: 0.75, feedback: 0.22, damp: 0.7 } } },
    instruments: { keys: 'orbital_theme', pad: 'nebula_strings', bass: 'navigation_pulse', drums: 'drums_machine' } },
  original: { name: 'Original' },
  watercolor_a: { name: 'Watercolor A: upright and strings', tempo: 80, mode: 'major', composed: true,
    instruments: { keys: 'upright_piano', pad: 'viola_chords', bass: 'contrabass_pizz', drums: 'drums_orchestral' } },
  watercolor_b: { name: 'Watercolor B: mallets and pads', tempo: 84, mode: 'major', composed: true,
    instruments: { keys: 'marimba_recorded', pad: 'viola_chords', bass: 'contrabass_pizz', drums: 'drums_orchestral' } },
  watercolor_a2: { name: 'Watercolor A2: upright and legato strings', tempo: 80, mode: 'major', composed: true,
    instruments: { keys: 'upright_piano', pad: 'strings_section_chords', bass: 'contrabass_pizz', drums: 'drums_soft_perc' } },
  watercolor_b2: { name: 'Watercolor B2: mallets and warm pad', tempo: 84, mode: 'major', composed: true,
    instruments: { keys: 'marimba_recorded', pad: 'analog_pad', bass: 'contrabass_pizz', drums: 'drums_soft_perc' } },
  incremental: { name: 'Cozy incremental', tempo: 80, mode: 'major', fill: fillIncremental, revision: 2,
    paths: [[0, 3, 5, 4], [0, 5, 3, 4], [0, 3, 1, 4], [0, 5, 1, 3]],
    instruments: { keys: 'soft_flute', pad: 'fm_epiano_chords', bass: 'upright_bass', drums: 'drums_jazz_kit' } },
  muzak: { name: 'Muzak / on hold', tempo: 96, fill: fillMuzak,
    paths: [[1, 4, 0, 5], [0, 5, 1, 4], [0, 2, 1, 4], [3, 4, 2, 5]],
    instruments: { keys: 'vibraphone', pad: 'fm_epiano_chords', bass: 'upright_bass', drums: 'drums_jazz_kit' } },
  newage: { name: 'New-age ambient', tempo: 68, fill: fillNewAge,
    paths: [[0, 5, 3, 0], [0, 3, 1, 0], [5, 3, 0, 4], [0, 2, 3, 0]],
    instruments: { keys: 'harp', pad: 'choir_oo', bass: 'sub_bass', drums: 'electronic' } },
  cozy: { name: 'Cozy instrumental', tempo: 88, fill: fillCozy, revision: 2,
    paths: [[0, 3, 1, 0], [0, 5, 3, 0], [0, 1, 4, 0]],
    instruments: { keys: 'felt_keys', pad: 'steinway_chords', bass: 'upright_bass', drums: 'drums_jazz_kit' } },
  musicbox: { name: 'Music box', tempo: 96, mode: 'major', fill: fillMusicbox, silent: ['drums'], lowest: { bass: 41 },
    paths: [[0, 3, 4, 0], [3, 0, 5, 4], [0, 5, 3, 4], [0, 3, 0, 4], [0, 5, 1, 4]],
    instruments: { keys: 'tine_box', pad: 'tine_box_chords', bass: 'tine_box_bass', drums: 'drums_soft_perc' } },
  electronic: { name: 'Electronic drive', tempo: 124, fill: fillElectronic, revision: 2,
    paths: [[0, 5, 3, 0], [0, 3, 5, 0], [0, 4, 5, 0]],
    instruments: { keys: 'analog_lead', pad: 'analog_pad', bass: 'rubber_bass', drums: 'drums_analog' } },
  adventure: { name: 'Orchestral adventure', tempo: 108, fill: fillAdventure,
    paths: [[0, 3, 4, 0], [0, 1, 4, 0], [0, 5, 4, 0]],
    instruments: { keys: 'woodwind_section_lead', pad: 'strings_section_chords', bass: 'upright_bass', drums: 'drums_studio_kit' } },
  lofi: { name: 'Lo-fi swing', tempo: 78, fill: fillLofi,
    paths: [[1, 4, 0, 5], [0, 5, 1, 4], [5, 3, 0, 4]],
    instruments: { keys: 'fm_epiano', pad: 'fm_epiano_chords', bass: 'upright_bass', drums: 'drums_jazz_kit' } },
  bossa: { name: 'Bossa lounge', tempo: 112, fill: fillBossa,
    paths: [[1, 4, 0, 5], [0, 1, 4, 0], [0, 5, 1, 4]],
    instruments: { keys: 'archtop_jazz', pad: 'archtop_jazz_chords', bass: 'upright_bass', drums: 'drums_jazz_kit' } },
  folk: { name: 'Acoustic folk', tempo: 104, fill: fillFolk,
    paths: [[0, 3, 0, 4], [0, 4, 5, 3], [0, 1, 3, 4]],
    instruments: { keys: 'archtop_acoustic', pad: 'archtop_acoustic_chords', bass: 'upright_bass', drums: 'drums_jazz_kit' } },
  ambient: { name: 'Ambient drift', tempo: 66, fill: fillAmbient,
    paths: [[0, 3, 5, 3], [0, 5, 3, 0], [0, 1, 3, 0]],
    instruments: { keys: 'musicbox', pad: 'choir_oo', bass: 'upright_bass', drums: 'electronic' } },
  house: { name: 'House', tempo: 120, fill: fillHouse,
    paths: [[0, 3, 5, 0], [0, 5, 1, 4], [0, 1, 4, 0]],
    instruments: { keys: 'edm_pluck', pad: 'analog_pad', bass: 'sub_bass', drums: 'drums_analog' } },
  trance: { name: 'Trance', tempo: 138, fill: fillTrance,
    paths: [[0, 5, 3, 4], [0, 3, 5, 4], [0, 1, 5, 4]],
    instruments: { keys: 'supersaw', pad: 'shimmer_pad', bass: 'sub_bass', drums: 'electronic' } },
  synthwave: { name: 'Synthwave', tempo: 104, fill: fillSynthwave,
    paths: [[0, 5, 3, 4], [0, 3, 1, 4], [0, 5, 1, 0]],
    instruments: { keys: 'pulse_lead', pad: 'analog_pad', bass: 'reese_bass', drums: 'electronic' } },
  dnb: { name: 'Drum and bass', tempo: 170, fill: fillDnb,
    paths: [[0, 5, 3, 0], [0, 1, 5, 4], [0, 3, 4, 0]],
    instruments: { keys: 'harmonic_lead', pad: 'shimmer_pad', bass: 'reese_bass', drums: 'drums_analog' } },
  dubstep: { name: 'Dubstep', tempo: 140, fill: fillDubstep,
    paths: [[0, 5, 3, 0], [0, 1, 4, 0], [0, 3, 5, 4]],
    instruments: { keys: 'fm_glass', pad: 'analog_pad', bass: 'wobble', drums: 'drums_analog' } },
  rock: { name: 'Rock', tempo: 116, fill: fillRock,
    paths: [[0, 3, 4, 0], [0, 5, 3, 0], [0, 6, 3, 0], [0, 4, 3, 0]],
    instruments: { keys: 'guitar_drive', pad: 'hollowbody_muted_chords', bass: 'picked_bass', drums: 'drums_tight' } },
  metal: { name: 'Metal', tempo: 148, fill: fillMetal, revision: 2,
    paths: [[0, 6, 5, 0], [0, 3, 6, 0], [0, 1, 4, 0], [0, 5, 6, 0]],
    instruments: { keys: 'guitar_palm', pad: 'guitar_power', bass: 'bass_grit', drums: 'drums_foundry_kit' } },
  pop: { name: 'Pop instrumental', tempo: 110, fill: fillPop,
    paths: [[0, 4, 5, 3], [0, 5, 3, 4], [0, 3, 4, 0], [0, 1, 4, 0]],
    instruments: { keys: 'celesta', pad: 'fm_epiano_chords', bass: 'finger_bass', drums: 'drums_studio_kit' } },
  kpop: { name: 'K-pop instrumental', tempo: 118, fill: fillKpop, revision: 2,
    paths: [[0, 5, 3, 4], [0, 3, 5, 4], [0, 1, 5, 4], [0, 4, 5, 3]],
    instruments: { keys: 'digital_pluck', pad: 'trumpet_stabs', bass: 'bass_808', drums: 'drums_impact' } },
  neon: { name: 'Neon electro-pop', tempo: 128, mode: 'minor', fill: fillNeon,
    paths: [[0, 5, 2, 6], [5, 6, 0, 0], [0, 0, 2, 2], [5, 0, 5, 0], [3, 5, 0, 6]],
    effects: { keys: { wide: { mix: 0.6, depth: 0.3 }, delay: { mix: 0.2, beats: 0.75, feedback: 0.3, damp: 0.5 }, reverb: { mix: 0.2, size: 0.7, damp: 0.4 } },
      pad: { wide: { mix: 0.8, depth: 0.5 }, reverb: { mix: 0.2, size: 0.75, damp: 0.5 }, pump: { mix: 0.6, beats: 1, release: 0.7 } },
      bass: { pump: { mix: 0.3, beats: 1, release: 0.4 } }, drums: { eq: { mix: 1, air: 0.6, mud: 0.2 } } },
    instruments: { keys: 'neon_lead', pad: 'neon_chords', bass: 'neon_bass', drums: 'drums_neon' } },
  funk: { name: 'Funk', tempo: 104, fill: fillFunk,
    paths: [[0, 3, 0, 4], [0, 1, 3, 0], [0, 5, 1, 0], [0, 4, 3, 0]],
    instruments: { keys: 'hollowbody_muted', pad: 'fm_epiano_chords', bass: 'picked_bass', drums: 'drums_funk_kit' } },
};

export function genrePart(song, track) {
  const selector = track.id === 'keys' ? 'melody' : track.id;
  const genre = GENRES[song.genre ?? 'original'];
  if (!genre.fill || song[selector] !== 'auto') return false;
  genre.fill(song, track);
  return true;
}

export function developGenre(song, track) {
  const selector = track.id === 'keys' ? 'melody' : track.id;
  if (!song.genre || song[selector] !== 'auto' || song.form === 'sketch') return;
  const sections = song.sections ?? [{ name: 'Main', bar: 0, bars: 4 }, { name: 'Refrain', bar: 4, bars: 4 }];
  track.notes = track.notes.filter(note => {
    if (['ambient', 'newage'].includes(song.genre) && track.id === 'drums') return false;
    const bar = note.tick / (4 * song.ppq);
    const section = sections.find(s => bar >= s.bar && bar < s.bar + s.bars);
    if (!section || section.name === 'Ending') return true;
    const contrast = song.use !== 'promo' && !USES[song.use]?.continuous && section.name === 'Contrast';
    if (contrast) {
      if (song.genre === 'newage' && track.id === 'keys' && note.tick % song.ppq) return false;
      if (song.genre === 'muzak' && track.id === 'pad' && note.tick % (2 * song.ppq)) return false;
      if (['house', 'trance', 'lofi', 'neon'].includes(song.genre) && track.id === 'drums' && note.midi === 36) return false;
      if (song.genre === 'dubstep' && track.id === 'bass') return false;
      if (song.genre === 'synthwave' && track.id === 'bass' && note.tick % song.ppq) return false;
      if (song.genre === 'dnb' && track.id === 'drums' && note.midi === 42 && note.tick % song.ppq) return false;
      if (song.genre === 'funk' && track.id === 'pad') return false;
      if (song.genre === 'musicbox' && track.id === 'pad' && note.tick % song.ppq) return false;
      if (song.genre === 'ambient' && track.id === 'keys') return false;
      if (['rock', 'metal', 'kpop'].includes(song.genre) && track.id === 'drums' && note.midi === 38) {
        const beat = note.tick % (4 * song.ppq);
        if (beat !== song.ppq && beat !== 2 * song.ppq) return false;
        if (beat === song.ppq) note.tick += song.ppq;
      }
      if (['pop', 'kpop', 'lofi'].includes(song.genre) && track.id === 'keys' && bar < section.bar + section.bars / 2) return false;
    }
    if (song.genre === 'electronic' && contrast) {
      if (track.id === 'drums' && note.midi === 36) return false;
      if (track.id === 'bass' && note.tick % (2 * song.ppq)) return false;
    }
    if (song.genre === 'cozy' && section.name === 'Refrain' && track.id === 'pad' && note.tick % (2 * song.ppq)) return false;
    if (section.name === 'Refrain') {
      if (['house', 'trance', 'dubstep', 'rock', 'metal', 'pop', 'kpop', 'neon'].includes(song.genre)) note.vel = Math.min(1, note.vel * 1.1);
      if (song.genre === 'folk' && track.id === 'drums') note.vel = Math.min(1, note.vel * 1.12);
      if (song.genre === 'funk' && track.id === 'bass') note.vel = Math.min(1, note.vel * 1.12);
      if (song.genre === 'electronic') note.vel = Math.min(1, note.vel * 1.1);
      if (song.genre === 'adventure') {
        note.vel = Math.min(1, note.vel * 1.12);
        if (track.id === 'keys') note.len = Math.min(Math.round(note.len * 1.15), (section.bar + section.bars) * 4 * song.ppq - note.tick);
      }
    }
    return true;
  });
}
