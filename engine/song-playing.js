import { sectionHarmony } from './song-development.js';
import { INSTRUMENTS, partType } from './song-instruments.js';
import { createRng } from './rng.js';

export const PLAYING = {
  keys: { auto: 'Auto for instrument', plain: 'Original notes', chugs: 'Palm-muted chugs', lead: 'Sustained lead', expressive: 'Expressive swells', short: 'Short / detached notes', plucked: 'Short plucked phrases' },
  pad: { auto: 'Auto for instrument', plain: 'Original notes', strum: 'Strummed chords', stabs: 'Brass / chord stabs', legato: 'Sustained chords', expressive: 'Expressive swells', short: 'Short / detached notes' },
  bass: { auto: 'Auto for instrument', plain: 'Original notes', expressive: 'Expressive swells', picked: 'Picked groove', slides: 'Connected bass / slides' },
  drums: { auto: 'Auto for instrument', plain: 'Original notes', fills: 'Accents and phrase fills' },
};
const sliding = new Set(['guitar_soaring', 'bass_808', 'bass_grit', 'neon_lead', 'neon_bass']);

export function playingStyle(song, track) {
  if (track.playing && track.playing !== 'auto') return track.playing;
  const part = partType(track), id = track.instrument;
  if (song[part === 'keys' ? 'melody' : part] !== 'auto') return 'plain';
  if (id === 'violin_spiccato') return 'short';
  if (id === 'horizon_lead' || id === 'abyss_bass') return 'expressive';
  if (id === 'clockwork_pulse') return 'plucked';
  if (INSTRUMENTS[id].expressive) return 'expressive';
  if (/harp_recorded|harp_chords/.test(id)) return part === 'pad' ? 'strum' : 'plucked';
  if (part === 'drums') return ['metal', 'rock', 'kpop', 'pop', 'dnb', 'house', 'electronic', 'dubstep', 'neon'].includes(song.genre) ? 'fills' : 'plain';
  if (part === 'bass') return id === 'bass_808' ? 'slides' : /pick|grit/.test(id) || INSTRUMENTS[id].picked ? 'picked' : 'plain';
  if (part === 'pad' && /strumstick|dan_tranh/.test(id)) return 'strum';
  if (part === 'pad' && id === 'psaltery_chords') return 'legato';
  if (part === 'pad') return /guitar/.test(id) ? id === 'guitar_power' ? 'stabs' : 'strum' : /brass|trumpet/.test(id) ? 'stabs' : /bowed|strings|choir/.test(id) ? 'legato' : 'plain';
  if (/ocarina|harmonica|psaltery/.test(id)) return 'lead';
  if (/strumstick|dan_tranh|mbira/.test(id)) return 'plucked';
  return /palm|heavy|chug/.test(id) ? 'chugs' : /guitar_(soaring|drive)|flute|reed/.test(id) ? 'lead' : /pluck|pizz|glock|marimba|kalimba/.test(id) ? 'plucked' : 'plain';
}

export function performTrack(song, source) {
  if (song.performance !== 'instrument-v1') return source;
  const track = { ...source, notes: source.notes.map(n => ({ ...n })) };
  const style = playingStyle(song, track), part = partType(track);
  if (style === 'plain') return track;
  const rng = createRng(track.seed).fork('playing/' + style);
  const end = song.bars * 4 * song.ppq;
  const ticks = [...new Set(track.notes.map(n => n.tick))].sort((a, b) => a - b);
  const next = new Map(ticks.map((tick, i) => [tick, ticks[i + 1] ?? end]));
  const range = INSTRUMENTS[track.instrument].range ?? [0, 127];
  const chugShift = style === 'chugs' && track.notes.length && Math.min(...track.notes.map(n => n.midi)) >= Math.max(36, range[0] + 12) ? -12 : 0;
  let previous = null;
  for (const note of track.notes) {
    const gap = next.get(note.tick) - note.tick;
    if (style === 'expressive') {
      delete note.articulation;
      if (gap <= 4 * song.ppq) note.len = Math.min(16 * song.ppq, end - note.tick, Math.max(note.len, Math.round(gap * 0.92)));
      if (note.len >= song.ppq) note.expression = 'swell';
      note.vel = Math.min(1, note.vel * (0.9 + 0.1 * Math.sin(Math.PI * (note.tick % (16 * song.ppq)) / (16 * song.ppq))));
    } else if (style === 'short') {
      note.len = Math.max(1, Math.min(note.len, Math.round(gap * 0.5), Math.round(song.ppq * 0.3)));
      note.articulation = 'short';
    } else if (style === 'chugs') {
      note.midi += chugShift;
      note.len = Math.max(1, Math.min(note.len, Math.round(gap * 0.42), Math.round(song.ppq * 0.28)));
      note.vel *= note.tick % song.ppq ? 0.84 : 1;
    } else if (style === 'lead' || style === 'slides' || style === 'legato') {
      if (style === 'legato') delete note.articulation;
      if (style === 'legato' || gap <= 2 * song.ppq) note.len = Math.min(16 * song.ppq, end - note.tick, Math.max(note.len, Math.round(gap * (style === 'slides' ? 0.94 : 0.9))));
      if (sliding.has(track.instrument) && previous && note.tick > previous.tick && Math.abs(note.midi - previous.midi) <= 7 && note.midi !== previous.midi) note.slideFrom = previous.midi;
    } else if (style === 'plucked' || style === 'picked' || style === 'stabs') {
      note.len = Math.max(1, Math.min(note.len, Math.round(gap * 0.68), Math.round(song.ppq * (style === 'stabs' ? 0.35 : style === 'picked' ? 0.6 : 0.5))));
      if (style === 'stabs') note.articulation = 'short';
      note.vel = Math.min(1, note.vel * (note.tick % song.ppq ? 0.92 : 1.06));
    }
    previous = note;
  }
  if (style === 'strum') {
    for (const tick of ticks) {
      let chord = track.notes.filter(n => n.tick === tick).sort((a, b) => a.midi - b.midi);
      if (chord.length === 1) {
        const note = chord[0], bar = Math.floor(tick / (4 * song.ppq));
        const section = song.sections?.find(s => bar >= s.bar && bar < s.bar + s.bars);
        const harmony = section ? sectionHarmony(song, section) : song.harmony;
        const voiced = harmony.chords[(bar - (section?.bar ?? 0)) % 4].notes;
        chord = voiced.map(midi => {
          while (midi < range[0]) midi += 12;
          while (midi > range[1]) midi -= 12;
          return { ...note, midi };
        });
        track.notes = track.notes.filter(n => n !== note).concat(chord);
      }
      if (rng.chance(0.5)) chord.reverse();
      chord.forEach((note, i) => {
        const shift = Math.min(Math.round(i * song.ppq * 0.016), next.get(tick) - tick - 1);
        note.tick += shift; note.len = Math.max(1, Math.min(note.len - shift, end - note.tick));
        note.vel *= 1 - i * 0.045;
      });
    }
  }
  if (style === 'fills' && track.notes.length) {
    const cowbell = INSTRUMENTS[track.instrument].cowbellFills;
    const expanded = cowbell || ['drums_machine', 'drums_impact', 'drums_neon'].includes(track.instrument);
    const boundaries = song.sections?.filter(s => !['Ending', 'Contrast'].includes(s.name)).map(s => (s.bar + s.bars) * 4 * song.ppq)
      ?? Array.from({ length: Math.floor(song.bars / 4) }, (_, i) => (i + 1) * 16 * song.ppq);
    for (const stop of boundaries) {
      const start = stop - song.ppq;
      track.notes = track.notes.filter(n => !(n.tick >= start && n.tick < stop && [38, 42].includes(n.midi)));
      const hits = expanded ? cowbell ? [38, 56, 38, 56] : [38, 45, 45, 38] : [38, 38, 38, 38];
      for (let i = 0; i < 4; i++) track.notes.push({ id: '', tick: start + i * song.ppq / 4, len: Math.round(song.ppq * 0.08), midi: hits[i], vel: 0.32 + i * 0.075 });
      const tick = stop === end && song.form === 'loop' ? 0 : stop;
      if (expanded && tick < end && !track.notes.some(n => n.tick === tick && n.midi === 49)) track.notes.push({ id: '', tick, len: Math.round(song.ppq * 0.1), midi: 49, vel: 0.55 });
    }
  }
  track.notes.sort((a, b) => a.tick - b.tick || a.midi - b.midi);
  track.notes = track.notes.map((n, i) => ({ ...n, id: track.id + '-' + i }));
  return track;
}
