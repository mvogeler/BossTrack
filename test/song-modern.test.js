import test from 'node:test';
import assert from 'node:assert/strict';
import { createProceduralSong, rerollPart } from '../engine/song-compose.js';
import { INSTRUMENTS } from '../engine/song-palette-modern.js';
import { INSTRUMENTS as ALL_INSTRUMENTS } from '../engine/song-instruments.js';
import { songVoiceBlocks } from '../engine/song-voice.js';
import { instrumentChoices, generateChoices } from '../engine/song-controls.js';
import { fillMetal } from '../engine/genre-metal.js';
import { fillKpop } from '../engine/genre-kpop.js';
import { readSongFile } from '../engine/song-file.js';

const make = (genre, seed = 42, seconds = null) => createProceduralSong(seed, 'neutral', 'sketch', seconds ? 'loop' : 'sketch',
  'auto', 'auto', 'auto', 'auto', 'auto', seconds, null, 'C', 'minor', genre);

function pcm(id, midi, sr, size) {
  const voice = songVoiceBlocks(id, { midi }, 0.17, sr, 42);
  const out = new Float32Array(voice.frames);
  let at = 0;
  for (const [block] of voice.blocks(size)) { out.set(block, at); at += block.length; }
  return out;
}

test('modern voices remain finite and identical across block sizes and output rates', () => {
  for (const id of Object.keys(INSTRUMENTS)) for (const sr of [22050, 48000]) {
    const pitches = INSTRUMENTS[id].part === 'drums' ? [36, 38, 39, 42, 45, 49, 54, 56] : [0, 36, 60, 96, 127];
    for (const midi of pitches) {
      const a = pcm(id, midi, sr, 127);
      assert.deepEqual(a, pcm(id, midi, sr, 4096), id + ' ' + midi);
      assert.ok(a.every(Number.isFinite), id);
      assert.equal(Math.abs(a.at(-1)), 0);
    }
  }
});

test('expanded kits distinguish the additional percussion voices', () => {
  for (const id of ['drums_impact', 'drums_machine']) {
    const hits = [36, 38, 39, 42, 45, 49, 54, 56].map(midi => pcm(id, midi, 22050, 257));
    for (let i = 0; i < hits.length; i++) {
      assert.ok(hits[i].some(x => Math.abs(x) > 0.01));
      for (let j = 0; j < i; j++) assert.notDeepEqual(hits[i].subarray(0, 1000), hits[j].subarray(0, 1000));
    }
  }
});

test('new metal and pop generation uses playable percussion through variation and reopening', () => {
  for (const genre of ['metal', 'kpop']) for (const seconds of [null, 120, 300]) for (const seed of [1, 7, 42]) {
    const song = make(genre, seed, seconds);
    assert.equal(song.genreRevision, 2);
    const drums = song.tracks.find(t => t.id === 'drums');
    assert.ok(drums.notes.some(n => n.midi === 49));
    assert.ok(drums.notes.some(n => n.midi === (genre === 'metal' ? 56 : 39)));
    const choices = instrumentChoices(song, drums).instruments;
    assert.ok(choices.includes(genre === 'metal' ? 'drums_foundry_kit' : 'drums_impact'));
    assert.ok(!choices.includes('drums_metal_kit'));
    const changed = generateChoices(song, null, { varyInstruments: true });
    assert.deepEqual(generateChoices(song, null, { varyInstruments: true }), changed);
    const file = { format: 'bosstrack-song', v: 1, renderer: 'song-v1', song: changed,
      assets: Object.fromEntries(changed.tracks.filter(t => ALL_INSTRUMENTS[t.instrument].sample).map(t => [t.instrument, 'a'.repeat(64)])),
      mix: { muted: [], solo: [], gains: {} }, repeat: !!seconds };
    assert.deepEqual(readSongFile(JSON.stringify(file)).song, changed);
  }
});

test('unversioned metal and pop retain their original three-piece percussion', () => {
  for (const [genre, fill] of [['metal', fillMetal], ['kpop', fillKpop]]) {
    const song = make(genre);
    delete song.genreRevision;
    delete song.performance;
    const track = { id: 'drums', seed: song.tracks[3].seed, notes: [] };
    fill(song, track);
    assert.ok(track.notes.every(n => [36, 38, 42].includes(n.midi)));
    song.tracks[3] = { ...track, instrument: genre === 'metal' ? 'drums_metal_kit' : 'drums_analog' };
    const changed = rerollPart(song, 'drums', track.seed);
    assert.deepEqual(changed.tracks[3].notes, track.notes);
  }
});
