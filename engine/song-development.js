import { USES } from './song-uses.js';
import { createRng } from './rng.js';
import { degree } from './kit/music.js';
import { addNote } from './song.js';
import { longStyle } from './song-long.js';

export const KEY_ROLES = { auto: 'Auto', lead: 'Lead melody', answer: 'Answering melody', arpeggio: 'Arpeggio' };

export function keyRole(id, role = 'auto') {
  if (role !== 'auto') return role;
  const index = Number(id.split('-')[1] ?? 1) - 1;
  return ['lead', 'answer', 'arpeggio'][index % 3];
}

function selected(song, part) {
  return song[part === 'keys' ? 'melody' : part];
}

export function sectionHarmony(song, section) {
  const h = song.harmony;
  if (song.progression !== 'auto' || ['Main', 'Intro', 'Turnaround', 'Ending'].includes(section.name)) return h;
  const paths = section.name === 'Contrast' ? [[5, 3, 1, 4], [3, 1, 5, 4], [1, 5, 3, 4]]
    : section.name === 'Build' ? [[1, 3, 4, 4], [3, 5, 1, 4]]
      : section.name === 'Answer' ? [[3, 0, 1, 4], [5, 3, 4, 0]] : [[0, 4, 5, 3], [0, 3, 4, 0], [0, 5, 3, 4]];
  const steps = createRng(song.seed).fork('harmony/' + section.name).pick(paths);
  const chords = steps.map(step => {
    const root = degree(h.scale, step);
    const notes = [0, 2, 4].map(offset => degree(h.scale, step + offset) - 12);
    return { root, notes };
  });
  return { ...h, steps: [...steps], chords };
}

function scaleMove(harmony, midi, steps) {
  const tones = Array.from({ length: 70 }, (_, i) => degree(harmony.scale, i - 28));
  let index = 0;
  for (let i = 1; i < tones.length; i++) if (Math.abs(tones[i] - midi) < Math.abs(tones[index] - midi)) index = i;
  return tones[Math.max(0, Math.min(tones.length - 1, index + steps))];
}

function chordTone(harmony, bar, midi) {
  const tones = harmony.chords[bar % 4].notes.flatMap(n => [-24, -12, 0, 12, 24, 36].map(shift => n + shift));
  return tones.reduce((best, n) => Math.abs(n - midi) < Math.abs(best - midi) ? n : best);
}

function rolePhrase(song, section, track, role, harmony, seed) {
  if (role === 'lead') return;
  const rng = createRng(seed).fork(role);
  track.notes = [];
  const style = longStyle(song);
  const spacing = style === 'spacious' || song.use === 'menu' ? 1 : 0.5;
  const order = rng.pick([[0, 1, 2, 1, 0, 2, 1, 2], [0, 2, 1, 2, 0, 1, 2, 1]]);
  const phrase = rng.pick([[4, 2, 1], [2, 4, 3], [4, 3, 0], [2, 1, 0]]);
  harmony.chords.forEach((chord, bar) => {
    if (role === 'arpeggio') {
      for (let beat = 0, i = 0; beat < 4; beat += spacing, i++) {
        let midi = chord.notes[order[(i + bar % 2) % order.length]];
        while (midi < 55) midi += 12;
        while (midi > 76) midi -= 12;
        addNote(track, bar * 4 + beat, midi, spacing * 0.72, rng.range(0.14, 0.22));
      }
    } else {
      const open = section.name === 'Contrast' || section.name === 'Answer';
      if (!open && bar % 2 === 0 && song.use !== 'promo') return;
      const beats = open ? [0.5, 2, 3] : [2.5, 3, 3.5];
      beats.forEach((beat, i) => {
        const midi = degree(harmony.scale, harmony.steps[bar] + phrase[i]);
        addNote(track, bar * 4 + beat, midi, i === 2 ? 0.4 : open ? 0.8 : 0.35, rng.range(0.2, 0.3));
      });
    }
  });
}

function shapePhrase(song, section, track, harmony, repeat, occurrence, auto, role) {
  const ppq = song.ppq;
  const style = longStyle(song);
  const promo = song.use === 'promo' || USES[song.use]?.continuous;
  const gentle = style !== 'driving';
  const secondary = role === 'answer' || role === 'arpeggio';
  const intro = section.name === 'Intro';
  const bridge = section.name === 'Contrast';
  const hook = section.name === 'Refrain';
  const build = section.name === 'Build';
  const variation = (repeat + occurrence) % 3;
  const turn = section.name === 'Turnaround';
  track.notes = track.notes.filter((note, i) => {
    const bar = Math.floor(note.tick / (4 * ppq));
    const beat = note.tick % (4 * ppq) / ppq;
    if (auto && track.id === 'drums' && style === 'spacious') return false;
    if (!auto) return true;
    if (!promo && intro && track.id === 'keys' && !secondary && bar < 2) return false;
    if (!promo && bridge && track.id === 'keys' && role === 'lead' && gentle && bar < 2) return false;
    if (track.id === 'keys' && role === 'lead' && !promo && !hook && !build && !secondary && bar % 2 && beat >= 2.5) return false;
    if (!promo && (intro || bridge) && track.id === 'drums' && (note.midi === 38 || note.midi === 42 && beat % 1)) return false;
    if (!promo && bridge && song.genre === 'electronic' && track.id === 'drums' && note.midi === 36) return false;
    if (!promo && intro && track.id === 'pad' && bar % 2 && !(song.genre === 'space' && song.genreRevision === 2)) return false;
    if (track.id === 'keys' && role === 'answer' && intro && !promo) return false;
    if (track.id === 'keys' && role === 'arpeggio' && style === 'driving' && hook && i % 3 === 1) return false;
    return true;
  });
  if (auto && bridge && !promo && track.id === 'drums' && ['rock', 'metal', 'kpop'].includes(song.genre)) {
    for (let bar = 0; bar < 4; bar++) addNote(track, bar * 4 + 2, 38, 0.12, 0.42);
    track.notes.sort((a, b) => a.tick - b.tick);
  }
  for (let i = 0; i < track.notes.length; i++) {
    const note = track.notes[i];
    const bar = Math.floor(note.tick / (4 * ppq));
    const beat = note.tick % (4 * ppq) / ppq;
    let level = intro ? 0.72 : bridge ? 0.78 : hook ? gentle ? 1.03 : 1.1 : build ? 0.84 + 0.24 * (repeat * 4 + bar) / Math.max(1, section.bars - 1) : 0.94;
    if (turn) level *= 1 - bar * 0.035;
    note.vel = Math.min(1, note.vel * level);
    if (!auto || track.id === 'drums') continue;
    if (track.id === 'keys' && role === 'lead') {
      if (bridge) note.midi = scaleMove(harmony, note.midi, bar % 2 ? -2 : -1);
      if (build) note.midi = scaleMove(harmony, note.midi, Math.min(3, Math.floor((repeat * 4 + bar) / 2)));
      if (variation && bar >= 2 && i % 3 === 1) {
        note.midi = scaleMove(harmony, note.midi, hook ? variation === 1 ? 1 : -1 : bar % 2 ? -variation : variation);
        note.len = Math.max(1, Math.round(note.len * (hook ? variation === 1 ? 1.12 : 0.9 : 0.8)));
      }
      if (beat === 0 || bar === 3 && i === track.notes.length - 1) note.midi = chordTone(harmony, bar, note.midi);
    }
    if (track.id === 'pad' && variation && i % 3 === 0 && note.midi < 67) note.midi += 12;
    const heldTheme = song.genre === 'space' && song.genreRevision === 2 && track.id === 'keys' && role === 'lead';
    note.len = Math.min(note.len, (heldTheme ? 16 : (bar + 1) * 4) * ppq - note.tick);
  }
}

function transitions(song, section, next, track, harmony, auto, role) {
  if (!auto || !track.notes.length || section.name === 'Ending') return;
  const endBeat = section.bars * 4;
  const lastBar = endBeat - 4;
  const gentle = longStyle(song) !== 'driving';
  if (track.id === 'keys' && role === 'lead' && section.name === 'Turnaround') {
    track.notes = track.notes.filter(n => n.tick < (endBeat - 2) * song.ppq);
    const root = song.harmony.chords[0].root;
    addNote(track, endBeat - 1, root + 12, 0.8, 0.25);
  } else if (track.id === 'bass') {
    const target = sectionHarmony(song, next ?? { name: 'Main' }).chords[0].root - 24;
    if (!track.notes.some(n => n.tick >= (endBeat - 0.5) * song.ppq)) {
      addNote(track, endBeat - 0.5, scaleMove(song.harmony, target, -1), 0.35, gentle ? 0.12 : 0.38);
    }
  } else if (track.id === 'drums' && !gentle && song.use !== 'menu') {
    const fill = section.name === 'Build' || next?.name === 'Refrain';
    if (fill && section.name !== 'Contrast') {
      track.notes = track.notes.filter(n => !(n.midi === 38 && n.tick >= (endBeat - 1) * song.ppq));
      for (const beat of [3, 3.5, 3.75]) addNote(track, lastBar + beat, 38, 0.08, beat === 3.75 ? 0.5 : 0.32);
    }
  }
}

function ending(song, part, seed) {
  const track = { id: part, instrument: part, seed, notes: [] };
  if (part === 'keys') addNote(track, 0, song.harmony.root + 12, 3.5, 0.5);
  if (part === 'pad') song.harmony.chords[0].notes.forEach(midi => addNote(track, 0, midi, 3.5, 0.4));
  if (part === 'bass') addNote(track, 0, song.harmony.root - 24, 2.5, 0.5);
  if (part === 'drums' && longStyle(song) !== 'spacious') addNote(track, 0, 36, 0.2, 0.4);
  return track;
}

export function composeDeveloped(song, part, seed, compose, id = part, role = 'auto') {
  const track = { id: part, instrument: part, seed, notes: [] };
  const rng = createRng(seed);
  const auto = selected(song, part) === 'auto';
  const chosenRole = part === 'keys' && auto ? keyRole(id, role) : 'lead';
  const visits = new Map();
  song.sections.forEach((section, index) => {
    const harmony = sectionHarmony(song, section);
    const material = section.name === 'Intro' || section.name === 'Turnaround' ? 'Main' : section.name;
    const materialSeed = rng.fork('material/' + material).seed;
    const local = { ...song, harmony, form: 'sketch', bars: 4, _material: true };
    delete local.arrangement; delete local.sections; delete local.lengthSeconds;
    let phrase = section.name === 'Ending' ? ending(song, part, seed) : compose(local, materialSeed);
    if (part === 'keys' && auto && section.name !== 'Ending') rolePhrase(song, section, phrase, chosenRole, harmony, materialSeed);
    const occurrence = visits.get(material) ?? 0;
    visits.set(material, occurrence + 1);
    const notes = [];
    for (let repeat = 0; repeat < Math.ceil(section.bars / 4); repeat++) {
      const copy = { ...phrase, notes: phrase.notes.map(n => ({ ...n })) };
      shapePhrase(song, section, copy, harmony, repeat, occurrence, auto, chosenRole);
      copy.notes.forEach(n => notes.push({ ...n, tick: n.tick + repeat * 16 * song.ppq }));
    }
    phrase = { ...phrase, notes };
    transitions(song, section, song.sections[index + 1], phrase, harmony, auto, chosenRole);
    phrase.notes.sort((a, b) => a.tick - b.tick || a.midi - b.midi);
    for (const note of phrase.notes) {
      if (note.tick >= section.bars * 4 * song.ppq) continue;
      const tick = section.bar * 4 * song.ppq + note.tick;
      track.notes.push({ ...note, id: part + '-' + track.notes.length, tick,
        len: Math.max(1, Math.min(note.len, (section.bar + section.bars) * 4 * song.ppq - tick)) });
    }
  });
  if (part === 'keys' && role !== 'auto') track.role = role;
  return track;
}
