import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { createProceduralSong, composePart, rerollPart, addPart, keepPartLayout, changeKeyRole, KEYS } from '../engine/song-compose.js';
import { GENRES } from '../engine/song-genres.js';
import { INSTRUMENTS, shiftOctave } from '../engine/song-instruments.js';
import { longLayout } from '../engine/song-long.js';
import { sectionHarmony } from '../engine/song-development.js';
import { generateChoices } from '../engine/song-controls.js';
import { readSongFile } from '../engine/song-file.js';

const make = (genre = 'incremental', form = 'loop', seed = 42, seconds = 120, key = 'C', mode = 'major', tempo = null) =>
  createProceduralSong(seed, 'cozy', 'sketch', form, 'auto', 'auto', 'auto', 'auto', 'auto', seconds, tempo, key, mode, genre);
const saved = song => ({ format: 'bosstrack-song', v: 1, renderer: 'song-v1', song,
  mix: { muted: [], solo: [], gains: {} }, repeat: song.form === 'loop',
  assets: Object.fromEntries(song.tracks.filter(t => INSTRUMENTS[t.instrument].sample).map(t => [t.instrument, 'a'.repeat(64)])) });
const notesIn = (song, track, section) => track.notes.filter(n => n.tick >= section.bar * 4 * song.ppq && n.tick < (section.bar + section.bars) * 4 * song.ppq)
  .map(n => [n.tick - section.bar * 4 * song.ppq, n.midi, n.len]);

function valid(song) {
  assert.deepEqual(readSongFile(JSON.stringify(saved(song))).song, song);
  for (const track of song.tracks) {
    const range = INSTRUMENTS[track.instrument].range ?? [0, 127];
    for (const note of track.notes) {
      assert.ok(Number.isInteger(note.tick) && Number.isInteger(note.len));
      assert.ok(note.tick >= 0 && note.len > 0 && note.tick + note.len <= song.bars * 4 * song.ppq);
      assert.ok(note.vel > 0 && note.vel <= 1);
      assert.ok(note.midi >= range[0] && note.midi <= range[1]);
      if (track.id !== 'drums') assert.ok(song.harmony.scale.some(midi => midi % 12 === note.midi % 12), track.id + ' pitch ' + note.midi);
    }
  }
}

test('developed arrangements keep duration, ranges and exact saves across every genre', () => {
  for (const genre of Object.keys(GENRES).filter(id => !GENRES[id].composed)) for (const form of ['song', 'loop']) for (const seconds of [120, 300]) {
    const song = make(genre, form, 42, seconds);
    assert.equal(song.arrangement, 'developed-v1');
    valid(song);
    assert.deepEqual(song, make(genre, form, 42, seconds));
    assert.ok(Math.abs(song.bars * 240 / song.tempo + (form === 'song' ? 1.4 : 0) - seconds) <= 480 / song.tempo + 1e-6);
    assert.equal(song.sections.at(-1).name, form === 'song' ? 'Ending' : 'Turnaround');
  }
  for (const tempo of [30, 40, 80, 150]) for (const form of ['song', 'loop']) valid(make('incremental', form, 7, 120, 'C', 'major', tempo));
});

test('independent sections and recognizable hooks replace two-phrase recycling', () => {
  for (const genre of ['incremental', 'electronic', 'kpop', 'adventure', 'newage']) {
    const song = make(genre, 'song', 42, 180);
    const track = song.tracks[0];
    const first = song.sections.find(s => s.name === 'Main');
    const hook = song.sections.find(s => s.name === 'Refrain');
    const bridge = song.sections.find(s => s.name === 'Contrast');
    assert.notDeepEqual(notesIn(song, track, first), notesIn(song, track, hook));
    assert.notDeepEqual(notesIn(song, track, hook), notesIn(song, track, bridge));
    const hooks = song.sections.filter(s => s.name === 'Refrain');
    const opening = section => notesIn(song, track, section).filter(n => n[0] < 8 * song.ppq);
    assert.deepEqual(opening(hooks[0]), opening(hooks[1]), genre + ' recognizable hook');
    const ending = section => notesIn(song, track, section).filter(n => n[0] >= 8 * song.ppq && n[0] < 16 * song.ppq);
    assert.notDeepEqual(ending(hooks[0]), ending(hooks[1]), genre + ' developed return');
  }
});

test('gentle contrasts leave room for backing and added Keys have complementary roles', () => {
  const song = make();
  const contrast = song.sections.find(s => s.name === 'Contrast');
  assert.equal(notesIn(song, song.tracks[0], contrast).filter(n => n[0] < 8 * song.ppq).length, 0);
  for (const track of song.tracks.slice(1)) for (let bar = contrast.bar; bar < contrast.bar + contrast.bars; bar++) {
    assert.ok(track.notes.some(n => n.tick >= bar * 4 * song.ppq && n.tick < (bar + 1) * 4 * song.ppq), track.id + ' keeps moving');
  }
  const answer = addPart(song, 'keys');
  const arp = addPart(answer, 'keys');
  assert.deepEqual(arp.tracks.slice(0, 4), song.tracks);
  const main = song.sections.find(s => s.name === 'Main');
  const answered = notesIn(arp, arp.tracks[4], main);
  assert.ok(answered.every(n => n[0] % (4 * song.ppq) >= 2.5 * song.ppq));
  assert.ok(arp.tracks[5].notes.length > arp.tracks[4].notes.length * 2);
  valid(arp);
  const changed = changeKeyRole(arp, 'keys-2', 'arpeggio');
  assert.deepEqual(changed.tracks.filter(t => t.id !== 'keys-2'), arp.tracks.filter(t => t.id !== 'keys-2'));
  assert.equal(changed.tracks[4].role, 'arpeggio');
  assert.ok(changed.tracks[4].notes.length > arp.tracks[4].notes.length);
  valid(changed);
});

test('roles, register, effects and locks survive regeneration and individual edits', () => {
  let previous = changeKeyRole(addPart(make(), 'keys'), 'keys-2', 'arpeggio');
  previous = shiftOctave(previous, 'keys-2', -1);
  previous.tracks[4].effects = { reverb: { mix: 0.18, size: 0.6, damp: 0.45 } };
  const edited = rerollPart(previous, 'keys-2', 123);
  assert.deepEqual(edited.tracks[4].effects, previous.tracks[4].effects);
  assert.equal(edited.tracks[4].role, 'arpeggio');
  assert.equal(edited.tracks[4].octaves, previous.tracks[4].octaves);
  assert.deepEqual(edited.tracks.slice(0, 4), previous.tracks.slice(0, 4));
  const fresh = keepPartLayout(make('incremental', 'loop', 7), previous);
  assert.equal(fresh.tracks[4].role, 'arpeggio');
  const next = generateChoices(fresh, previous, { locks: { 'keys-2': { notes: true, instrument: true } } });
  assert.deepEqual(next.tracks[4], previous.tracks[4]);
  valid(next);
  assert.throws(() => generateChoices(make('incremental', 'loop', 7, null), previous, { locks: { keys: { notes: true } } }), /duration/);
  const firstRole = changeKeyRole(make(), 'keys', 'arpeggio');
  assert.equal(keepPartLayout(make('incremental', 'loop', 7), firstRole).tracks[0].role, 'arpeggio');
});

test('named patterns retain their rhythm without automatic role rewriting or harmony changes', () => {
  const song = createProceduralSong(42, 'cozy', 'sketch', 'loop', 'singing', 'drive', 'held', 'original', 'original', 120, null, 'C', 'major', 'incremental');
  for (const section of song.sections) assert.deepEqual(sectionHarmony(song, section), song.harmony);
  const added = addPart(song, 'keys');
  assert.equal(added.tracks[4].role, undefined);
  assert.throws(() => changeKeyRole(added, 'keys-2', 'answer'), /Auto/);
  assert.throws(() => changeKeyRole(make(), 'keys', 'missing'), /role/);
});

test('legacy long scores keep the old exact reroll contract', () => {
  const hashes = { original: '87f6ac10fb7aaeef7961e00684a203ccf16c97da5d0429d9f8ce33317279765a',
    incremental: '2367cee177ec3450128e8ae0668929098a3637459487964495558a9fee66a3b2',
    electronic: '2a2e79df2080db412c593ba7f19b57cc91bab9b4269eca9d3675aeea293a613a',
    kpop: 'b1e445fa941dec165131cae5e92df1aa62d4e016a0a81d821ceb228e42f97d01' };
  for (const [genre, expected] of Object.entries(hashes)) {
    const old = make(genre);
    delete old.performance;
    old.arrangement = 'returning-v1';
    Object.assign(old, longLayout(old, 120));
    old.tracks = old.tracks.map(t => ({ ...composePart(old, t.id, t.seed), instrument: t.instrument }));
    const reopened = readSongFile(JSON.stringify(saved(old))).song;
    const notes = rerollPart(reopened, 'keys', 99).tracks[0].notes;
    assert.equal(createHash('sha256').update(JSON.stringify(notes)).digest('hex'), expected, genre);
  }
});

test('section harmony is tonal in every key and mode and corrupt metadata is rejected', () => {
  for (const key of KEYS) for (const mode of ['major', 'minor']) {
    const song = make('incremental', 'loop', 42, 120, key, mode);
    valid(song);
    for (const section of song.sections) for (const chord of sectionHarmony(song, section).chords) {
      assert.ok(chord.notes.every(n => song.harmony.scale.some(midi => midi % 12 === n % 12)));
    }
  }
  const file = saved(make());
  file.song.tracks[0].role = 'missing';
  assert.throws(() => readSongFile(JSON.stringify(file)), /role/);
  file.song.tracks[0].role = ['lead'];
  assert.throws(() => readSongFile(JSON.stringify(file)), /role/);
  delete file.song.tracks[0].role;
  file.song.sections[0].bars += 4;
  assert.throws(() => readSongFile(JSON.stringify(file)), /sections/);
});
