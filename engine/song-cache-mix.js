export function normalizePreviewBlock(pcm, start, { frames, sampleRate, loop, gain }) {
  const count = pcm.length / 2;
  const channels = [new Float32Array(count), new Float32Array(count)];
  const fade = Math.round(sampleRate * 0.25);
  for (let i = 0; i < count; i++) {
    const level = gain * (loop ? 1 : Math.min(1, (frames - 1 - start - i) / fade));
    channels[0][i] = pcm[i * 2] * level;
    channels[1][i] = pcm[i * 2 + 1] * level;
  }
  return channels;
}
