import test from 'node:test';
import assert from 'node:assert/strict';
import { composeCue, composeCuePart, cueLayout, cueMix, parseChord, parseTheme, chartEvents, voiceChord, slurNotes, CUES } from '../engine/song-cue.js';
import { sampleVoice } from '../engine/song-samples.js';
import { CUE_PROFILES } from '../engine/song-cues.js';
import { createProceduralSong, rerollPart, addPart, removePart } from '../engine/song-compose.js';
import { INSTRUMENTS } from '../engine/song-instruments.js';
import { readSongFile } from '../engine/song-file.js';
import { createSongEffects, validEffects, effectTail } from '../engine/song-effects.js';
import { scale } from '../engine/kit/music.js';

const D = scale(62, 'major');
const file = (song, mix = cueMix(song)) => JSON.stringify({ format: 'bosstrack-song', v: 1, renderer: 'song-v1', song, mix, repeat: true,
  assets: Object.fromEntries(song.tracks.filter(t => INSTRUMENTS[t.instrument].sample).map(t => [t.instrument, 'a'.repeat(64)])) });

test('chord names follow the key and keep slash basses and borrowed roots', () => {
  assert.deepEqual(parseChord('1maj7', D).pcs, [2, 6, 9, 1]);
  assert.deepEqual(parseChord('6m7', D).pcs, [11, 2, 6, 9]);
  const slash = parseChord('5/7', D);
  assert.equal(slash.root, 9);
  assert.equal(slash.bass, 1);
  assert.deepEqual(parseChord('b7', D).pcs, [0, 4, 7]);
  assert.equal(parseChord('5sus', D).third, null);
  assert.deepEqual(parseChord('5M', scale(59, 'minor')).pcs, [6, 10, 1]);
  assert.throws(() => parseChord('8', D), /Unknown chord/);
  assert.deepEqual(chartEvents(['1', '5sus 5'], D).map(e => [e.beat, e.len]), [[0, 4], [4, 2], [6, 2]]);
});

test('themes read degrees, octave marks and rests, and reject uneven bars', () => {
  const theme = parseTheme("3:1.5 2:0.5 r:1 1':1 | 7,:4", D, 74);
  assert.deepEqual(theme.notes.map(n => [n.beat, n.midi, n.len]), [[0, 78, 1.5], [1.5, 76, 0.5], [3, 86, 1], [4, 73, 4]]);
  assert.equal(theme.beats, 8);
  assert.throws(() => parseTheme('1:3', D, 74), /four beats/);
});

test('pad voicings keep the colour tones and move as little as possible', () => {
  const first = voiceChord(parseChord('1maj7', D), null, 50, 74);
  const next = voiceChord(parseChord('4maj7', D), first, 50, 74);
  for (const [chord, voiced] of [['1maj7', first], ['4maj7', next]]) {
    const { third, seventh } = parseChord(chord, D);
    assert.ok(voiced.some(n => n % 12 === third) && voiced.some(n => n % 12 === seventh));
    assert.ok(voiced.every((n, i) => !i || n - voiced[i - 1] >= 2));
  }
  assert.ok(next.reduce((sum, n, i) => sum + Math.abs(n - first[i]), 0) <= 8);
});

test('every cue composes the same way twice, fits its instruments and reopens exactly', () => {
  for (const [genre, cues] of Object.entries(CUES)) for (const cue of Object.keys(cues)) {
    const song = composeCue(genre, cue, 11);
    assert.deepEqual(song, composeCue(genre, cue, 11));
    assert.equal(song.bars, cueLayout(genre, cue).bars);
    assert.ok(song.bars * 4 * 60 / song.tempo >= (cue === 'menu' ? 55 : 92));
    assert.ok(song.tracks.length <= 8 && song.tracks.every(t => t.notes.length));
    for (const t of song.tracks) {
      const range = INSTRUMENTS[t.instrument].range;
      assert.ok(t.notes.every(n => n.tick >= 0 && n.tick + n.len <= song.bars * 4 * song.ppq && n.vel > 0 && n.vel <= 1));
      if (range) assert.ok(t.notes.every(n => n.midi >= range[0] && n.midi <= range[1]), genre + ' ' + cue + ' ' + t.id);
    }
    assert.deepEqual(readSongFile(file(song)).song, song);
  }
});

test('rerolls change the playing but keep the tune, and other parts stay put', () => {
  const song = composeCue('watercolor_a', 'game', 3);
  const next = rerollPart(song, 'pad-2', 77);
  assert.notDeepEqual(next.tracks.find(t => t.id === 'pad-2').notes, song.tracks.find(t => t.id === 'pad-2').notes);
  assert.deepEqual(next.tracks.filter(t => t.id !== 'pad-2'), song.tracks.filter(t => t.id !== 'pad-2'));
  const lead = composeCuePart(song, 'keys', 77).notes, old = song.tracks[0].notes;
  const downbeats = notes => notes.filter(n => n.tick % 3840 < 40).map(n => Math.floor(n.tick / 3840) + ':' + n.midi);
  assert.ok(downbeats(lead).filter(x => downbeats(old).includes(x)).length >= downbeats(old).length * 0.8);
  const added = addPart(removePart(song, 'drums'), 'keys', 5);
  assert.deepEqual(readSongFile(file(added, { muted: [], solo: [], gains: {} })).song, added);
});

test('saved cues reject edited sections, unknown cues and cue fields on other songs', () => {
  const song = composeCue('watercolor_b', 'menu', 1);
  assert.throws(() => readSongFile(file({ ...song, cue: 'boss' })), /cue/);
  assert.throws(() => readSongFile(file({ ...song, sections: song.sections.slice(1) })), /sections/);
  assert.throws(() => readSongFile(file({ ...song, bars: song.bars + 4 })), /timing/);
  const plain = createProceduralSong(1);
  assert.throws(() => readSongFile(file({ ...plain, cue: 'menu' }, { muted: [], solo: [], gains: {} })), /cue/);
});

test('the genre menu writes the menu cue for Menu use and the game loop otherwise', () => {
  const make = (use, genre) => createProceduralSong(5, 'cozy', use, 'loop', 'auto', 'auto', 'auto', 'auto', 'auto', null, 90, 'E', null, genre);
  assert.equal(make('menu', 'watercolor_a').cue, 'menu');
  const game = make('sketch', 'watercolor_b');
  assert.equal(game.cue, 'game');
  assert.equal(game.tempo, 90);
  assert.equal(game.harmony.root % 12, 4);
  for (const genre of Object.keys(CUE_PROFILES)) assert.ok(Object.keys(CUE_PROFILES[genre].tracks).length <= 8);
});

test('tone and hall check their settings, pass dry at zero mix and match across block sizes', () => {
  const effects = { tone: { mix: 1, cut: 0.6, warmth: 0.3 }, hall: { mix: 0.5, size: 0.7, damp: 0.4, predelay: 0.03 } };
  assert.ok(validEffects(effects));
  for (const bad of [{ tone: { mix: 1, cut: 2, warmth: 0 } }, { hall: { mix: 1, size: 0.5, damp: 0.5 } }, { hall: { ...effects.hall, predelay: 0.5 } }]) {
    assert.equal(validEffects(bad), false);
  }
  const input = [new Float32Array(9000), new Float32Array(9000)];
  input[0][0] = 0.8; input[1][3] = -0.4;
  const whole = input.map(ch => ch.slice());
  createSongEffects(effects, 4000, 90)(whole);
  const process = createSongEffects(effects, 4000, 90), pieces = input.map(ch => new Float32Array(ch.length));
  for (let at = 0; at < 9000; at += 41) {
    const block = input.map(ch => ch.slice(at, at + 41));
    process(block);
    block.forEach((ch, c) => pieces[c].set(ch, at));
  }
  assert.deepEqual(pieces, whole);
  assert.ok(whole[1].slice(100).some(x => Math.abs(x) > 1e-4));
  assert.ok(whole.every(ch => ch.every(Number.isFinite) && Math.abs(ch.at(-1)) < 0.01));
  const dry = input.map(ch => ch.slice());
  createSongEffects({ tone: { ...effects.tone, mix: 0 }, hall: { ...effects.hall, mix: 0 } }, 4000, 90)(dry);
  assert.deepEqual(dry, input);
  assert.ok(effectTail({ tempo: 90, tracks: [{ effects }] }) > 4);
});

test('tone darkens highs by the expected amount', () => {
  const sr = 48000, hz = 8000, sine = Float32Array.from({ length: sr }, (_, i) => Math.sin(2 * Math.PI * hz * i / sr));
  const channels = [sine.slice(), sine.slice()];
  createSongEffects({ tone: { mix: 1, cut: 0.5, warmth: 0 } }, sr, 90)(channels);
  let high = 0;
  for (let i = sr / 2; i < sr; i++) high = Math.max(high, Math.abs(channels[0][i]));
  assert.ok(20 * Math.log10(high) < -18 && 20 * Math.log10(high) > -26);
});

test('soften, eq and tape check their settings, pass dry at zero mix and match across block sizes', () => {
  const effects = { soften: { mix: 1, amount: 0.7 }, eq: { mix: 1, air: 0.6, mud: 0.5 }, tape: { mix: 1, width: 0.2, drive: 0.5, wow: 0.6, squash: 0.7 } };
  assert.ok(validEffects(effects));
  for (const bad of [{ eq: { mix: 1, air: 2, mud: 0 } }, { tape: { mix: 1, width: 0.2 } }, { soften: { mix: 1, amount: -1 } }]) assert.equal(validEffects(bad), false);
  const input = [Float32Array.from({ length: 9000 }, (_, i) => 0.3 * Math.sin(i * 0.07) * (i % 1500 < 40 ? 1 : 0.2)), new Float32Array(9000)];
  input[1].set(input[0].map(x => x * 0.4));
  const whole = input.map(ch => ch.slice());
  createSongEffects(effects, 4000, 90)(whole);
  const process = createSongEffects(effects, 4000, 90), pieces = input.map(ch => new Float32Array(ch.length));
  for (let at = 0; at < 9000; at += 53) {
    const block = input.map(ch => ch.slice(at, at + 53));
    process(block);
    block.forEach((ch, c) => pieces[c].set(ch, at));
  }
  assert.deepEqual(pieces, whole);
  assert.ok(whole.every(ch => ch.every(Number.isFinite)));
  const dry = input.map(ch => ch.slice());
  createSongEffects(Object.fromEntries(Object.entries(effects).map(([k, v]) => [k, { ...v, mix: 0 }])), 4000, 90)(dry);
  assert.deepEqual(dry, input);
});

test('eq lifts the air band and dips the low mids by about the set amount', () => {
  const sr = 48000, level = (hz, effects) => {
    const sine = Float32Array.from({ length: sr }, (_, i) => Math.sin(2 * Math.PI * hz * i / sr)), channels = [sine.slice(), sine.slice()];
    createSongEffects(effects, sr, 90)(channels);
    let high = 0;
    for (let i = sr / 2; i < sr; i++) high = Math.max(high, Math.abs(channels[0][i]));
    return 20 * Math.log10(high);
  };
  const air = level(12000, { eq: { mix: 1, air: 1, mud: 0 } }), mud = level(330, { eq: { mix: 1, air: 0, mud: 1 } });
  assert.ok(air > 7 && air < 10, 'air ' + air);
  assert.ok(mud < -5 && mud > -7, 'mud ' + mud);
  assert.ok(Math.abs(level(1000, { eq: { mix: 1, air: 1, mud: 1 } })) < 1.5);
});

test('tape at zero width folds to mono and its wobble lands back in phase after whole bars', () => {
  const sr = 4000, tempo = 120, bar = sr * 2;
  const tape = { tape: { mix: 1, width: 0, drive: 0.3, wow: 1, squash: 0.5 } };
  const make = () => [Float32Array.from({ length: bar * 2 }, (_, i) => 0.2 * Math.sin(i * 0.31)), Float32Array.from({ length: bar * 2 }, (_, i) => 0.2 * Math.cos(i * 0.17))];
  const channels = make();
  createSongEffects(tape, sr, tempo)(channels);
  assert.deepEqual(channels[0], channels[1]);
  const periodic = [Float32Array.from({ length: bar * 3 }, (_, i) => 0.2 * Math.sin(2 * Math.PI * (i % bar) * 5 / bar)), null];
  periodic[1] = periodic[0].slice();
  createSongEffects({ tape: { ...tape.tape, squash: 0 } }, sr, tempo)(periodic);
  for (let i = bar; i < bar * 2; i += 97) assert.ok(Math.abs(periodic[0][i] - periodic[0][i + bar]) < 1e-6);
});

test('slurred notes enter inside the sustain loop and leave with a short release', () => {
  const bank = [{ root: 60, velocity: 0.6, articulation: 'sustain', sampleRate: 1000, release: 0.6, loop: { start: 500, end: 1500 },
    channels: [Float32Array.from({ length: 2000 }, (_, i) => i < 500 ? 1 : 0.25), Float32Array.from({ length: 2000 }, (_, i) => i < 500 ? 1 : 0.25)] }];
  const plain = sampleVoice({ midi: 60, vel: 0.6, id: 'a' }, 1, 1000, bank);
  const into = sampleVoice({ midi: 60, vel: 0.6, id: 'a', slur: 'in' }, 1, 1000, bank);
  const out = sampleVoice({ midi: 60, vel: 0.6, id: 'a', slur: 'out' }, 1, 1000, bank);
  assert.equal(plain[0].length, 1600);
  assert.equal(out[0].length, 1160);
  assert.ok(plain[0][20] > 0.9 && into[0][20] < 0.25 && Math.abs(into[0][200] - 0.25) < 1e-6);
});

test('legato parts mark end-to-start joins, wrap at the loop and drop swells', () => {
  const ppq = 960, end = 8 * ppq;
  const notes = [{ tick: 0, len: ppq * 4, midi: 60, expression: 'swell' }, { tick: ppq * 4 + 20, len: ppq * 3, midi: 62 },
    { tick: ppq * 4, len: ppq * 4, midi: 55 }, { tick: ppq * 7 + 300, len: ppq, midi: 64 }];
  slurNotes(notes, ppq, end);
  assert.deepEqual(notes.map(n => n.slur), ['both', 'in', 'both', undefined]);
  assert.equal(notes[0].expression, undefined);
});

test('v2 menus run every part through tape with vinyl under the whole cue, and v2 strings slur', () => {
  for (const genre of ['watercolor_a2', 'watercolor_b2']) {
    const menu = composeCue(genre, 'menu', 4);
    assert.ok(menu.tracks.every(t => t.effects?.tape?.mix === 1));
    const vinyl = menu.tracks.find(t => t.instrument === 'vinyl_crackle');
    assert.equal(vinyl.notes.reduce((sum, n) => sum + n.len, 0), menu.bars * 4 * menu.ppq);
    const game = composeCue(genre, 'game', 4);
    const strings = game.tracks.find(t => t.instrument === 'strings_section_chords');
    assert.ok(strings.notes.filter(n => n.slur).length > strings.notes.length / 3);
    assert.ok(game.tracks.every(t => !t.effects?.tape));
    assert.deepEqual(readSongFile(file(game)).song, game);
  }
  const bad = composeCue('watercolor_b2', 'game', 4);
  bad.tracks.find(t => t.id === 'drums').notes[0].slur = 'in';
  assert.throws(() => readSongFile(file(bad)), /notes/);
});
