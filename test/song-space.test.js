import test from 'node:test';
import assert from 'node:assert/strict';
import { createProceduralSong, rerollPart } from '../engine/song-compose.js';
import { songVoiceBlocks } from '../engine/song-voice.js';
import { renderSong, renderSongBlocks } from '../engine/song-render.js';
import { readSongFile } from '../engine/song-file.js';

const make = (seconds = null) => createProceduralSong(42, 'neutral', 'sketch', 'loop', 'auto', 'auto', 'auto', 'auto', 'auto', seconds, null, 'C', 'minor', 'space');

test('revised space music has a separate slow theme, continuous bass pulses and sparse percussion', () => {
  const song = make(), [lead, pad, bass, drums] = song.tracks;
  assert.equal(song.genreRevision, 2);
  assert.equal(lead.instrument, 'orbital_theme');
  assert.ok(lead.notes.every(n => n.len > song.ppq));
  assert.ok(bass.notes.length > lead.notes.length * 4);
  assert.ok(bass.notes.every(n => n.len < song.ppq));
  assert.ok(drums.notes.every(n => ![38, 42].includes(n.midi)));
  assert.deepEqual(lead.effects.reverb, pad.effects.reverb);
  const file = { format: 'bosstrack-song', v: 1, renderer: 'song-v1', song, mix: { muted: [], solo: [], gains: {} }, repeat: true };
  assert.deepEqual(readSongFile(JSON.stringify(file)).song, song);
  const long = make(120), main = long.sections.find(s => s.name === 'Main');
  assert.ok(long.tracks[0].notes.some(n => n.tick >= main.bar * 4 * long.ppq && n.tick % (4 * long.ppq) + n.len > 4 * long.ppq));
  assert.deepEqual(rerollPart(long, 'bass', 7).tracks.filter(t => t.id !== 'bass'), long.tracks.filter(t => t.id !== 'bass'));
});

test('moving analog filters retain their state at arbitrary render boundaries', () => {
  for (const id of ['orbital_theme', 'nebula_strings', 'navigation_pulse']) for (const sr of [22050, 48000]) for (const midi of [0, 60, 127]) {
    const voice = () => songVoiceBlocks(id, { midi }, 0.7, sr, 42);
    const full = [...voice().blocks(100000)][0][0], joined = new Float32Array(full.length); let at = 0;
    for (const [block] of voice().blocks(131)) { joined.set(block, at); at += block.length; }
    assert.deepEqual(joined, full); assert.ok(full.every(Number.isFinite));
    assert.ok(full.some(n => Math.abs(n) > 0.00001));
    assert.equal(Math.abs(full.at(-1)), 0);
  }
});

test('space delay and shared reverb preserve full and streamed loop stems', () => {
  const song = make(), full = renderSong(song); let frames = 0;
  for (const block of renderSongBlocks(song, [], { blockFrames: 4096 })) {
    for (let p = 0; p < block.parts.length; p++) for (let c = 0; c < 2; c++) assert.ok(Buffer.from(block.parts[p].channels[c].buffer, block.parts[p].channels[c].byteOffset, block.parts[p].channels[c].byteLength).equals(Buffer.from(full.parts[p].channels[c].buffer, block.at * 4, block.parts[p].channels[c].byteLength)));
    frames += block.channels[0].length;
  }
  assert.equal(frames, full.channels[0].length);
});
