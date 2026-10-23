import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createDemoSong } from '../engine/song.js';
import { encodeSongMidi } from '../engine/song-midi.js';

function decode(bytes) {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const tracks = []; let at = 14;
  while (at < bytes.length) {
    assert.equal(String.fromCharCode(...bytes.subarray(at, at + 4)), 'MTrk');
    const end = at + 8 + view.getUint32(at + 4); at += 8;
    const events = []; let tick = 0;
    const variable = () => { let n = 0, b; do { b = bytes[at++]; n = n * 128 + (b & 127); } while (b & 128); return n; };
    while (at < end) {
      tick += variable(); const status = bytes[at++];
      if (status === 255) { const type = bytes[at++], size = variable(); events.push({ tick, type, data: [...bytes.subarray(at, at + size)] }); at += size; }
      else { const size = (status & 240) === 192 ? 1 : 2; events.push({ tick, status, data: [...bytes.subarray(at, at + size)] }); at += size; }
    }
    assert.equal(at, end); tracks.push(events);
  }
  return tracks;
}
test('MIDI preserves ticks, tempo, channels and aligned ends', () => {
  const song = createDemoSong(); song.harmony = { root: 61, mode: 'minor' };
  const bytes = encodeSongMidi(song), tracks = decode(bytes);
  assert.equal(new DataView(bytes.buffer).getUint16(8), 1);
  assert.equal(new DataView(bytes.buffer).getUint16(12), 960);
  assert.equal(tracks.length, 5);
  assert.deepEqual(tracks[0].find(e => e.type === 89).data, [4, 1]);
  const tempo = tracks[0].find(e => e.type === 81).data.reduce((n, b) => n * 256 + b, 0);
  assert.equal(tempo, Math.round(60000000 / song.tempo));
  tracks.forEach(track => assert.equal(track.at(-1).tick, 15360));
  song.tracks.forEach((track, i) => {
    const on = tracks[i + 1].filter(e => (e.status & 240) === 144);
    assert.equal(on.length, track.notes.length);
    assert.equal(on[0].status & 15, i === 3 ? 9 : i);
    assert.deepEqual(on.map(e => e.tick), track.notes.map(n => n.tick).sort((a, b) => a - b));
  });
  assert.deepEqual(encodeSongMidi(song), bytes);
});
test('overlapping same pitches merge while adjacent hits retrigger', () => {
  const song = createDemoSong(); song.tracks = [song.tracks[0]];
  song.tracks[0].notes = [{ tick: 0, len: 960, midi: 60, vel: .5 }, { tick: 480, len: 960, midi: 60, vel: .8 }, { tick: 1440, len: 240, midi: 60, vel: .7 }];
  const events = decode(encodeSongMidi(song))[1].filter(e => (e.status & 224) === 128);
  assert.deepEqual(events.map(e => [e.tick, e.status & 240]), [[0, 144], [1440, 128], [1440, 144], [1680, 128]]);
});
test('eight independently named parts keep pitched channels away from percussion', () => {
  const song = createDemoSong();
  const drums = song.tracks[3], keys = song.tracks[0];
  song.tracks = [{ ...drums, id: 'drums-1', part: 'drums' }, ...Array.from({ length: 7 }, (_, i) => ({ ...keys, id: 'keys-' + (i + 1), part: 'keys' }))];
  const tracks = decode(encodeSongMidi(song)).slice(1);
  assert.deepEqual(tracks.map(events => events.find(e => (e.status & 240) === 144).status & 15), [9, 0, 1, 2, 3, 4, 5, 6]);
  for (const [i, events] of tracks.entries()) assert.ok(String.fromCharCode(...events.find(e => e.type === 3).data).startsWith(song.tracks[i].id));
});
