import test from 'node:test';
import assert from 'node:assert/strict';
import { createProceduralSong, changePlaying, rerollPart, addPart, keepPartLayout } from '../engine/song-compose.js';
import { performTrack, playingStyle } from '../engine/song-playing.js';
import { INSTRUMENTS, shiftOctave, fitPitchedInstrument } from '../engine/song-instruments.js';
import { generateChoices } from '../engine/song-controls.js';
import { readSongFile } from '../engine/song-file.js';
import { songVoiceBlocks } from '../engine/song-voice.js';

const make = (genre, seconds = null, seed = 42) => createProceduralSong(seed, 'neutral', 'sketch', seconds ? 'loop' : 'sketch',
  'auto', 'auto', 'auto', 'auto', 'auto', seconds, null, 'C', 'minor', genre);
const save = song => ({ format: 'bosstrack-song', v: 1, renderer: 'song-v1', song, mix: { muted: [], solo: [], gains: { keys: 1.7 }, pans: { keys: -.4 } }, repeat: false,
  assets: Object.fromEntries(song.tracks.filter(t => INSTRUMENTS[t.instrument].sample).map(t => [t.instrument, 'a'.repeat(64)])) });

test('playing styles persist through rerolls, additions, regeneration and exact reopening', () => {
  for (const genre of ['metal', 'kpop', 'folk']) {
    const original = make(genre, 120);
    const styled = changePlaying(original, 'keys', 'lead');
    assert.deepEqual(styled.tracks.slice(1), original.tracks.slice(1));
    assert.deepEqual(changePlaying(styled, 'keys', 'lead'), styled);
    assert.equal(rerollPart(styled, 'keys', 99).tracks[0].playing, 'lead');
    const added = addPart(styled, 'keys', 7);
    assert.equal(added.tracks.at(-1).playing, 'lead');
    assert.deepEqual(added.tracks.slice(0, 4), styled.tracks);
    const refreshed = keepPartLayout(make(genre, 120, 7), added);
    assert.equal(refreshed.tracks[0].playing, 'lead'); assert.equal(refreshed.tracks.at(-1).playing, 'lead');
    assert.deepEqual(readSongFile(JSON.stringify(save(refreshed))).song, refreshed);
    const locked = generateChoices(make(genre, 120, 7), styled, { locks: { keys: { notes: true, instrument: true } } });
    assert.deepEqual(locked.tracks[0].notes, styled.tracks[0].notes);
  }
});

test('metal chugs leave gaps and compatible kits fill section boundaries', () => {
  const song = make('metal', 120), guitar = song.tracks[0], drums = song.tracks[3];
  assert.equal(playingStyle(song, guitar), 'chugs');
  assert.ok(guitar.notes.some(n => n.midi < 48));
  assert.ok(guitar.notes.every(n => n.len <= Math.round(song.ppq * .28)));
  for (const section of song.sections.filter(s => !['Ending', 'Contrast'].includes(s.name))) {
    const stop = (section.bar + section.bars) * 4 * song.ppq;
    assert.equal(drums.notes.filter(n => n.tick >= stop - song.ppq && n.tick < stop && [38, 56].includes(n.midi)).length >= 4, true);
  }
  const plain = changePlaying(song, 'keys', 'plain');
  assert.ok(plain.tracks[0].notes.some(n => n.len > song.ppq * .28));
});

test('strums spread a chord attack and sustained chords clear short articulation', () => {
  const song = createProceduralSong(42);
  const plain = changePlaying(song, 'pad', 'plain'), strum = changePlaying(song, 'pad', 'strum');
  assert.notDeepEqual(strum.tracks[1].notes.map(n => n.tick), plain.tracks[1].notes.map(n => n.tick));
  assert.deepEqual(strum.tracks[1].notes.map(n => n.midi).sort((a,b)=>a-b), plain.tracks[1].notes.map(n => n.midi).sort((a,b)=>a-b));
  const legato = changePlaying(make('kpop'), 'pad', 'legato');
  assert.ok(legato.tracks[1].notes.every(n => n.articulation === undefined));
});

test('bass slides alter PCM while staying deterministic across block boundaries and octave changes', () => {
  const song = make('kpop'), bass = song.tracks[2];
  assert.equal(playingStyle(song, bass), 'slides');
  assert.ok(bass.notes.some(n => n.slideFrom !== undefined));
  const shifted = shiftOctave(song, 'bass', -1);
  for (let i = 0; i < bass.notes.length; i++) if (bass.notes[i].slideFrom !== undefined) assert.equal(shifted.tracks[2].notes[i].slideFrom, bass.notes[i].slideFrom - 12);
  const render = (note, size) => { const v = songVoiceBlocks('bass_808', note, .3, 48000, 42); const out = new Float32Array(v.frames); let at = 0; for(const [b] of v.blocks(size)){out.set(b,at);at+=b.length;}return out; };
  const note = { midi: 43, slideFrom: 40 };
  assert.deepEqual(render(note,127),render(note,4096));
  assert.notDeepEqual(render(note,127),render({midi:43},127));
  assert.ok(render(note,127).every(Number.isFinite));
});

test('old scores bypass styles and corrupt style metadata is rejected', () => {
  const song = make('kpop'); delete song.performance;
  const track = song.tracks[0];
  assert.equal(performTrack(song,track),track);
  const file = save(make('kpop'));file.song.tracks[0].playing = 'invalid';
  assert.throws(()=>readSongFile(JSON.stringify(file)),/playing/);
  delete file.song.tracks[0].playing;file.song.tracks[0].notes[0].slideFrom = 128;
  assert.throws(()=>readSongFile(JSON.stringify(file)),/notes/);
});

test('sustained leads keep the longer rests written into the arrangement', () => {
  const source = make('incremental', 120);
  const plain = changePlaying(source, 'keys', 'plain').tracks[0];
  const lead = changePlaying(source, 'keys', 'lead').tracks[0];
  let gaps = 0;
  for (let i = 0; i + 1 < plain.notes.length; i++) if (plain.notes[i + 1].tick - plain.notes[i].tick > 2 * source.ppq) {
    assert.equal(lead.notes[i].len, plain.notes[i].len); gaps++;
  }
  assert.ok(gaps > 0);
});

test('playing changes and rerolls fit recorded instrument registers without leaving the scale', () => {
  for (const genre of ['metal', 'kpop', 'folk']) for (const instrument of ['glock_recorded', 'trumpet_short', 'cello_pizz']) {
    let song = fitPitchedInstrument(make(genre, 120, 7), 'keys', instrument).song;
    for (const playing of ['chugs', 'lead', 'plain', 'plucked']) {
      song = changePlaying(song, 'keys', playing);
      const next = rerollPart(song, 'keys', 99);
      const [low, high] = INSTRUMENTS[instrument].range;
      assert.ok(next.tracks[0].notes.every(n => n.midi >= low && n.midi <= high));
      assert.ok(next.tracks[0].notes.every(n => next.harmony.scale.some(p => p % 12 === n.midi % 12)));
      assert.deepEqual(readSongFile(JSON.stringify(save(next))).song, next);
    }
  }
});
