let worker;
const pending = new Map();
let nextId = 0;
let instruments = null;

function startWorker() {
  worker = new Worker(new URL('../../engine/worker.js', import.meta.url), { type: 'module' });
  if (instruments) worker.postMessage({ instruments });
  worker.onmessage = ({ data }) => {
    const job = pending.get(data.id);
    if (!job) return;
    if (data.block) {
      const source = worker;
      Promise.resolve().then(() => job.onBlock(data.block)).then(
        () => { if (source === worker) source.postMessage({ id: data.id, ack: true }); },
        err => { if (source === worker) source.postMessage({ id: data.id, ack: true, error: err.message }); },
      );
      return;
    }
    if (data.progress !== undefined) { job.progress?.(data.progress); return; }
    pending.delete(data.id);
    if (data.error) job.reject(new Error(data.error));
    else if (data.ready) job.resolve();
    else if (data.cached) job.resolve(data);
    else if (data.lufs !== undefined) job.resolve({ lufs: data.lufs, peak: data.peak });
    else job.resolve({ channels: data.channels, sampleRate: data.sampleRate, loop: data.loop, parts: data.parts });
  };

  worker.onerror = (e) => {
    for (const job of pending.values()) job.reject(new Error(e.message || 'Render worker failed to load'));
    pending.clear();
  };
}
startWorker();

export function sendInstruments(file) {
  instruments = file;
  worker.postMessage({ instruments });
}

export function cancelRender() {
  worker.terminate();
  for (const job of pending.values()) job.reject(new Error('Rendering canceled'));
  pending.clear();
  startWorker();
}

export function render(patch, samples = [], progress = null) {
  return new Promise((resolve, reject) => {
    const id = nextId++;
    pending.set(id, { resolve, reject, progress });
    worker.postMessage({ id, patch, samples });
  });
}

export function renderCached(patch, samples, onBlock, progress = null) {
  return new Promise((resolve, reject) => {
    const id = nextId++;
    pending.set(id, { resolve, reject, progress, onBlock });
    worker.postMessage({ id, patch, samples, cached: true });
  });
}

export function measureLoudness(channels, sampleRate) {
  return new Promise((resolve, reject) => {
    const id = nextId++;
    pending.set(id, { resolve, reject });
    worker.postMessage({ id, measure: { channels, sampleRate } });
  });
}

export async function measureStream(read, frames, sampleRate) {
  const source = worker, id = nextId++;
  function send(meter, buffers = []) {
    if (source !== worker) throw new Error('Rendering canceled');
    return new Promise((resolve, reject) => {
      pending.set(id, { resolve, reject });
      source.postMessage({ id, meter }, buffers);
    });
  }
  try {
    await send({ start: true, sampleRate });
    for (let at = 0; at < frames; at += 65536) {
      const channels = await read(at, Math.min(65536, frames - at));
      await send({ channels }, channels.map(ch => ch.buffer));
    }
    return await send({ end: true });
  } finally {
    if (source === worker) source.postMessage({ id, meter: { abort: true } });
  }
}
