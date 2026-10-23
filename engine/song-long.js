import { FEELINGS } from './song-feelings.js';
import { USES } from './song-uses.js';
import { createRng } from './rng.js';

export function longLayout(song, seconds) {
  if (!Number.isFinite(song.tempo) || song.tempo < 30 || song.tempo > 300) throw new Error('Invalid song tempo');
  if (!Number.isInteger(seconds) || seconds < 120 || seconds > 300 || seconds % 15) throw new Error('Length must be 2–5 minutes in 15-second steps');
  if (!['song', 'loop'].includes(song.form)) throw new Error('Long tracks need Song or Loop form');
  if (song.arrangement === 'developed-v1') return developedLayout(song, seconds);
  const looping = song.form === 'loop';
  const phrases = Math.max(1, Math.round(((seconds - (looping ? 0 : 1.4)) * song.tempo / 240 - (looping ? 0 : 5)) / 4));
  const sections = [];
  let bar = 0;
  const add = (name, bars) => { sections.push({ name, bar, bars }); bar += bars; };
  if (!looping) add('Intro', 4);
  const names = ['Main', 'Refrain', 'Main', 'Refrain', 'Contrast', 'Refrain'];
  let remaining = phrases * 4, index = 0;
  while (remaining) { const bars = Math.min(8, remaining); add(remaining <= 8 ? 'Refrain' : names[index % names.length], bars); index++; remaining -= bars; }
  if (!looping) add('Ending', 1);
  if (bar > 256) throw new Error('Song exceeds 256 bars');
  return { bars: bar, sections };
}

export function arrangeLongPart(song, track) {
  const theme = track.notes;
  const ppq = song.ppq;
  const rng = createRng(track.seed);
  track.notes = [];
  song.sections.forEach((section, index) => {
    const source = section.name === 'Ending' ? 8 : section.name === 'Refrain' ? 4 : 0;
    const phrase = theme.filter(n => n.tick >= source * 4 * ppq && n.tick < (source + (source === 8 ? 1 : 4)) * 4 * ppq);
    const r = rng.fork('section/' + index);
    for (let repeat = 0; repeat < Math.ceil(section.bars / 4); repeat++) phrase.forEach((note, i) => {
      const offset = note.tick - source * 4 * ppq + repeat * 16 * ppq;
      if (offset >= section.bars * 4 * ppq) return;
      const intro = song.use !== 'promo' && section.name === 'Intro';
      const contrast = song.use !== 'promo' && section.name === 'Contrast';
      const halfTime = contrast && ['rock', 'metal', 'kpop'].includes(song.genre) && song.drums === 'auto';
      if (intro && track.id === 'keys') return;
      if (contrast && track.id === 'keys' && i % 3 !== 0 && i !== phrase.length - 1) return;
      if ((intro || contrast) && track.id === 'drums' && ((note.midi === 38 && !halfTime) || (note.midi === 42 && note.tick % (2 * ppq)))) return;
      if (contrast && track.id === 'pad' && Math.floor(note.tick / (4 * ppq)) % 2) return;
      if (song.use !== 'promo' && index > 2 && section.name === 'Main' && track.id === 'keys' && i % 5 === 2 && note.len < ppq && r.chance(0.4)) return;
      const tick = section.bar * 4 * ppq + offset;
      const shorter = repeat > 0 && track.id === 'keys' && i % 3 === 1;
      track.notes.push({ ...note, id: track.id + '-' + track.notes.length, tick,
        len: Math.min(Math.max(1, Math.round(note.len * (shorter ? 0.85 : 1))), (section.bar + section.bars) * 4 * ppq - tick),
        vel: note.vel * (intro ? 0.65 : contrast ? 0.75 : repeat > 0 ? 0.94 : 1) });
    });
  });
  return track;
}

export const LONG_STYLES = {
  gentle: ['cinematic_wonder', 'space', 'incremental', 'cozy', 'lofi', 'bossa', 'folk', 'muzak', 'musicbox'],
  spacious: ['ambient', 'newage'],
};

export function longStyle(song) {
  return USES[song.use]?.style ?? FEELINGS[song.feeling]?.style ?? Object.keys(LONG_STYLES).find(style => LONG_STYLES[style].includes(song.genre)) ?? 'driving';
}

function developedLayout(song, seconds) {
  const looping = song.form === 'loop';
  const count = Math.max(1, Math.round(((seconds - (looping ? 0 : 1.4)) * song.tempo / 240 - (looping ? 0 : 5)) / 4));
  const style = longStyle(song);
  const names = style === 'spacious' ? ['Main', 'Answer', 'Main', 'Contrast', 'Refrain', 'Main', 'Refrain']
    : style === 'gentle' ? ['Main', 'Answer', 'Refrain', 'Main', 'Contrast', 'Refrain', 'Refrain']
      : ['Main', 'Build', 'Refrain', 'Main', 'Build', 'Contrast', 'Refrain'];
  if (looping) names.push('Turnaround');
  if (count < names.length) {
    const short = looping ? ['Main', 'Refrain', 'Main', 'Contrast', 'Refrain', 'Turnaround'] : ['Main', 'Refrain', 'Main', 'Contrast', 'Refrain'];
    names.splice(0, names.length, ...short.slice(0, count));
    if (looping && count > 1) names[names.length - 1] = 'Turnaround';
  }
  const cycle = style === 'spacious' ? ['Answer', 'Main', 'Contrast', 'Refrain']
    : style === 'gentle' ? ['Main', 'Answer', 'Refrain', 'Contrast', 'Refrain']
      : ['Main', 'Build', 'Refrain', 'Contrast', 'Refrain'];
  let extra = 0;
  while (count > names.length * 4) {
    names.splice(names.length - 1, 0, cycle[extra++ % cycle.length]);
  }
  const units = names.map(() => 1);
  const weights = names.map(name => name === 'Main' || name === 'Refrain' ? 2 : 1);
  for (let left = count - names.length; left > 0; left--) {
    let best = 0;
    for (let i = 1; i < units.length; i++) if (units[best] >= 4 || units[i] < 4 && units[i] / weights[i] < units[best] / weights[best]) best = i;
    units[best]++;
  }
  const sections = [];
  let bar = 0;
  const add = (name, bars) => { sections.push({ name, bar, bars }); bar += bars; };
  if (!looping) add('Intro', 4);
  names.forEach((name, i) => add(name, units[i] * 4));
  if (!looping) add('Ending', 1);
  if (bar > 256) throw new Error('Song exceeds 256 bars');
  return { bars: bar, sections };
}
