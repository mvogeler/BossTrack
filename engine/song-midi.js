import { INSTRUMENTS, partType } from './song-instruments.js';

const text = value => Array.from(value, c => c.charCodeAt(0) < 128 ? c.charCodeAt(0) : 63);
const be = (n, bytes) => Array.from({ length: bytes }, (_, i) => (n >>> ((bytes - i - 1) * 8)) & 255);
function variable(n) {
  const bytes = [n & 127];
  while ((n = Math.floor(n / 128))) bytes.unshift((n & 127) | 128);
  return bytes;
}
const meta = (type, bytes) => [255, type, ...variable(bytes.length), ...bytes];
function chunk(events, end) {
  events.sort((a, b) => a.tick - b.tick || a.order - b.order);
  const bytes = []; let tick = 0;
  for (const event of events) { bytes.push(...variable(event.tick - tick), ...event.bytes); tick = event.tick; }
  bytes.push(...variable(end - tick), 255, 47, 0);
  return [...text('MTrk'), ...be(bytes.length, 4), ...bytes];
}
function program(id, part) {
  const name = INSTRUMENTS[id].name.toLowerCase();
  for (const [word, value] of [['French horn', 60], ['horn', 60], ['trumpet', 56], ['trombone', 57], ['tuba', 58], ['violin', 48], ['cello', 42], ['oboe', 68], ['clarinet', 71], ['bassoon', 70], ['ocarina', 79], ['harmonica', 22], ['strumstick', 25], ['đàn tranh', 107], ['psaltery', 110], ['mbira', 108], ['marimba', 12], ['vibraphone', 11], ['celesta', 8], ['music box', 10], ['harp', 46], ['flute', 73], ['brass', 61], ['string', 48], ['organ', 16], ['rhodes', 4], ['electric piano', 4], ['piano', 0], ['nylon', 24], ['acoustic guitar', 25], ['jazz guitar', 26], ['muted', 28], ['heavy', 30], ['distort', 30], ['driven', 29], ['guitar', 27], ['bell', 14]]) if (name.includes(word)) return value;
  return part === 'bass' ? (name.includes('acoustic') ? 32 : 38) : part === 'pad' ? 89 : 81;
}

export function encodeSongMidi(song) {
  const end = song.bars * 4 * song.ppq;
  const events = [{ tick: 0, order: 0, bytes: meta(3, text('BossTrack')) },
    { tick: 0, order: 0, bytes: meta(81, be(Math.round(60000000 / song.tempo), 3)) },
    { tick: 0, order: 0, bytes: meta(88, [4, 2, 24, 8]) }];
  const major = { C: 0, 'C#': -5, D: 2, 'D#': -3, E: 4, F: -1, 'F#': 6, G: 1, 'G#': -4, A: 3, 'A#': -2, B: 5 };
  const minor = { C: -3, 'C#': 4, D: -1, 'D#': 6, E: 1, F: -4, 'F#': 3, G: -2, 'G#': 5, A: 0, 'A#': -5, B: 2 };
  const key = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'][song.harmony?.root % 12], isMinor = song.harmony?.mode === 'minor';
  if (Object.hasOwn(major, key)) events.push({ tick: 0, order: 0, bytes: meta(89, [(isMinor ? minor : major)[key] & 255, +isMinor]) });
  const chunks = [chunk(events, end)]; let pitched = 0;
  for (const track of song.tracks) {
    const part = partType(track), channel = part === 'drums' ? 9 : pitched++;
    const list = [{ tick: 0, order: 0, bytes: meta(3, text(track.id + ' - ' + INSTRUMENTS[track.instrument].name)) }];
    if (part !== 'drums') list.push({ tick: 0, order: 0, bytes: [192 | channel, program(track.instrument, part)] });
    const pitches = new Map();
    for (const note of track.notes) {
      if (!note.vel) continue;
      if (!pitches.has(note.midi)) pitches.set(note.midi, []);
      pitches.get(note.midi).push(note);
    }
    for (const [midi, notes] of pitches) {
      notes.sort((a, b) => a.tick - b.tick);
      const spans = [];
      for (const note of notes) {
        const last = spans.at(-1), stop = Math.min(end, note.tick + note.len);
        if (last && note.tick < last.end) { last.end = Math.max(last.end, stop); last.vel = Math.max(last.vel, note.vel); }
        else spans.push({ tick: note.tick, end: stop, vel: note.vel });
      }
      for (const span of spans) {
        list.push({ tick: span.tick, order: 2, bytes: [144 | channel, midi, Math.max(1, Math.round(span.vel * 127))] });
        list.push({ tick: span.end, order: 1, bytes: [128 | channel, midi, 0] });
      }
    }
    chunks.push(chunk(list, end));
  }
  const header = [...text('MThd'), ...be(6, 4), ...be(1, 2), ...be(chunks.length, 2), ...be(song.ppq, 2)];
  const result = new Uint8Array(header.length + chunks.reduce((n, c) => n + c.length, 0));
  result.set(header); let offset = header.length;
  for (const bytes of chunks) { result.set(bytes, offset); offset += bytes.length; }
  return result;
}
