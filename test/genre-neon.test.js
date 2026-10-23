import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createProceduralSong, rerollPart } from '../engine/song-compose.js';
import { fillNeon, neonGroove, NEON_KICKS } from '../engine/genre-neon.js';
import { createSongEffects, validEffects } from '../engine/song-effects.js';

const keys = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
const sketch = (seed, key = 'A', mode = 'minor') =>
  createProceduralSong(seed, 'neutral', 'sketch', 'sketch', 'original', 'original', 'original', 'original', 'original', null, 100, key, mode);

function phrase(song, id, seed) {
  const track = { id, seed, notes: [] };
  fillNeon(song, track);
  return track.notes;
}

test('neon keeps bounded tonal performances across all keys and modes', () => {
  for (const key of keys) for (const mode of ['major', 'minor']) for (let seed = 1; seed <= 8; seed++) {
    const song = sketch(seed, key, mode);
    const before = JSON.stringify(song);
    for (const id of ['keys', 'pad', 'bass', 'drums']) {
      const notes = phrase(song, id, seed);
      assert.deepEqual(notes, phrase(song, id, seed));
      assert.ok(notes.length > 0);
      for (const note of notes) {
        assert.ok(note.tick >= 0 && note.len > 0 && note.tick + note.len <= 16 * song.ppq);
        assert.ok(note.vel > 0 && note.vel <= 1);
        if (id === 'drums') assert.ok([36, 38, 39, 42, 46, 49].includes(note.midi));
        else {
          const [lo, hi] = { keys: [48, 84], pad: [24, 96], bass: [28, 68] }[id];
          assert.ok(note.midi >= lo && note.midi <= hi);
          assert.ok(song.harmony.scale.some(n => (n - note.midi) % 12 === 0));
        }
      }
    }
    assert.equal(JSON.stringify(song), before);
  }
});

test('neon seeds vary the hook and backing at fixed harmony', () => {
  const song = sketch(42);
  const melodies = new Set(), backing = new Set(), bass = new Set();
  for (let seed = 1; seed <= 100; seed++) {
    melodies.add(JSON.stringify(phrase(song, 'keys', seed).map(n => [n.tick, n.len, n.midi])));
    backing.add(JSON.stringify(phrase(song, 'pad', seed).map(n => [n.tick, n.len])));
    bass.add(JSON.stringify(phrase(song, 'bass', seed).map(n => [n.tick, n.midi])));
  }
  assert.ok(melodies.size >= 30, 'melody variety ' + melodies.size);
  assert.ok(backing.size >= 3, 'backing variety ' + backing.size);
  assert.ok(bass.size >= 10, 'bass variety ' + bass.size);
});

test('neon kicks follow the song groove so bass rerolls stay locked to the drums', () => {
  const grooves = new Set();
  for (let seed = 1; seed <= 30; seed++) {
    const song = sketch(seed), groove = neonGroove(song);
    grooves.add(groove);
    for (const drumSeed of [seed, seed + 1000]) {
      const kicks = phrase(song, 'drums', drumSeed).filter(n => n.midi === 36 && n.tick < 4 * song.ppq).map(n => n.tick / song.ppq);
      assert.deepEqual(kicks, NEON_KICKS[groove]);
    }
    const snares = phrase(song, 'drums', seed).filter(n => n.midi === 38 && n.tick % song.ppq === 0).map(n => n.tick / song.ppq);
    assert.deepEqual(snares, [1, 3, 5, 7, 9, 11, 13, 15]);
  }
  assert.equal(grooves.size, Object.keys(NEON_KICKS).length);
  for (const id of ['keys', 'drums']) assert.ok(phrase({ ...sketch(42), use: 'menu' }, id, 42).length < phrase(sketch(42), id, 42).length);
});

test('the neon genre ships its voices and pumping effects, and rerolls keep them', () => {
  const song = createProceduralSong(42, 'neutral', 'sketch', 'loop', 'auto', 'auto', 'auto', 'auto', 'auto', null, null, null, null, 'neon');
  assert.equal(song.tempo, 128);
  assert.deepEqual(song.tracks.map(t => t.instrument), ['neon_lead', 'neon_chords', 'neon_bass', 'drums_neon']);
  const pad = song.tracks.find(t => t.id === 'pad');
  assert.deepEqual(pad.effects.pump, { mix: 0.6, beats: 1, release: 0.7 });
  assert.ok(song.tracks.every(t => t.effects === undefined || validEffects(t.effects)));
  const changed = rerollPart(song, 'pad', 7);
  assert.deepEqual(changed.tracks.find(t => t.id === 'pad').effects, pad.effects);
});

test('pump ducks on the beat, recovers before the next one and matches across block sizes', () => {
  const sr = 4000, tempo = 120, beat = sr / 2;
  assert.ok(validEffects({ pump: { mix: 0.6, beats: 1, release: 0.7 } }));
  for (const bad of [{ pump: { mix: 1, beats: 3, release: 0.5 } }, { pump: { mix: 1, beats: 1 } }, { pump: { mix: 1, beats: 1, release: 0 } }]) assert.equal(validEffects(bad), false);
  const input = [new Float32Array(beat * 4).fill(0.5), new Float32Array(beat * 4).fill(-0.5)];
  const effects = { pump: { mix: 0.8, beats: 1, release: 0.5 } };
  const whole = input.map(ch => ch.slice());
  createSongEffects(effects, sr, tempo)(whole);
  const at = (frame) => whole[0][frame] / 0.5;
  for (let n = 0; n < 4; n++) {
    assert.ok(at(n * beat + 20) < 0.3, 'ducked at beat ' + n);
    assert.ok(Math.abs(at(n * beat + beat * 0.6) - 1) < 1e-6, 'recovered after beat ' + n);
  }
  assert.ok(at(0) === 1, 'no step at the very start');
  const process = createSongEffects(effects, sr, tempo), pieces = input.map(ch => new Float32Array(ch.length));
  for (let i = 0; i < input[0].length; i += 61) {
    const block = input.map(ch => ch.slice(i, i + 61));
    process(block);
    block.forEach((ch, c) => pieces[c].set(ch, i));
  }
  assert.deepEqual(pieces, whole);
  const dry = input.map(ch => ch.slice());
  createSongEffects({ pump: { ...effects.pump, mix: 0 } }, sr, tempo)(dry);
  assert.deepEqual(dry, input);
});

test('stereo chorus widens a mono part, passes dry at zero and matches across block sizes', () => {
  const sr = 8000, tempo = 128, n = sr * 3;
  assert.ok(validEffects({ wide: { mix: 0.8, depth: 0.5 } }));
  assert.equal(validEffects({ wide: { mix: 0.8, depth: 2 } }), false);
  const tone = Float32Array.from({ length: n }, (_, i) => 0.3 * Math.sin(2 * Math.PI * 220 * i / sr) + 0.1 * Math.sin(2 * Math.PI * 1310 * i / sr));
  const input = [tone, tone.slice()];
  const effects = { wide: { mix: 0.8, depth: 0.5 } };
  const whole = input.map(ch => ch.slice());
  createSongEffects(effects, sr, tempo)(whole);
  let side = 0, mid = 0;
  for (let i = sr; i < n; i++) { side += (whole[0][i] - whole[1][i]) ** 2; mid += (whole[0][i] + whole[1][i]) ** 2; }
  assert.ok(Math.sqrt(side / mid) > 0.2, 'side to mid ' + Math.sqrt(side / mid));
  assert.ok(whole.every(ch => ch.every(v => Number.isFinite(v) && Math.abs(v) < 1)));
  const process = createSongEffects(effects, sr, tempo), pieces = input.map(ch => new Float32Array(ch.length));
  for (let i = 0; i < n; i += 97) {
    const block = input.map(ch => ch.slice(i, i + 97));
    process(block);
    block.forEach((ch, c) => pieces[c].set(ch, i));
  }
  assert.deepEqual(pieces, whole);
  const dry = input.map(ch => ch.slice());
  createSongEffects({ wide: { mix: 0, depth: 0.5 } }, sr, tempo)(dry);
  assert.deepEqual(dry, input);
});
