export function exportFrames(sourceFrames, sampleRate, seconds = null) {
  if (seconds === null) return sourceFrames;
  if (!Number.isFinite(seconds) || seconds < 1 || seconds > 900) throw new Error('Export duration must be between 1 and 900 seconds');
  return Math.round(seconds * sampleRate);
}

export function exportReader(read, sourceFrames, targetFrames, sampleRate, seconds = null) {
  const end = Math.min(sourceFrames, targetFrames);
  const fade = Math.min(end, Math.round(sampleRate * 0.5));
  return async (at, count) => {
    const size = Math.min(count, targetFrames - at);
    const channels = [new Float32Array(size), new Float32Array(size)];
    const available = Math.max(0, Math.min(size, sourceFrames - at));
    if (available) {
      const source = await read(at, available);
      for (let c = 0; c < 2; c++) channels[c].set(source[c]);
    }
    if (seconds !== null || targetFrames !== sourceFrames) {
      for (let i = 0; i < size; i++) {
        const gain = Math.max(0, Math.min(1, (end - 1 - at - i) / fade));
        for (const ch of channels) ch[i] *= gain;
      }
    }
    return channels;
  };
}

export function exportLoop(loop, sourceFrames, targetFrames, seconds = null) {
  return seconds === null && targetFrames === sourceFrames ? loop : null;
}
