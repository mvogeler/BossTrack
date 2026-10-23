export function chooseSample(note, samples) {
  if (!samples?.length) throw new Error('Instrument samples are not loaded');
  if (samples[0].articulation === undefined) return samples.reduce((best, s) => Math.abs(s.root - note.midi) < Math.abs(best.root - note.midi) ? s : best);
  const wanted = note.articulation === 'short' ? 'short' : 'sustain';
  let candidates = samples.filter(s => s.articulation === wanted);
  if (!candidates.length) candidates = samples;
  const root = candidates.reduce((best, s) => Math.abs(s.root - note.midi) < Math.abs(best.root - note.midi) ? s : best).root;
  candidates = candidates.filter(s => s.root === root);
  const layers = [...new Set(candidates.map(s => s.velocity))];
  const velocity = layers.reduce((best, v) => Math.abs(v - (note.vel ?? 0.7)) < Math.abs(best - (note.vel ?? 0.7)) ? v : best);
  const takes = candidates.filter(s => s.velocity === velocity);
  let hash = 0;
  for (const char of note.id ?? String(note.tick ?? 0)) hash = (Math.imul(hash, 31) + char.charCodeAt(0)) >>> 0;
  return takes[hash % takes.length];
}

export function recordedDrumDuration(note, samples) {
  if (samples[0].articulation === undefined) return Math.max(...samples.map(s => s.channels[0].length / s.sampleRate));
  const sample = chooseSample(note, samples);
  return sample.channels[0].length / sample.sampleRate / 2 ** ((note.midi - sample.root) / 12);
}

export function sampleVoice(note, len, sr, samples) {
  const voice = sampleVoiceBlocks(note, len, sr, samples);
  const channels = Array.from({ length: voice.channels }, () => new Float32Array(voice.frames));
  let at = 0;
  for (const block of voice.blocks(32768)) {
    block.forEach((ch, c) => channels[c].set(ch, at));
    at += block[0].length;
  }
  return channels;
}

export function sampleVoiceBlocks(note, len, sr, samples) {
  if (!samples?.length) throw new Error('Instrument samples are not loaded');
  const sample = chooseSample(note, samples);
  const step = sample.sampleRate / sr * 2 ** ((note.midi - sample.root) / 12);
  const loop = sample.loop;
  const into = loop && (note.slur === 'in' || note.slur === 'both');
  const onward = note.slur === 'out' || note.slur === 'both';
  const release = note.articulation === 'short' ? 0.08 : onward ? Math.min(0.16, sample.release ?? 0.25) : sample.release ?? 0.25;
  const fade = into ? 0.09 : 0.003;
  const frames = Math.round((len + release) * sr);
  function* blocks(size) {
    if (!Number.isInteger(size) || size < 1) throw new Error('Invalid sample block size');
    let pos = into ? loop.start : 0;
    for (let start = 0; start < frames; start += size) {
      const channels = sample.channels.map(() => new Float32Array(Math.min(size, frames - start)));
      for (let j = 0; j < channels[0].length; j++) {
        const i = start + j;
        if (loop && pos > loop.end) pos = loop.start + (pos - loop.start) % (loop.end - loop.start + 1);
        const at = Math.floor(pos);
        const next = loop && at === loop.end ? loop.start : at + 1;
        const fraction = pos - at;
        const swell = note.expression === 'swell' ? 0.58 + 0.42 * Math.sin(Math.PI * Math.min(1, i / (sr * Math.max(len, 0.001)))) : 1;
        const gain = Math.min(1, i / (sr * fade)) * Math.min(1, (frames - 1 - i) / (sr * release)) * swell;
        for (let c = 0; c < channels.length; c++) {
          const source = sample.channels[c];
          channels[c][j] = ((source[at] ?? 0) + ((source[next] ?? 0) - (source[at] ?? 0)) * fraction) * gain;
        }
        pos += step;
      }
      yield channels;
    }
  }
  return { frames, channels: sample.channels.length, blocks };
}
