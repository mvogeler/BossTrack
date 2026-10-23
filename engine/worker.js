import { renderSongSteps, renderSongBlocks } from './song-render.js';
import { tickSample } from './song.js';
import { effectFrames } from './song-effects.js';
import { peak } from './post.js';
import { integratedLoudness, createLoudnessMeter } from './song-loudness.js';
import { addInstruments } from './song-instruments.js';
const acknowledgments = new Map();
const meters = new Map();

function envelope(frames) {
  const bins = Math.min(16384, frames);
  return { mins: [new Float32Array(bins), new Float32Array(bins)], maxs: [new Float32Array(bins), new Float32Array(bins)] };
}

function addPeaks(target, channels, at, frames, fade) {
  const bins = target.mins[0].length;
  for (let i = 0; i < channels[0].length; i++) {
    const bin = Math.floor((at + i) * bins / frames);
    const gain = fade ? Math.min(1, (frames - 1 - at - i) / fade) : 1;
    for (let c = 0; c < 2; c++) {
      const x = channels[c][i] * gain;
      target.mins[c][bin] = Math.min(target.mins[c][bin], x);
      target.maxs[c][bin] = Math.max(target.maxs[c][bin], x);
    }
  }
}

async function cachedSong(id, patch, samples) {
  const sampleRate = patch.output.sampleRate;
  const end = tickSample(patch, patch.bars * 4 * patch.ppq);
  const loop = patch.form === 'loop' ? { start: 0, end } : null;
  const frames = effectFrames(patch);
  const parts = patch.tracks.map(t => ({ id: t.id, instrument: t.instrument, envelope: envelope(frames) }));
  const mixEnvelope = envelope(frames);
  const fade = loop ? 0 : Math.round(sampleRate * 0.25);
  let maximum = 0;
  for (const block of renderSongBlocks(patch, samples, { blockFrames: 65536 })) {
    maximum = Math.max(maximum, peak(block.channels));
    const progress = (block.at + block.channels[0].length) / frames;
    addPeaks(mixEnvelope, block.channels, block.at, frames, fade);
    for (const part of block.parts) addPeaks(parts.find(p => p.id === part.id).envelope, part.channels, block.at, frames, fade);
    const buffers = [...block.channels, ...block.parts.flatMap(p => p.channels)].map(ch => ch.buffer);
    const ack = new Promise((resolve, reject) => acknowledgments.set(id, { resolve, reject }));
    self.postMessage({ id, block }, buffers);
    await ack;
    self.postMessage({ id, progress });
  }
  const gain = Math.min(1, 0.8 / (maximum || 1));
  for (const item of [mixEnvelope, ...parts.map(p => p.envelope)]) for (const ch of [...item.mins, ...item.maxs]) {
    for (let i = 0; i < ch.length; i++) ch[i] *= gain;
  }
  self.postMessage({ id, cached: true, frames, sampleRate, loop, parts, envelope: mixEnvelope, gain });
}

self.onmessage = async ({ data: { id, patch, samples, measure, cached, ack, error, meter, instruments } }) => {
  if (instruments) { addInstruments(instruments); return; }
  if (ack) {
    const waiting = acknowledgments.get(id);
    acknowledgments.delete(id);
    if (error) waiting?.reject(new Error(error));
    else waiting?.resolve();
    return;
  }
  try {
    if (meter) {
      if (meter.start) meters.set(id, createLoudnessMeter(2, meter.sampleRate));
      else if (meter.abort) meters.delete(id);
      else {
        const current = meters.get(id);
        if (!current) throw new Error('Loudness measurement is no longer available');
        if (meter.channels) current.push(meter.channels);
        else {
          meters.delete(id);
          self.postMessage({ id, ...current.read() });
          return;
        }
      }
      self.postMessage({ id, ready: true });
      return;
    }
    if (cached) { await cachedSong(id, patch, samples); return; }
    if (measure) {
      self.postMessage({ id, lufs: integratedLoudness(measure.channels, measure.sampleRate), peak: peak(measure.channels) });
      return;
    }
    const steps = renderSongSteps(patch, samples);
    let step, last = 0;
    do {
      step = steps.next();
      if (!step.done && performance.now() - last > 40) {
        self.postMessage({ id, progress: step.value });
        await new Promise(resolve => setTimeout(resolve, 0));
        last = performance.now();
      }
    } while (!step.done);
    const { channels, sampleRate, loop, parts } = step.value;
    const buffers = [...channels, ...(parts ?? []).flatMap((part) => part.channels)].map((ch) => ch.buffer);
    self.postMessage({ id, channels, sampleRate, loop, parts }, buffers);
  } catch (err) {
    self.postMessage({ id, error: err.message });
  }
};
