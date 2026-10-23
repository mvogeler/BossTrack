let ctx = null;
let current = null;

export function play(channels, sampleRate, { loop = false, offset = 0 } = {}) {
  ctx ??= new AudioContext();
  const buffer = ctx.createBuffer(channels.length, channels[0].length, sampleRate);
  channels.forEach((ch, i) => buffer.copyToChannel(ch, i));
  stop();
  const src = ctx.createBufferSource();
  src.buffer = buffer;
  src.loop = loop;
  src.connect(ctx.destination);
  src.onended = () => {
    if (current?.src === src) current = null;
  };
  const start = Math.max(0, Math.min(offset, buffer.duration - 1 / sampleRate));
  src.start(0, start);
  current = { src, startedAt: ctx.currentTime - start, duration: buffer.duration };
}

export function stop() {
  if (current?.sources) {
    clearTimeout(current.timer);
    for (const src of current.sources) src.stop();
  } else current?.src.stop();
  current = null;
}

export function setLoop(on) {
  if (current?.sources) {
    const state = current, offset = position() * state.duration;
    playStream(state.read, state.frames, state.sampleRate, { loop: on, offset, onError: state.onError });
  }
  else if (current) current.src.loop = on;
}

export function position() {
  if (!current) return null;
  const t = ctx.currentTime - current.startedAt;
  return (current.sources ? current.loop : current.src.loop) ? (Math.max(0, t) % current.duration) / current.duration : Math.max(0, Math.min(1, t / current.duration));
}

export async function playStream(read, frames, sampleRate, { loop = false, offset = 0, onError = null } = {}) {
  ctx ??= new AudioContext();
  stop();
  const start = Math.floor(Math.max(0, Math.min(offset * sampleRate, frames - 1)));
  const state = { sources: new Set(), read, frames, sampleRate, onError, loop, duration: frames / sampleRate,
    startedAt: ctx.currentTime + 0.08 - start / sampleRate, next: ctx.currentTime + 0.08, at: start };
  current = state;
  async function fill() {
    try {
      while (current === state && state.next < ctx.currentTime + 2) {
        if (state.at === frames) {
          if (!state.loop) break;
          state.at = 0;
        }
        const size = Math.min(65536, frames - state.at);
        const channels = await read(state.at, size);
        if (current !== state) return;
        if (state.next < ctx.currentTime + 0.02) {
          const delay = ctx.currentTime + 0.04 - state.next;
          state.next += delay; state.startedAt += delay;
        }
        const buffer = ctx.createBuffer(2, size, sampleRate);
        channels.forEach((ch, c) => buffer.copyToChannel(ch, c));
        const src = ctx.createBufferSource();
        src.buffer = buffer; src.connect(ctx.destination);
        state.sources.add(src);
        src.onended = () => {
          state.sources.delete(src);
          if (current === state && !state.sources.size && state.at === frames && !state.loop) stop();
        };
        src.start(state.next);
        state.next += size / sampleRate; state.at += size;
      }
      if (current === state) state.timer = setTimeout(fill, 100);
    } catch (err) {
      if (current === state) { stop(); onError?.(err); }
    }
  }
  await fill();
}
