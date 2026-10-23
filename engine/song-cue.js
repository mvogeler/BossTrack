import { createRng } from './rng.js';
import { createSong } from './song.js';
import { scale, degree } from './kit/music.js';
import { INSTRUMENTS } from './song-instruments.js';
import { CUE_PROFILES } from './song-cues.js';
import { cueInstrument } from './song-defaults.js';

const KEYS = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
const CHORD = /^(b|#)?([1-7])(maj9|maj7|m9|m7|add9|sus2|sus|M|m|7|9|6)?(?:\/(b|#)?([1-7]))?$/;
const NOTE = /^([1-7]|r)(#|b)?([',]*):(\d+(?:\.\d+)?)$/;
const ENERGY = { Intro: 0.5, Main: 0.72, Answer: 0.76, Contrast: 0.62, Refrain: 0.9, Turnaround: 0.56 };

export function cueProfile(genre) {
  const profile = CUE_PROFILES[genre];
  if (!profile) throw new Error('Unknown cue profile: ' + genre);
  return profile;
}

export function cueData(genre, cue) {
  const data = cueProfile(genre).cues[cue];
  if (!data) throw new Error('Unknown cue: ' + cue);
  return data;
}

export function cueLayout(genre, cue) {
  const sections = [];
  let bar = 0;
  for (const section of cueData(genre, cue).sections) {
    sections.push({ name: section.name, bar, bars: section.chords.length });
    bar += section.chords.length;
  }
  return { bars: bar, sections };
}

function keyScale(song) {
  const data = cueData(song.genre, song.cue);
  return scale(60 + song.harmony.root % 12, data.mode);
}

export function parseChord(token, tones) {
  const m = CHORD.exec(token);
  if (!m) throw new Error('Unknown chord: ' + token);
  const step = Number(m[2]) - 1;
  const shift = m[1] === 'b' ? -1 : m[1] === '#' ? 1 : 0;
  const root = degree(tones, step) + shift;
  const above = n => degree(tones, step + n) - degree(tones, step);
  const third = shift ? 4 : above(2), fifth = shift ? 7 : above(4), seventh = shift ? 10 : above(6);
  const ninth = above(8) - (above(8) === 13 ? -1 : 0);
  const quality = m[3] ?? '';
  const intervals = {
    '': [0, third, fifth], M: [0, 4, 7], m: [0, 3, 7], 7: [0, third, fifth, seventh], maj7: [0, 4, 7, 11], m7: [0, 3, 7, 10],
    9: [0, third, fifth, seventh, ninth], maj9: [0, 4, 7, 11, 14], m9: [0, 3, 7, 10, 14], add9: [0, third, fifth, 14],
    sus: [0, 5, 7], sus2: [0, 2, 7], 6: [0, third, fifth, 9],
  }[quality];
  const bass = m[5] ? degree(tones, Number(m[5]) - 1) + (m[4] === 'b' ? -1 : m[4] === '#' ? 1 : 0) : root;
  return { token, root: root % 12, intervals, pcs: intervals.map(i => (root + i) % 12), bass: ((bass % 12) + 12) % 12,
    third: intervals[1] === 5 || intervals[1] === 2 ? null : (root + intervals[1]) % 12,
    seventh: intervals.length > 3 && intervals[3] < 12 ? (root + intervals[3]) % 12 : null };
}

export function chartEvents(chords, tones, startBeat = 0) {
  return chords.flatMap((cell, bar) => {
    const parts = cell.trim().split(/\s+/);
    return parts.map((token, i) => ({ beat: startBeat + bar * 4 + i * 4 / parts.length, len: 4 / parts.length, chord: parseChord(token, tones) }));
  });
}

export function parseTheme(text, tones, base) {
  const notes = [];
  let at = 0;
  text.split('|').forEach((bar, index) => {
    const start = at;
    for (const token of bar.trim().split(/\s+/)) {
      const m = NOTE.exec(token);
      if (!m) throw new Error('Unknown theme note: ' + token);
      const len = Number(m[4]);
      if (m[1] !== 'r') {
        const octave = [...m[3]].reduce((n, c) => n + (c === "'" ? 12 : -12), 0);
        const midi = base + degree(tones, Number(m[1]) - 1) - tones[0] + octave + (m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0);
        notes.push({ beat: at, len, midi });
      }
      at += len;
    }
    if (Math.abs(at - start - 4) > 1e-9) throw new Error('Theme bar ' + (index + 1) + ' is not four beats');
  });
  return { notes, beats: at };
}

function nearest(pc, target, lo = 0, hi = 127) {
  let best = null;
  for (let midi = lo; midi <= hi; midi++) {
    if (((midi % 12) + 12) % 12 === pc && (best === null || Math.abs(midi - target) < Math.abs(best - target))) best = midi;
  }
  return best ?? target;
}

function chordAt(events, beat) {
  return events.findLast(e => e.beat <= beat + 1e-9) ?? events[0];
}

function scaleStep(tones, midi, steps) {
  const ladder = Array.from({ length: 77 }, (_, i) => degree(tones, i - 35));
  let index = 0;
  for (let i = 1; i < ladder.length; i++) if (Math.abs(ladder[i] - midi) < Math.abs(ladder[index] - midi)) index = i;
  return ladder[Math.max(0, Math.min(ladder.length - 1, index + steps))];
}

function clashes(midi, chord) {
  const pc = midi % 12;
  return !chord.pcs.includes(pc) && chord.pcs.some(c => Math.min((pc - c + 12) % 12, (c - pc + 12) % 12) === 1);
}

export function voiceChord(chord, previous, lo, hi, count = 4) {
  const pool = [];
  for (let midi = lo; midi <= hi; midi++) if (chord.pcs.includes(midi % 12)) pool.push(midi);
  const needed = [chord.third, chord.seventh].filter(pc => pc !== null);
  const center = (lo + hi) / 2;
  let best = null, cost = Infinity;
  const pick = (from, chosen) => {
    if (chosen.length === count) {
      if (needed.some(pc => !chosen.some(n => n % 12 === pc))) return;
      if (chosen.at(-1) - chosen[0] > 19) return;
      for (let i = 1; i < chosen.length; i++) if (chosen[i] - chosen[i - 1] < 2) return;
      if (chosen.some(a => chosen.some(b => b - a === 13))) return;
      if (chosen.filter(n => n % 12 === chord.third).length > 1) return;
      const mean = chosen.reduce((a, b) => a + b, 0) / count;
      let c = Math.abs(mean - center) * (previous ? 0.4 : 1);
      if (previous) chosen.forEach((n, i) => { c += Math.abs(n - previous[Math.min(i, previous.length - 1)]); });
      if (c < cost) { cost = c; best = [...chosen]; }
      return;
    }
    for (let i = from; i < pool.length; i++) pick(i + 1, [...chosen, pool[i]]);
  };
  pick(0, []);
  return best ?? pool.slice(0, count);
}

function writer(song, track, rng, section, energy) {
  const ppq = song.ppq, end = song.bars * 4 * ppq;
  const limit = section ? (section.bar + section.bars) * 4 * ppq : end;
  return (beat, midi, len, vel, extra = {}) => {
    const range = INSTRUMENTS[track.instrument]?.range;
    if (range) { while (midi < range[0]) midi += 12; while (midi > range[1]) midi -= 12; }
    const push = Math.round(Math.max(-14, Math.min(14, rng.gauss(extra.late ?? 3, extra.loose ?? 6))));
    const tick = Math.max(0, Math.min(end - 1, Math.round(beat * ppq) + (beat === 0 ? Math.max(0, push) : push)));
    const span = Math.max(1, Math.min(Math.round(len * ppq), 16 * ppq, (extra.tie ? end : limit) - tick, end - tick));
    const accent = beat % 4 === 0 ? 1 : beat % 2 === 0 ? 0.93 : beat % 1 === 0 ? 0.87 : 0.8;
    const level = Math.min(1, Math.max(0.02, vel * (0.62 + 0.38 * energy) * (extra.flat ? 1 : accent) * (1 + rng.range(-0.05, 0.05))));
    const note = { id: '', tick, len: span, midi, vel: Number(level.toFixed(4)) };
    if (extra.swell) note.expression = 'swell';
    track.notes.push(note);
    return note;
  };
}

function fitRegister(notes, range) {
  if (!range || !notes.length) return 0;
  const low = Math.min(...notes.map(n => n.midi)), high = Math.max(...notes.map(n => n.midi));
  let shift = 0;
  while (low + shift < range[0] && high + shift + 12 <= range[1]) shift += 12;
  while (high + shift > range[1] && low + shift - 12 >= range[0]) shift -= 12;
  return shift;
}

function lead(ctx, theme, { from = 0, bars = null, octave = 0, quiet = 1 } = {}) {
  const { song, track, rng, section, events, tones, add, occurrence } = ctx;
  const parsed = parseTheme(theme.notes, tones, theme.base + 12 * octave);
  const span = (bars ?? section.bars) * 4;
  const notes = [];
  for (let at = 0; at < span; at += parsed.beats - from * 4) {
    for (const n of parsed.notes) {
      if (n.beat < from * 4) continue;
      const beat = at + n.beat - from * 4;
      if (beat >= span) break;
      notes.push({ ...n, beat });
    }
    if (bars !== null) break;
  }
  const shift = fitRegister(notes, INSTRUMENTS[track.instrument]?.range);
  const ornate = occurrence > 0 || rng.chance(0.3);
  notes.forEach((n, i) => {
    const beat = section.bar * 4 + n.beat + (ctx.offset ?? 0);
    let midi = n.midi + shift;
    const chord = chordAt(events, beat).chord;
    if (n.beat % 2 === 0 && n.len >= 1 && clashes(midi, chord)) midi = chord.pcs.map(pc => nearest(pc, midi)).reduce((a, b) => Math.abs(a - midi) <= Math.abs(b - midi) ? a : b);
    const next = notes[i + 1];
    if (ornate && next && n.len >= 1.5 && next.midi !== n.midi && rng.chance(0.35)) {
      const step = scaleStep(tones, midi, next.midi > midi ? 1 : -1);
      add(beat, midi, n.len - 0.5, theme.vel * quiet * 0.98, { late: 6 });
      add(beat + n.len - 0.5, step, 0.55, theme.vel * quiet * 0.82, { late: 6 });
      return;
    }
    const arc = 0.9 + 0.1 * Math.sin(Math.PI * (n.beat % 16) / 16);
    add(beat, midi, n.len * (n.len >= 1 ? 1.02 : 0.95), theme.vel * quiet * arc, { late: 6 });
  });
}

function counter(ctx, option, { lo, hi, vel }) {
  const sparse = option === 'sparse';
  const { tones, events, add, rng, section } = ctx;
  let previous = (lo + hi) / 2 + 3;
  events.forEach((event, i) => {
    if (sparse && i % 2 === 0) return;
    const { chord } = event;
    const options = [chord.third, chord.seventh, (chord.root + chord.intervals[2]) % 12].filter(pc => pc !== null);
    let midi = options.map(pc => nearest(pc, previous, lo, hi)).reduce((a, b) => Math.abs(a - previous) <= Math.abs(b - previous) ? a : b);
    if (midi === previous && rng.chance(0.5)) midi = options.map(pc => nearest(pc, previous + 4, lo, hi)).find(m => m !== previous) ?? midi;
    const late = rng.chance(0.3) ? 0.5 : 0;
    const following = events[i + 1];
    const passing = event.len >= 2 && following && rng.chance(0.55);
    const breath = (event.beat - section.bar * 4 + event.len) % 16 === 0 ? 0.5 : 0;
    add(event.beat + late, midi, event.len - late - (passing ? 1 : 0) - breath, vel, { swell: event.len - late >= 2, loose: 8 });
    if (passing) {
      const target = nearest(following.chord.third ?? following.chord.root, midi, lo, hi);
      add(event.beat + event.len - 1, target === midi ? midi : scaleStep(tones, midi, target > midi ? 1 : -1), 1 - breath, vel * 0.85, { loose: 8 });
    }
    previous = midi;
  });
}

function ladder(chord, lo, hi, bassFirst) {
  let notes = [];
  for (let midi = lo; midi <= hi; midi++) if (chord.pcs.includes(midi % 12)) notes.push(midi);
  notes = notes.filter(n => !notes.some(m => m - n === 1 || m - n === 13));
  if (bassFirst) {
    const bass = nearest(chord.bass, lo + 3, lo - 6, lo + 8);
    return [bass, ...notes.filter(n => n > bass + 4)];
  }
  return notes;
}

const ARPS = {
  harp16: { rate: 0.25, walk: [0, 1, 2, 3, 4, 5, 4, 3, 2, 1, 2, 3, 4, 3, 2, 1], ring: 2 },
  harp8: { rate: 0.5, walk: [0, 2, 1, 3, 2, 4, 3, 1], ring: 2.5 },
  piano8: { rate: 0.5, walk: [0, 2, 1, 3, 2, 1, 3, 2], ring: 'pedal' },
  broken8: { rate: 0.5, walk: [0, 1, 2, 3, 4, 3, 2, 1], ring: 'pedal', bassFirst: true },
  rolling8: { rate: 0.5, walk: [0, 2, 4, 2, 1, 3, 5, 3], ring: 'pedal', bassFirst: true },
  pulse8: { rate: 0.5, walk: [2, 3, 2, 3, 2, 3, 2, 4], ring: 0.4 },
  ostinato: { hits: [0, 0.75, 1.5, 2, 2.75, 3.5], walk: [0, 2, 1, 3, 2, 1], ring: 0.6 },
  counting: { hits: [0, 0.5, 1, 1.5, 2, 2.5, 3, 3.5], walk: [2, 2, 1, 2, 2, 2, 1, 3], ring: 0.3 },
};

function arpeggio(ctx, name, { lo, hi, vel, thin = false }) {
  const { events, add, rng } = ctx;
  const pattern = ARPS[name];
  const rotate = rng.int(0, 1) * 2;
  for (const event of events) {
    const notes = ladder(event.chord, lo, hi, pattern.bassFirst);
    const hits = pattern.hits ?? Array.from({ length: 4 / pattern.rate }, (_, i) => i * pattern.rate);
    hits.forEach((offset, i) => {
      if (offset >= event.len) return;
      if (thin && i % 2) return;
      const index = pattern.walk[(i + rotate) % pattern.walk.length];
      const midi = notes[Math.min(notes.length - 1, index)];
      const ring = pattern.ring === 'pedal' ? event.len - offset : Math.min(pattern.ring, event.len - offset);
      const swellUp = 0.92 + 0.08 * Math.sin(Math.PI * offset / 4);
      add(event.beat + offset, midi, ring, vel * swellUp * (i === 0 ? 1.08 : 1), { loose: 4, late: 2 });
    });
  }
}

function sparkle(ctx, option, { lo, hi, vel }) {
  const { events, add, rng } = ctx;
  events.forEach((event, i) => {
    if (i % 2 === 1 || !rng.chance(0.7)) return;
    const notes = ladder(event.chord, lo, hi);
    const at = rng.pick([1.5, 2.5, 3, 3.5]);
    if (at >= event.len) return;
    const top = notes.at(-1 - rng.int(0, 2));
    add(event.beat + at, top, 1.5, vel);
    if (rng.chance(0.5)) add(event.beat + at + 0.5, notes[Math.max(0, notes.indexOf(top) - 1)], 1.5, vel * 0.8);
  });
}

function comp(ctx, name, { lo, hi, vel }) {
  const { events, add } = ctx;
  let previous = null;
  for (const event of events) {
    const voiced = voiceChord(event.chord, previous, lo, hi, 4);
    previous = voiced;
    const hits = name === 'block' && event.len >= 4 ? [[0, 2], [2, 2]] : [[0, event.len]];
    for (const [at, len] of hits) {
      voiced.forEach((midi, i) => add(event.beat + at + (name === 'rolled' ? i * 0.045 : 0), midi, len, vel * (at ? 0.85 : 1) * (i === voiced.length - 1 ? 1.05 : 0.95), { loose: 3, flat: true }));
    }
  }
}

function pad(ctx, option, { lo, hi, vel, count = 4 }) {
  const { events, add } = ctx;
  let previous = null, held = [];
  events.forEach(event => {
    const voiced = voiceChord(event.chord, previous, lo, hi, count);
    const next = [];
    voiced.forEach(midi => {
      const keep = held.find(n => n.midi === midi && n.len + Math.round(event.len * ctx.song.ppq) <= 16 * ctx.song.ppq);
      if (keep) { keep.len = Math.min(keep.len + Math.round(event.len * ctx.song.ppq), ctx.song.bars * 4 * ctx.song.ppq - keep.tick); next.push(keep); }
      else next.push(add(event.beat, midi, event.len + 0.1, vel, { swell: true, loose: 10, flat: true }));
    });
    held = next;
    previous = voiced;
  });
}

function bass(ctx, name, { lo, hi, vel }) {
  const { events, add, rng, tones } = ctx;
  events.forEach((event, i) => {
    const root = nearest(event.chord.bass, (lo + hi) / 2 - 3, lo, hi);
    const next = events[i + 1];
    if (name === 'pedal') { add(event.beat, root, event.len, vel); return; }
    const first = name === 'root' || event.len < 4 ? event.len - 0.1 : 1.9;
    add(event.beat, root, first, vel, { loose: 4 });
    if (name !== 'root' && event.len >= 4) {
      const fifth = nearest((event.chord.root + event.chord.intervals[2]) % 12, root + 5, lo, hi);
      add(event.beat + 2, rng.chance(0.25) ? root + 12 <= hi ? root + 12 : fifth : fifth, 1.4, vel * 0.86, { loose: 4 });
    }
    if (name === 'walk' && next && event.len >= 4 && rng.chance(0.6)) {
      const target = nearest(next.chord.bass, root, lo, hi);
      if (target !== root) add(event.beat + 3.5, scaleStep(tones, target, target > root ? -1 : 1), 0.45, vel * 0.7, { loose: 4 });
    }
  });
}

function percussion(ctx, name, { vel }) {
  const { section, add, rng, song } = ctx;
  const start = section.bar * 4, stop = start + section.bars * 4;
  if (name === 'brush') {
    for (let bar = 0; bar < section.bars; bar++) {
      const at = start + bar * 4;
      if (bar % 2 === 0) add(at, 36, 0.5, vel * 0.9, { loose: 3 });
      for (let step = 0; step < 8; step++) add(at + step / 2, 44, 0.25, vel * (step % 2 ? 0.2 : 0.12) * rng.range(0.85, 1.1), { loose: 5, flat: true });
      if (bar % 4 === 3) add(at + 3.5, 46, 0.5, vel * 0.2, { loose: 4 });
      if (bar % 8 === 4 && rng.chance(0.6)) add(at, 42, 0.5, vel * 0.3, { loose: 3 });
    }
  }
  if (name === 'chimes' && section.bars >= 4) add(start, 53, 2, vel * 0.42, { loose: 0, flat: true });
  if (name === 'soft') {
    for (let bar = 0; bar < section.bars; bar++) {
      if (bar % 2 === 0) add(start + bar * 4, 36, 0.5, vel, { loose: 3 });
      if (bar % 4 === 3) add(start + bar * 4 + 3.5, 42, 0.5, vel * 0.42, { loose: 3 });
      if (bar % 4 === 1 && rng.chance(0.5)) add(start + bar * 4 + 2.5, 42, 0.5, vel * 0.3, { loose: 3 });
    }
  }
  if (['soft', 'swell', 'brush', 'chimes'].includes(name)) {
    const lead = Math.round(2 * song.tempo / 60 * 2) / 2;
    if (section.bars * 4 > lead + 2) add(stop - lead, 54, lead, vel * 0.55, { loose: 0, flat: true });
  }
}

function bed(ctx, option, { vel, midi = 60 }) {
  const { section, add } = ctx;
  for (let at = 0; at < section.bars * 4; at += 16) add(section.bar * 4 + at, midi, Math.min(16, section.bars * 4 - at), vel, { loose: 0, late: 0, flat: true });
}

export function slurNotes(notes, ppq, end) {
  const ins = new Set(), outs = new Set();
  for (const n of notes) for (const m of notes) {
    if (m === n || m.tick === n.tick) continue;
    const gap = (((n.tick - m.tick - m.len) % end) + end) % end;
    if (gap <= ppq * 0.15 || gap >= end - ppq * 0.3) { ins.add(n); outs.add(m); }
  }
  for (const n of notes) {
    if (!ins.has(n) && !outs.has(n)) continue;
    n.slur = ins.has(n) && outs.has(n) ? 'both' : ins.has(n) ? 'in' : 'out';
    delete n.expression;
  }
}

const PLAYERS = { lead, counter, arpeggio, sparkle, comp, pad, bass, percussion, bed };

function sectionRoles(profile, cue, section) {
  return { ...profile.sections[section.name], ...(section.roles ?? {}) };
}

export function composeCuePart(song, id, seed, options = {}) {
  const profile = cueProfile(song.genre);
  const data = cueData(song.genre, song.cue);
  const tones = keyScale(song);
  const type = id.split('-')[0];
  const setting = { ...(profile.tracks[id] ?? profile.extra[type]), ...(data.tracks?.[id] ?? {}) };
  const track = { id, instrument: song.tracks?.find(t => t.id === id)?.instrument ?? cueInstrument(song.genre, setting.instrument, options), seed, playing: 'plain', notes: [] };
  if (id !== type) track.part = type;
  const rng = createRng(seed);
  const visits = {};
  let bar = 0;
  data.sections.forEach((chart, index) => {
    const section = { name: chart.name, bar, bars: chart.chords.length };
    bar += section.bars;
    const job = profile.tracks[id] ? sectionRoles(profile, data, chart)[id] : profile.extra[type].roles[chart.name];
    if (!job) return;
    const [player, option] = job.split(':');
    const energy = chart.energy ?? ENERGY[chart.name] ?? 0.7;
    const local = rng.fork('section/' + index);
    const occurrence = visits[job] = (visits[job] ?? -1) + 1;
    const ctx = { song, track, rng: local, section, tones, occurrence,
      events: chartEvents(chart.chords, tones, section.bar * 4), add: writer(song, track, local, section, energy) };
    const style = { ...setting, ...(setting.styles?.[player] ?? {}) };
    if (player === 'lead') {
      const theme = data.themes[option.split('@')[0]];
      const fragment = option.includes('@');
      const [from, to] = fragment ? option.split('@')[1].split('-').map(Number) : [];
      if (fragment && chart.name === 'Intro') ctx.offset = (section.bars - (to - from)) * 4;
      lead(ctx, { ...theme, vel: theme.vel ?? style.vel }, fragment ? { from, bars: to - from, octave: chart.name === 'Intro' ? 1 : 0, quiet: 0.8 } : {});
    } else if (player === 'arp') arpeggio(ctx, option, style);
    else PLAYERS[player](ctx, option ?? style, style);
  });
  track.notes.sort((a, b) => a.tick - b.tick || a.midi - b.midi);
  if (setting.legato) slurNotes(track.notes, song.ppq, song.bars * 4 * song.ppq);
  track.notes = track.notes.map((n, i) => ({ ...n, id: id + '-' + i }));
  return track;
}

function summary(data, tones, root) {
  const main = data.sections.find(s => s.name === 'Main') ?? data.sections[0];
  const chords = main.chords.slice(0, 4).map(cell => parseChord(cell.trim().split(/\s+/)[0], tones));
  const step = c => Math.max(0, tones.findIndex(t => t % 12 === c.root));
  return { root, mode: data.mode === 'minor' ? 'minor' : 'major', scale: tones, steps: chords.map(step),
    chords: chords.map(c => ({ root: nearest(c.root, root), notes: [0, 1, 2].map(i => nearest(c.pcs[i], root + [0, 4, 7][i], 48, 79)) })),
    name: KEYS[root % 12] + ' ' + data.mode };
}

export function composeCue(genre, cue, seed, { tempo = null, key = null } = {}, options = {}) {
  const profile = cueProfile(genre);
  const data = cueData(genre, cue);
  const root = 60 + (key === null ? data.key : KEYS.indexOf(key));
  const tones = scale(root, data.mode);
  const layout = cueLayout(genre, cue);
  const song = { ...createSong({ tempo: tempo ?? data.tempo, bars: layout.bars }), seed, generator: 'genre-v1', genre, cue,
    arrangement: 'composed-v1', sections: layout.sections, form: 'loop', feeling: 'cozy', use: cue === 'menu' ? 'menu' : 'sketch',
    melody: 'auto', drums: 'auto', bass: 'auto', progression: 'auto', pad: 'auto', groove: 'half-time',
    harmony: summary(data, tones, root), performance: 'instrument-v1', trackLayout: 'multi-v1' };
  const rng = createRng(seed);
  const ids = Object.keys(profile.tracks);
  song.tracks = [];
  for (const id of ids) {
    const setting = { ...profile.tracks[id], ...(data.tracks?.[id] ?? {}) };
    const track = composeCuePart({ ...song, tracks: [] }, id, rng.fork(id).seed, options);
    if (setting.effects) track.effects = structuredClone(setting.effects);
    if (track.notes.length) song.tracks.push(track);
  }
  return song;
}

export function cueMix(song) {
  const profile = cueProfile(song.genre), data = cueData(song.genre, song.cue);
  const gains = {}, pans = {};
  for (const { id } of song.tracks.filter(t => profile.tracks[t.id])) {
    const setting = { ...profile.tracks[id], ...(data.tracks?.[id] ?? {}) };
    gains[id] = setting.gain ?? 1;
    if (setting.pan) pans[id] = setting.pan;
  }
  return { muted: [], solo: [], gains, pans };
}

export const CUES = Object.fromEntries(Object.entries(CUE_PROFILES).map(([genre, p]) =>
  [genre, Object.fromEntries(Object.entries(p.cues).map(([id, c]) => [id, c.title]))]));
