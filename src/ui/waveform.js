import { position } from '../audio/player.js';

export function createWaveform(canvas, { combine = false, onSeek = null } = {}) {
  const g = canvas.getContext('2d');
  const peaks = document.createElement('canvas');
  let channels = null;
  let gain = 1;
  let frame = null;
  let start = 0, end = 1;

  function drawPeaks() {
    const dpr = window.devicePixelRatio || 1;
    const w = Math.round(canvas.clientWidth * dpr);
    const h = Math.round(canvas.clientHeight * dpr);
    canvas.width = peaks.width = w;
    canvas.height = peaks.height = h;
    const pg = peaks.getContext('2d');
    pg.clearRect(0, 0, w, h);
    if (!channels) return;

    const sources = channels.mins ? channels.mins : channels;
    const lanes = combine ? [sources.map((_, c) => c)] : sources.map((_, c) => [c]);
    const lane = h / lanes.length;
    const len = sources[0].length;
    pg.fillStyle = getComputedStyle(canvas).getPropertyValue('--accent');
    lanes.forEach((indices, c) => {
      const mid = lane * c + lane / 2;
      for (let x = 0; x < w; x++) {
        const from = Math.floor((start + (x / w) * (end - start)) * len);
        const to = Math.min(len, Math.max(from + 1, Math.floor((start + ((x + 1) / w) * (end - start)) * len)));
        let lo = 0;
        let hi = 0;
        for (const c of indices) for (let i = from; i < to; i++) {
          lo = Math.min(lo, sources[c][i]);
          hi = Math.max(hi, channels.maxs ? channels.maxs[c][i] : sources[c][i]);
        }
        pg.fillRect(x, mid - hi * gain * (lane / 2 - 2), 1, Math.max(1, (hi - lo) * gain * (lane / 2 - 2)));
      }
    });
  }

  function draw() {
    g.clearRect(0, 0, canvas.width, canvas.height);
    g.drawImage(peaks, 0, 0);
    const p = position();
    if (p !== null && p >= start && p <= end) {
      g.fillStyle = getComputedStyle(canvas).getPropertyValue('--text');
      g.fillRect(Math.round((p - start) / (end - start) * (canvas.width - 1)), 0, Math.max(1, window.devicePixelRatio || 1), canvas.height);
    }
  }

  function tick() {
    frame = null;
    draw();
    if (position() !== null) frame = requestAnimationFrame(tick);
  }

  const observer = new ResizeObserver(() => {
    drawPeaks();
    draw();
  });
  observer.observe(canvas);

  function seek(event) {
    if (!channels || !onSeek) return;
    const bounds = canvas.getBoundingClientRect();
    onSeek(start + Math.max(0, Math.min(1, (event.clientX - bounds.left) / bounds.width)) * (end - start));
  }
  if (onSeek) canvas.addEventListener('click', seek);

  return {
    setView(from, to) {
      start = from;
      end = to;
      drawPeaks();
      draw();
    },
    show(next, level = 1) {
      channels = next;
      gain = level;
      drawPeaks();
      draw();
    },
    animate() { if (frame === null) frame = requestAnimationFrame(tick); },
    destroy() { observer.disconnect(); cancelAnimationFrame(frame); canvas.removeEventListener('click', seek); },
  };
}
