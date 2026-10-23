import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createProceduralSong, rerollPart } from '../engine/song-compose.js';
import { readSongFile } from '../engine/song-file.js';

const saved = (song) => JSON.stringify({ format: 'bosstrack-song', v: 1, renderer: 'song-v1', song,
  mix: { muted: [], solo: [], gains: {} }, repeat: false });

test('A/B songs keep the first phrase, contrast the second and resolve in a closing bar', () => {
  for (let seed = 0; seed < 100; seed++) {
    const a = createProceduralSong(seed, 'cozy', 'menu');
    const b = createProceduralSong(seed, 'cozy', 'menu', 'song');
    assert.equal(b.bars, 9);
    assert.deepEqual(b, createProceduralSong(seed, 'cozy', 'menu', 'song'));
    assert.deepEqual(readSongFile(saved(b)).song, b);
    for (let i = 0; i < 4; i++) assert.deepEqual(b.tracks[i].notes.slice(0, a.tracks[i].notes.length), a.tracks[i].notes);
    const keys = b.tracks[0].notes;
    assert.equal(keys.at(-1).tick, 32 * b.ppq);
    assert.equal(keys.at(-1).midi, b.harmony.root + 12);
    assert.ok(keys.filter(n => n.tick >= 16 * b.ppq && n.tick < 32 * b.ppq).length <= a.tracks[0].notes.length);
    const changed = rerollPart(b, 'keys', 123);
    assert.equal(changed.form, 'song');
    assert.deepEqual(changed.tracks.slice(1), b.tracks.slice(1));
  }
  const bad = createProceduralSong(42, 'neutral', 'sketch', 'song');
  bad.form = 'unknown';
  assert.throws(() => readSongFile(saved(bad)), /Invalid/);
});

test('developed answers preserve A, stay inside each bar and keep legacy rerolls', () => {
  for (const melody of ['original', 'singing', 'wandering', 'rising', 'falling', 'arch', 'pulse', 'leaps', 'arpeggio']) {
    for (let seed = 0; seed < 30; seed++) {
      const song = createProceduralSong(seed, 'cozy', 'sketch', 'loop', melody);
      const keys = song.tracks[0];
      const a = keys.notes.filter(n => n.tick < 16 * song.ppq);
      const b = keys.notes.filter(n => n.tick >= 16 * song.ppq);
      assert.equal(b.at(-1).midi, a.at(-1).midi);
      for (const n of b) {
        assert.ok(n.tick + n.len <= (Math.floor(n.tick / (4 * song.ppq)) + 1) * 4 * song.ppq);
        assert.ok(song.harmony.scale.some(m => (m - n.midi) % 12 === 0));
      }
      assert.deepEqual(readSongFile(saved(song)).song, song);
      const legacy = structuredClone(song);
      delete legacy.sectionAnswer;
      const old = rerollPart(legacy, 'keys', keys.seed).tracks[0];
      assert.deepEqual(old.notes.slice(0, a.length), a);
      assert.ok(old.notes.filter(n => n.tick >= 16 * song.ppq).every(n => a.some(x => x.midi - 12 === n.midi)));
      assert.notDeepEqual(b, old.notes.slice(a.length));
    }
  }
  const bad = createProceduralSong(42, 'neutral', 'sketch', 'loop');
  bad.sectionAnswer = 'unknown';
  assert.throws(() => readSongFile(saved(bad)), /section answer/);
});

test('drum answers open space before restoring the beat, with old saves unchanged', () => {
  for (const drums of ['original', 'auto', 'drive', 'half', 'broken', 'sparse', 'bounce', 'rolling', 'march', 'swing']) {
    for (const form of ['song', 'loop']) {
      for (let seed = 0; seed < 20; seed++) {
        const song = createProceduralSong(seed, 'tense', 'combat', form, 'singing', drums);
        const track = song.tracks[3];
        const a = track.notes.filter(n => n.tick < 16 * song.ppq);
        const b = track.notes.filter(n => n.tick >= 16 * song.ppq && n.tick < 32 * song.ppq);
        assert.deepEqual(song, createProceduralSong(seed, 'tense', 'combat', form, 'singing', drums));
        const legacy = structuredClone(song);
        delete legacy.sectionDrums;
        const old = rerollPart(legacy, 'drums', track.seed);
        assert.deepEqual(old.tracks.slice(0, 3), song.tracks.slice(0, 3));
        assert.deepEqual(old.tracks[3].notes.slice(0, a.length), a);
        assert.deepEqual(b.filter(n => n.midi === 36).map(n => n.tick - 16 * song.ppq), a.filter(n => n.midi === 36).map(n => n.tick));
        assert.ok(b.filter(n => n.tick < 24 * song.ppq).length < a.filter(n => n.tick < 8 * song.ppq).length);
        const events = notes => notes.filter(n => n.tick >= 24 * song.ppq && n.tick < 32 * song.ppq).map(({id, ...note}) => note);
        assert.deepEqual(events(b), events(old.tracks[3].notes));
        assert.deepEqual(readSongFile(saved(song)).song, song);
        assert.deepEqual(rerollPart(song, 'drums', 123).tracks.slice(0, 3), song.tracks.slice(0, 3));
      }
    }
  }
  const bad = createProceduralSong(42, 'neutral', 'sketch', 'loop');
  bad.sectionDrums = 'unknown';
  assert.throws(() => readSongFile(saved(bad)), /drum section/);
});

test('bass answers preserve A and the last bar, with tonal responses and legacy rerolls', () => {
  for (const bass of ['original', 'auto', 'held', 'pulse', 'offbeat', 'fifths', 'octaves', 'walking', 'riff', 'answer']) {
    for (const form of ['song', 'loop']) {
      for (let seed = 0; seed < 20; seed++) {
        const song = createProceduralSong(seed, 'cozy', 'menu', form, 'singing', 'swing', bass);
        const track = song.tracks[2];
        const legacy = structuredClone(song);
        delete legacy.sectionBass;
        const old = rerollPart(legacy, 'bass', track.seed);
        const events = notes => notes.map(({id, ...note}) => note);
        assert.deepEqual(track.notes.filter(n => n.tick < 16 * song.ppq), old.tracks[2].notes.filter(n => n.tick < 16 * song.ppq));
        assert.deepEqual(events(track.notes.filter(n => n.tick >= 28 * song.ppq)), events(old.tracks[2].notes.filter(n => n.tick >= 28 * song.ppq)));
        const response = track.notes.filter(n => n.tick >= 16 * song.ppq && n.tick < 24 * song.ppq);
        assert.equal(response.length, 4);
        assert.equal(response[0].midi, song.harmony.chords[0].root - 24);
        assert.equal(response[2].midi, song.harmony.chords[1].root - 24);
        assert.ok(response.every(n => song.harmony.scale.some(m => (m - n.midi) % 12 === 0)));
        assert.ok(response.every(n => n.tick + n.len <= (Math.floor(n.tick / (4 * song.ppq)) + 1) * 4 * song.ppq));
        assert.deepEqual(old.tracks.filter(t => t.id !== 'bass'), song.tracks.filter(t => t.id !== 'bass'));
        assert.deepEqual(readSongFile(saved(song)).song, song);
        assert.deepEqual(song, createProceduralSong(seed, 'cozy', 'menu', form, 'singing', 'swing', bass));
        assert.deepEqual(rerollPart(song, 'bass', 123).tracks.filter(t => t.id !== 'bass'), song.tracks.filter(t => t.id !== 'bass'));
      }
    }
  }
  const bad = createProceduralSong(42, 'neutral', 'sketch', 'loop');
  bad.sectionBass = 'unknown';
  assert.throws(() => readSongFile(saved(bad)), /bass section/);
});

test('B melody anchors fit each chord and short tensions resolve by step', () => {
  for (const melody of ['auto', 'original', 'singing', 'wandering', 'rising', 'falling', 'arch', 'pulse', 'leaps', 'arpeggio']) {
    for (const feeling of ['cozy', 'tense', 'uplifting']) {
      for (let seed = 0; seed < 20; seed++) {
        const base = createProceduralSong(seed, feeling, 'sketch', 'loop', melody, 'drive', 'held', 'auto', 'broken');
        const song = rerollPart({...base, sectionAnswer:'harmonic'}, 'keys', base.tracks[0].seed);
        const keys = song.tracks[0];
        const legacy = {...song, sectionAnswer:'developed'};
        const old = rerollPart(legacy, 'keys', keys.seed);
        assert.deepEqual(keys.notes.filter(n => n.tick < 16 * song.ppq), old.tracks[0].notes.filter(n => n.tick < 16 * song.ppq));
        assert.deepEqual(song.tracks.slice(1), old.tracks.slice(1));
        for (let bar = 4; bar < 8; bar++) {
          const notes = keys.notes.filter(n => Math.floor(n.tick / (4 * song.ppq)) === bar);
          const chord = song.harmony.chords[bar - 4].notes;
          const fits = n => chord.some(m => (m - n.midi) % 12 === 0);
          notes.forEach((n, i) => {
            if (i === 0 || i === notes.length - 1 || n.len >= 0.75 * song.ppq || n.vel >= 0.75) assert.ok(fits(n));
            else if (!fits(n)) assert.ok(Math.abs(n.midi - notes[i + 1].midi) <= 2);
          });
        }
        assert.deepEqual(readSongFile(saved(song)).song, song);
      }
    }
  }
});

test('phrased B keeps melody order and timing instead of reshuffling its tensions', () => {
  for (const melody of ['auto', 'original', 'singing', 'wandering', 'rising', 'falling', 'arch', 'pulse', 'leaps', 'arpeggio']) {
    for (const form of ['song', 'loop']) {
      for (let seed = 0; seed < 30; seed++) {
        const song = createProceduralSong(seed, 'cozy', 'sketch', form, melody, 'broken', 'walking', 'auto', 'broken');
        const keys = song.tracks[0];
        const a = keys.notes.filter(n => n.tick < 16 * song.ppq);
        const b = keys.notes.filter(n => n.tick >= 16 * song.ppq && n.tick < 32 * song.ppq);
        assert.equal(b.length, a.length);
        b.forEach((n, i) => {
          assert.equal(n.midi, a[i].midi);
          assert.equal(n.tick - 16 * song.ppq, a[i].tick);
          assert.ok(n.len <= a[i].len);
          assert.ok(n.vel <= a[i].vel);
          if (a[i].tick >= 8 * song.ppq) {
            assert.equal(n.len, a[i].len);
            assert.equal(n.vel, a[i].vel);
          }
        });
        assert.deepEqual(readSongFile(saved(song)).song, song);
        assert.deepEqual(rerollPart(song, 'keys', 123).tracks.slice(1), song.tracks.slice(1));
      }
    }
  }
});

test('B pads leave an opening beat and restore their pattern without changing pitches', () => {
  for (const pad of ['original', 'auto', 'holds', 'halves', 'offbeat', 'stabs', 'broken', 'alternating', 'sparse', 'inner']) {
    for (const form of ['song', 'loop']) {
      for (let seed = 0; seed < 20; seed++) {
        const song = createProceduralSong(seed, 'neutral', 'sketch', form, 'auto', 'auto', 'auto', 'auto', pad);
        const track = song.tracks[1];
        const legacy = structuredClone(song);
        delete legacy.sectionPad;
        const old = rerollPart(legacy, 'pad', track.seed);
        const a = track.notes.filter(n => n.tick < 16 * song.ppq);
        const b = track.notes.filter(n => n.tick >= 16 * song.ppq && n.tick < 32 * song.ppq);
        assert.deepEqual(old.tracks[1].notes.slice(0, a.length), a);
        assert.deepEqual(old.tracks.filter(t => t.id !== 'pad'), song.tracks.filter(t => t.id !== 'pad'));
        for (const n of b.filter(n => n.tick < 24 * song.ppq)) {
          assert.ok(n.tick % (4 * song.ppq) >= song.ppq);
          assert.ok(n.tick + n.len <= (Math.floor(n.tick / (4 * song.ppq)) + 1) * 4 * song.ppq);
          const source = a.find(x => x.tick === n.tick - 17 * song.ppq && x.midi === n.midi);
          assert.ok(source);
          assert.equal(n.articulation, source.articulation);
        }
        const events = notes => notes.filter(n => n.tick >= 24 * song.ppq).map(({id, ...note}) => note);
        assert.deepEqual(events(track.notes), events(old.tracks[1].notes));
        assert.deepEqual(readSongFile(saved(song)).song, song);
        assert.deepEqual(rerollPart(song, 'pad', 123).tracks.filter(t => t.id !== 'pad'), song.tracks.filter(t => t.id !== 'pad'));
      }
    }
  }
  const bad = createProceduralSong(42, 'neutral', 'sketch', 'loop');
  bad.sectionPad = 'unknown';
  assert.throws(() => readSongFile(saved(bad)), /pad section/);
});
