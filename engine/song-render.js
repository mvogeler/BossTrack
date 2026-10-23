import { panLevels } from './song-mixer.js';
import { createKit } from './kit/index.js';
import { createRng } from './rng.js';
import { peak } from './post.js';
import { tickSample } from './song.js';
import { INSTRUMENTS, partType } from './song-instruments.js';
import { sampleVoice, sampleVoiceBlocks, recordedDrumDuration } from './song-samples.js';
import { songVoiceBlocks, songVoiceFrames } from './song-voice.js';
import { PALETTE } from './song-palette.js';
import { createSongEffects, effectFrames, effectTail } from './song-effects.js';

export function renderSongVoice(k, instrument, note, len, beatSeconds = 0.5) {
  if (note.expression === 'swell' || instrument === 'wobble' || instrument === 'chug' || Object.hasOwn(PALETTE, instrument)) {
    const voice = songVoiceBlocks(instrument, note, len, k.sr, k.rng.seed, beatSeconds);
    const out = new Float32Array(voice.frames);
    let at = 0;
    for (const [block] of voice.blocks(32768)) {
      out.set(block, at);
      at += block.length;
    }
    return out;
  }
  const hz = k.midiHz(note.midi);
  if (instrument === 'pluck' || instrument === 'pluckbass') {
    const dur = len + 0.12;
    return k.mul(k.pluck(dur, hz, { damping: instrument === 'pluck' ? 0.3 : 0.5, brightness: 0.65 }), k.env.adsr(dur, 0.002, 0.2, 0.8, 0.12));
  }
  if (instrument === 'flute') {
    const release = 0.12;
    const dur = len + release;
    const freq = k.buf(dur);
    for (let i = 0; i < freq.length; i++) {
      const t = i / k.sr;
      const depth = Math.min(1, Math.max(0, (t - 0.12) / 0.25));
      freq[i] = hz * (1 + 0.003 * depth * Math.sin(2 * Math.PI * 5 * t));
    }
    const tone = k.add(k.osc(dur, freq), k.gain(k.osc(dur, freq.map(f => f * 2)), -20));
    const breath = k.filter(k.filter(k.noise(dur, 'white'), 'hp', 1200), 'lp', 5500);
    return k.mul(k.add(tone, k.gain(breath, -30)), k.env.adsr(dur, Math.min(0.035, len * 0.3), 0.12, 0.8, release));
  }
  if (instrument === 'chip') return k.mul(k.osc(len + 0.02, hz, { type: 'pulse', pw: 0.25 }), k.env.adsr(len + 0.02, 0.002, 0.04, 0.65, 0.02));
  if (instrument === 'organ' || instrument === 'bright') {
    const short = note.articulation === 'short';
    const release = short ? 0.08 : 0.3;
    const dur = len + release;
    const tone = instrument === 'organ' ? k.add(k.osc(dur, hz), k.gain(k.osc(dur, hz * 2), -8), k.gain(k.osc(dur, hz * 3), -12)) :
      k.filter(k.add(k.osc(dur, hz * 0.997, { type: 'saw' }), k.osc(dur, hz * 1.003, { type: 'saw' })), 'lp', 3200);
    return k.mul(tone, k.env.adsr(dur, short ? 0.008 : instrument === 'organ' ? 0.01 : 0.09, 0.1, 0.7, release));
  }
  if (instrument === 'growl') return k.mul(k.filter(k.add(k.osc(len + 0.08, hz, { type: 'saw' }), k.gain(k.osc(len + 0.08, hz / 2, { type: 'square' }), -8)), 'lp', 900), k.env.adsr(len + 0.08, 0.008, 0.15, 0.65, 0.08));
  if (instrument === 'electronic' || instrument === 'chipdrums') {
    const chip = instrument === 'chipdrums';
    const kick = note.midi === 36;
    const snare = note.midi === 38;
    const dur = kick ? (chip ? 0.12 : 0.4) : snare ? 0.2 : 0.05;
    const tone = kick ? (chip ? k.osc(dur, 70, { type: 'square' }) : k.chirp(dur, 160, 38)) :
      k.filter(k.noise(dur, 'white'), 'hp', snare ? 1800 : chip ? 9000 : 11000);
    return k.mul(snare && !chip ? k.add(tone, k.gain(k.osc(dur, 220), -8)) : tone, k.env.perc(dur, 0.001, dur * 0.8));
  }
  if (instrument === 'keys') {
    const dur = len + 0.55;
    const tone = k.fm(dur, hz, { ratio: 1, index: k.env.perc(dur, 0.002, 0.3) });
    return k.mul(tone, k.env.adsr(dur, 0.005, 0.8, 0.18, 0.55));
  }
  if (instrument === 'lead') {
    const dur = len + 0.25;
    const tone = k.add(k.osc(dur, hz, { type: 'tri' }), k.gain(k.osc(dur, hz * 2), -18));
    return k.mul(tone, k.env.adsr(dur, 0.012, 0.18, 0.45, 0.25));
  }
  if (instrument === 'pad') {
    const short = note.articulation === 'short';
    const release = short ? 0.08 : 0.4;
    const a = k.osc(len + release, hz * 0.998, { type: 'tri' });
    const b = k.osc(len + release, hz * 1.002, { type: 'sine' });
    return k.mul(k.add(a, b), k.env.adsr(len + release, short ? 0.008 : 0.18, short ? Math.min(0.08, len * 0.5) : 0.5, 0.55, release));
  }
  if (instrument === 'bass') {
    return k.mul(k.add(k.osc(len, hz), k.gain(k.osc(len, hz * 2), -14)), k.env.adsr(len, 0.008, 0.2, 0.65, 0.08));
  }
  if (instrument !== 'drums') throw new Error('Unknown song instrument: ' + instrument);
  if (note.midi === 36) return k.gain(k.chirp(0.28, 135, 45), 4);
  const dur = note.midi === 38 ? 0.18 : 0.07;
  const noise = k.filter(k.noise(dur, 'white'), 'hp', note.midi === 38 ? 900 : 6500);
  const tone = note.midi === 38 ? k.add(noise, k.gain(k.osc(dur, 185), -12)) : noise;
  return k.mul(tone, k.env.perc(dur, 0.001, dur));
}

export function renderSong(song, samples = []) {
  const steps = renderSongSteps(song, samples);
  let step;
  do { step = steps.next(); } while (!step.done);
  return step.value;
}

export function* renderSongSteps(song, samples = []) {
  if (song.tracks.some(track => track.effects !== undefined)) return yield* renderEffectSongSteps(song, samples);
  const sr = song.output.sampleRate;
  const end = tickSample(song, song.bars * 4 * song.ppq);
  const looping = song.form === 'loop';
  const frames = looping ? end : end + Math.round(sr * 1.4);
  const parts = [];
  const count = song.tracks.reduce((sum, t) => sum + t.notes.length, 0);
  let done = 0;
  for (const track of song.tracks) {
    const instrument = INSTRUMENTS[track.instrument];
    if (!instrument) throw new Error('Unknown song instrument: ' + track.instrument);
    const channels = [new Float32Array(frames), new Float32Array(frames)];
    const rng = createRng(track.seed ?? 1);
    for (const note of track.notes) {
      const seed = rng.fork(track.id + '/' + note.id).int(0, 0xffffffff);
      const k = createKit({ sampleRate: sr, seed });
      const at = tickSample(song, note.tick);
      const len = (tickSample(song, note.tick + note.len) - at) / sr;
      if (instrument.range && (note.midi < instrument.range[0] || note.midi > instrument.range[1])) throw new Error(instrument.name + ' range is MIDI ' + instrument.range.join(' to '));
      const bank = instrument.sample ? samples.filter((s) => s.instrument === track.instrument) : [];
      const duration = instrument.sample && partType(track) === 'drums' && bank.length ? recordedDrumDuration(note, bank) : len;
      const signals = instrument.sample ? sampleVoice(note, duration, sr, bank) : [renderSongVoice(k, track.instrument, note, len, 60 / song.tempo)];
      const pan = instrument.pan;
      for (let c = 0; c < 2; c++) {
        const signal = signals[c % signals.length];
        const gain = instrument.level * note.vel * (c === 0 ? Math.cos((pan + 1) * Math.PI / 4) : Math.sin((pan + 1) * Math.PI / 4));
        for (let i = 0; i < signal.length && (looping || at + i < frames); i++) {
          channels[c][looping ? (at + i) % frames : at + i] += signal[i] * gain;
          if (instrument.echo) {
            const echo = at + i + Math.round(sr * 60 / song.tempo * 0.75);
            if (looping || echo < frames) channels[1 - c][looping ? echo % frames : echo] += signal[i] * gain * 0.18;
          }
        }
      }
      yield ++done / Math.max(1, count) * 0.85;
    }
    parts.push({ id: track.id, instrument: track.instrument, channels });
  }
  const channels = mixParts(parts, {}, frames);
  const gain = Math.min(1, 0.8 / (peak(channels) || 1));
  const fade = Math.round(sr * 0.25);
  for (const part of parts) for (const ch of part.channels) {
    for (let at = 0; at < frames; at += 32768) {
      for (let i = at; i < Math.min(frames, at + 32768); i++) ch[i] *= gain * (looping ? 1 : Math.min(1, (frames - 1 - i) / fade));
      yield 0.85 + (parts.indexOf(part) + (at / frames + part.channels.indexOf(ch)) / 2) / parts.length * 0.14;
    }
  }
  return { channels: mixParts(parts, {}, frames, channels), parts, sampleRate: sr, loop: looping ? { start: 0, end } : null };
}

export function mixParts(parts, { muted = [], solo = [], gains = {}, pans = {} } = {}, frames = parts[0]?.channels[0].length ?? 0, target = null) {
  const channels = target ?? [new Float32Array(frames), new Float32Array(frames)];
  channels.forEach(ch => ch.fill(0));
  for (const part of parts) {
    if (muted.includes(part.id) || (solo.length && !solo.includes(part.id))) continue;
    const gain = gains[part.id] ?? 1;
    const balance = panLevels(pans[part.id]);
    for (let c = 0; c < channels.length; c++) {
      const source = part.channels[c];
      for (let i = 0; i < source.length; i++) channels[c][i] += source[i] * gain * balance[c];
    }
  }
  return channels;
}

function blockReader(make, size, start) {
  const blocks = make().blocks(size);
  const positions = [start, start];
  const pending = [];
  let end = 0;
  return (channel, length) => {
    const at = positions[channel];
    while (end <= at) {
      const channels = blocks.next().value;
      const from = end;
      end += channels[0].length;
      if (end > start) pending.push({ channels, from, end });
    }
    while (pending[0].end <= Math.min(...positions)) pending.shift();
    const block = pending.find(block => block.end > at);
    const count = Math.min(length, block.end - at);
    positions[channel] += count;
    return { signal: block.channels[channel % block.channels.length], offset: at - block.from, count };
  };
}

function* renderRawSongBlocks(song, samples = [], { blockFrames = 32768 } = {}, mixed = true) {
  if (!Number.isInteger(blockFrames) || blockFrames < 1 || blockFrames > 65536) throw new Error('Invalid song block size');
  const sr = song.output.sampleRate;
  const end = tickSample(song, song.bars * 4 * song.ppq);
  const looping = song.form === 'loop';
  const frames = effectFrames(song);
  const tracks = song.tracks.map(track => {
    const instrument = INSTRUMENTS[track.instrument];
    if (!instrument) throw new Error('Unknown song instrument: ' + track.instrument);
    const rng = createRng(track.seed ?? 1);
    const bank = instrument.sample ? samples.filter(s => s.instrument === track.instrument) : [];
    const segments = [];
    for (const note of track.notes) {
      if (instrument.range && (note.midi < instrument.range[0] || note.midi > instrument.range[1])) throw new Error(instrument.name + ' range is MIDI ' + instrument.range.join(' to '));
      const seed = rng.fork(track.id + '/' + note.id).int(0, 0xffffffff);
      const at = tickSample(song, note.tick);
      const len = (tickSample(song, note.tick + note.len) - at) / sr;
      const duration = instrument.sample && partType(track) === 'drums' && bank.length ? recordedDrumDuration(note, bank) : len;
      const make = () => instrument.sample ? sampleVoiceBlocks(note, duration, sr, bank) : songVoiceBlocks(track.instrument, note, len, sr, seed, 60 / song.tempo);
      const count = instrument.sample ? make().frames : songVoiceFrames(track.instrument, note, len, sr);
      if (instrument.sample && !bank.length) throw new Error('Instrument samples are not loaded');
      const readers = new Map();
      for (let c = 0; c < 2; c++) {
        const gain = instrument.level * note.vel * (c === 0 ? Math.cos((instrument.pan + 1) * Math.PI / 4) : Math.sin((instrument.pan + 1) * Math.PI / 4));
        for (const echo of instrument.echo && track.effects === undefined ? [false, true] : [false]) {
          const shift = at + (echo ? Math.round(sr * 60 / song.tempo * 0.75) : 0);
          const last = looping ? count : Math.max(0, Math.min(count, frames - shift));
          for (let source = 0; source < last;) {
            const dest = looping ? (shift + source) % frames : shift + source;
            const length = Math.min(last - source, frames - dest);
            const key = echo + '/' + source;
            if (!readers.has(key)) readers.set(key, { read: null, remaining: 2 });
            segments.push({ make, c, gain, echo, dest, source, length, reader: readers.get(key) });
            source += length;
          }
        }
      }
    }
    return { id: track.id, instrument: track.instrument, segments };
  });
  for (let at = 0; at < frames; at += blockFrames) {
    const length = Math.min(blockFrames, frames - at);
    const parts = tracks.map(track => {
      const channels = [new Float32Array(length), new Float32Array(length)];
      for (const segment of track.segments) {
        const start = Math.max(at, segment.dest);
        const stop = Math.min(at + length, segment.dest + segment.length);
        if (start >= stop) continue;
        segment.reader.read ??= blockReader(segment.make, blockFrames, segment.source);
        const target = channels[segment.echo ? 1 - segment.c : segment.c];
        for (let i = start; i < stop;) {
          const { signal, offset, count } = segment.reader.read(segment.c, stop - i);
          for (let j = 0; j < count; j++) {
            const value = signal[offset + j] * segment.gain;
            target[i + j - at] += segment.echo ? value * 0.18 : value;
          }
          i += count;
        }
        if (stop === segment.dest + segment.length && --segment.reader.remaining === 0) segment.reader.read = null;
      }
      return { id: track.id, instrument: track.instrument, channels };
    });
    yield { at, channels: mixed ? mixParts(parts, {}, length) : null, parts, sampleRate: sr };
  }
  return { frames, sampleRate: sr, loop: looping ? { start: 0, end } : null,
    parts: tracks.map(({ id, instrument }) => ({ id, instrument })) };
}

export function* renderSongBlocks(song, samples = [], options = {}) {
  if (!song.tracks.some(track => track.effects !== undefined)) return yield* renderRawSongBlocks(song, samples, options);
  const sr = song.output.sampleRate;
  const processors = song.tracks.map(track => createSongEffects(track.effects, sr, song.tempo));
  if (song.form === 'loop' && song.tracks.some(track => Object.values(track.effects ?? {}).some(effect => effect.mix))) {
    let settle = effectTail(song);
    for (const track of song.tracks) {
      const delay = track.effects?.delay;
      if (delay?.mix && delay.feedback) settle = Math.max(settle, Math.ceil(Math.log(1e-7) / Math.log(delay.feedback)) * delay.beats * 60 / song.tempo);
    }
    const cycles = Math.max(1, Math.ceil(settle * sr / effectFrames(song)));
    for (let cycle = 0; cycle < cycles; cycle++) {
      processors.forEach(process => process.resetCycle());
      for (const block of renderRawSongBlocks(song, samples, options, false)) block.parts.forEach((part, p) => processors[p](part.channels));
    }
    processors.forEach(process => process.resetCycle());
  }
  const steps = renderRawSongBlocks(song, samples, options, false);
  let step;
  while (!(step = steps.next()).done) {
    const block = step.value;
    block.parts.forEach((part, p) => processors[p](part.channels));
    block.channels = mixParts(block.parts, {}, block.parts[0].channels[0].length);
    yield block;
  }
  return step.value;
}

function* renderEffectSongSteps(song, samples) {
  const frames = effectFrames(song);
  const sr = song.output.sampleRate;
  const looping = song.form === 'loop';
  const parts = song.tracks.map(({ id, instrument }) => ({ id, instrument, channels: [new Float32Array(frames), new Float32Array(frames)] }));
  let high = 0;
  for (const block of renderSongBlocks(song, samples)) {
    block.parts.forEach((part, p) => part.channels.forEach((ch, c) => parts[p].channels[c].set(ch, block.at)));
    high = Math.max(high, peak(block.channels));
    yield block.at / frames * 0.85;
  }
  const gain = Math.min(1, 0.8 / (high || 1));
  const fade = Math.round(sr * 0.25);
  for (const part of parts) for (const ch of part.channels) {
    for (let at = 0; at < frames; at += 32768) {
      for (let i = at; i < Math.min(frames, at + 32768); i++) ch[i] *= gain * (looping ? 1 : Math.min(1, (frames - 1 - i) / fade));
      yield 0.85;
    }
  }
  return { channels: mixParts(parts, {}, frames), parts, sampleRate: sr,
    loop: looping ? { start: 0, end: frames } : null };
}
