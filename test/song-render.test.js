import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createDemoSong, tickSample } from '../engine/song.js';
import { renderSong } from '../engine/song-render.js';
import { encodeWav } from '../engine/wav.js';

test('demo renders deterministic stereo with headroom and a release tail', () => {
  const song = createDemoSong();
  const before = JSON.stringify(song);
  const a = renderSong(song);
  const b = renderSong(JSON.parse(before));
  assert.equal(JSON.stringify(song), before);
  assert.equal(a.sampleRate, 48000);
  assert.equal(a.loop, null);
  assert.equal(a.channels.length, 2);
  const expected = tickSample(song, 16 * song.ppq) + 67200;
  for (let c = 0; c < 2; c++) {
    assert.equal(a.channels[c].length, expected);
    assert.deepEqual(a.channels[c], b.channels[c]);
    assert.ok(a.channels[c].every((v) => Number.isFinite(v) && Math.abs(v) <= 0.801));
    assert.equal(a.channels[c][0], 0);
    assert.equal(a.channels[c].at(-1), 0);
    const rms = Math.sqrt(a.channels[c].reduce((sum, v) => sum + v * v, 0) / expected);
    assert.ok(rms > 0.02 && rms < 0.3);
  }
  assert.notDeepEqual(a.channels[0], a.channels[1]);
  const bytes = encodeWav(a.channels, a.sampleRate, { bitDepth: 24 });
  const wav = new DataView(bytes.buffer);
  assert.equal(wav.getUint16(22, true), 2);
  assert.equal(wav.getUint32(24, true), 48000);
  assert.equal(wav.getUint16(34, true), 24);
  assert.equal(wav.getUint32(40, true), expected * 6);
});

test('a keys change leaves the isolated bass and drums audio untouched', async () => {
  const { createProceduralSong, rerollPart } = await import('../engine/song-compose.js');
  const song = createProceduralSong(42);
  const next = rerollPart(song, 'keys', 1234);
  const rhythmOnly = (s) => ({ ...s, tracks: s.tracks.filter((t) => t.id === 'bass' || t.id === 'drums') });
  assert.deepEqual(renderSong(rhythmOnly(song)).channels, renderSong(rhythmOnly(next)).channels);
  const a = renderSong(song);
  const b = renderSong(next);
  assert.notDeepEqual(a.channels, b.channels);
  assert.deepEqual(a.channels, renderSong(createProceduralSong(42)).channels);
});
