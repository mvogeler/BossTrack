import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createProceduralSong, rerollPart } from '../engine/song-compose.js';
import { readSongFile } from '../engine/song-file.js';

const make = (seed, feeling, form, seconds) => createProceduralSong(seed, feeling, 'sketch', form, 'auto', 'auto', 'auto', 'auto', 'auto', seconds);
const file = song => ({ format: 'bosstrack-song', v: 1, renderer: 'song-v1', song, mix: { muted: [], solo: [], gains: {} }, repeat: false });

test('long songs have deterministic returning sections and a saved ending', () => {
  for (const feeling of ['neutral', 'cozy', 'tense', 'uplifting']) for (const seconds of [120, 180, 300]) for (const form of ['song', 'loop']) {
    const song = make(42, feeling, form, seconds);
    assert.deepEqual(song, make(42, feeling, form, seconds));
    assert.ok(Math.abs(song.bars * 240 / song.tempo + (form === 'song' ? 1.4 : 0) - seconds) < 6);
    assert.ok(song.sections.filter(s => s.name === 'Main').length >= 2);
    assert.equal(song.sections.at(-1).name === 'Ending', form === 'song');
    assert.deepEqual(readSongFile(JSON.stringify(file(song))).song, song);
    for (const t of song.tracks) assert.ok(t.notes.every(n => n.tick + n.len <= song.bars * 4 * song.ppq));
    const changed = rerollPart(song, 'keys', 123);
    assert.deepEqual(changed.sections, song.sections);
    assert.deepEqual(changed.tracks.slice(1), song.tracks.slice(1));
    assert.ok(changed.tracks[0].notes.at(-1).tick > song.bars * 2 * song.ppq);
  }
  const song = make(42, 'cozy', 'song', 120);
  const broken = file(structuredClone(song)); broken.song.sections[0].bar = 2;
  assert.throws(() => readSongFile(JSON.stringify(broken)), /sections/);
  assert.throws(() => make(42, 'cozy', 'song', 301), /Length/);
});
