import { PLAYING, playingStyle } from '../engine/song-playing.js';
import { panLevels, mixPeakGain, captureMixPreset, applyMixPreset, validMixPreset } from '../engine/song-mixer.js';
import { createProceduralSong, rerollPart, KEYS, addPart, removePart, keepPartLayout, changeKeyRole, changePlaying } from '../engine/song-compose.js';
import { FEELINGS } from '../engine/song-feelings.js';
import { GENRES } from '../engine/song-genres.js';
import { FORMS } from '../engine/song-form.js';
import { KEY_ROLES, keyRole } from '../engine/song-development.js';
import { MELODIES, chooseMelody } from '../engine/song-melodies.js';
import { PADS, choosePad } from '../engine/song-pad.js';
import { HARMONIES, chooseHarmony } from '../engine/song-harmony.js';
import { BASS, chooseBass } from '../engine/song-bass.js';
import { DRUMS, chooseDrums } from '../engine/song-drums.js';
import { USES } from '../engine/song-uses.js';
import { INSTRUMENTS, addInstruments, swapInstrument, fitPitchedInstrument, shiftOctave, PARTS, MAX_PARTS, partType } from '../engine/song-instruments.js';
import { mixParts } from '../engine/song-render.js';
import { loudnessGain } from '../engine/song-loudness.js';
import { encodeWavStream } from '../engine/wav.js';
import { tickSample } from '../engine/song.js';
import { generateChoices, selectPartInstrument, instrumentChoices } from '../engine/song-controls.js';
import { genreDefault, installedSong, instrumentReady, validGenreDefault, captureGenreDefault, mergeGenreDefaults, personalOptions } from '../engine/song-defaults.js';
import { effectFrames } from '../engine/song-effects.js';
import { SOUND_PRESETS, applySoundPreset } from '../engine/song-presets.js';
import { captureSoundPreset, applyUserPreset, validUserPreset } from '../engine/song-user-presets.js';
import { createSongHistory } from '../engine/song-history.js';
import { exportFrames, exportReader, exportLoop } from '../engine/song-export-range.js';
import { render, renderCached, cancelRender, measureLoudness, measureStream, sendInstruments } from './render/client.js';
import { play, playStream, stop, setLoop, position } from './audio/player.js';
import { createWaveform } from './ui/waveform.js';
import { TOOLTIPS } from './ui/tooltips.js';
const $ = (id) => document.getElementById(id);
const ipcMessage = err => err.message.replace(/^Error invoking remote method '[^']+': (Error: )?/, '');
let song = null;
const wave = createWaveform($('wave'), { combine: true, onSeek: seekPlayback });
let audio = null;
let busy = false;
let rendering = false, canceled = false;
let repeat = false;
let folder = null;
const partWaves = new Map();
const openEffects = new Set();
const muted = new Set();
const solo = new Set();
const gains = {}, pans = {};
let playbackRevision = 0;
let locks = {}, favorites = [];
const settings = await window.api.loadSettings();
const tips = new Map(Object.entries(TOOLTIPS));
const tip = (name, values = {}) => (tips.get(name) ?? '').replace(/\{(\w+)\}/g, (match, key) => values[key] ?? match);
for (const [name, text] of tips) if ($(name)) $(name).title = text;
$('wave').title = tip('wave.seek');
const banks = await window.api.scanBanks();
addInstruments(banks.personalInstruments);
sendInstruments(banks.personalInstruments);
const available = new Set(Object.keys(banks.tiers));
const validDefaults = map => Object.fromEntries(Object.entries(map ?? {}).filter(([genre, entry]) => Object.hasOwn(GENRES, genre) && validGenreDefault(entry)));
const personal = personalOptions(banks.personalDefaults);
const personalDefaults = personal.genreDefaults;
let genreDefaults = validDefaults(settings.music?.genreDefaults);
let fresh = false;
const libraryDir = (await window.api.soundsDir()).replaceAll('\\', '/') + '/music/';
const history = createSongHistory();
let libraryName = null, libraryRows = [], userPresets = (settings.music?.userPresets ?? []).filter(validUserPreset);
const libraryInfo = () => ({ title: $('song-title').value.trim(), favorite: $('song-favorite').checked,
  tags: [...new Set($('song-tags').value.split(',').map(tag => tag.trim()).filter(Boolean))] });
const exactSeconds = () => $('exact-duration').checked ? Number($('export-seconds').value) : null;
function snapshot() {
  if (!song) return null;
  return structuredClone({ format: 'bosstrack-song', v: 1, renderer: 'song-v1', song, mix: mixSelection(), repeat,
    normalizeWav: $('normalize-wav').checked, generation: generation(), library: libraryInfo(), exportSeconds: exactSeconds(), libraryName });
}
function remember() { if (song) { history.record(snapshot()); sync(); } }
favorites = (settings.music?.favorites ?? []).filter(id => INSTRUMENTS[id]);
$('vary-instruments').checked = settings.music?.varyInstruments ?? false;
$('favorites-only').checked = settings.music?.favoritesOnly ?? false;
$('keep-mix').checked = settings.music?.keepMix ?? true;
let mixPresets = (settings.music?.mixPresets ?? []).filter(validMixPreset);
const generation = () => ({ keepMix: $('keep-mix').checked, locks: structuredClone(locks), favorites: [...favorites],
  varyInstruments: $('vary-instruments').checked, favoritesOnly: $('favorites-only').checked });
const composeOptions = () => ({ ...generation(), available, pools: personal.pools, cues: personal.cues, genreDefaults: mergeGenreDefaults(personalDefaults, genreDefaults) });
async function savePalette() {
  settings.music = { ...settings.music, userPresets, mixPresets, keepMix: $('keep-mix').checked, favorites: [...favorites], varyInstruments: $('vary-instruments').checked, favoritesOnly: $('favorites-only').checked, genreDefaults };
  try { await window.api.saveSettings(settings); return true; }
  catch (err) { $('status').textContent = "Couldn't save palette preferences: " + err.message; return false; }
}
function paletteSummary() {
  $('palette-summary').textContent = favorites.length ? 'Favorites: ' + favorites.map(id => INSTRUMENTS[id].name).join(', ') : 'No favorites yet. Mark instruments in the parts below.';
}
for (const id of ['vary-instruments', 'favorites-only', 'keep-mix']) {
  $(id).addEventListener('change', () => { const current = $(id).checked; $(id).checked = !current; remember(); $(id).checked = current; savePalette(); sync(); });
}
paletteSummary();
let meterTimer, meterRevision = 0, measuring = false;
const audioFrames = () => audio.frames ?? audio.channels[0].length;
const mixSelection = () => ({ muted: [...muted], solo: [...solo], gains: { ...gains }, pans: { ...pans } });
const readAudio = (value, mix) => (at, size) => window.api.readPreview(value.cacheId, at, size, mix);
function envelope(frames) {
  const bins = Math.min(16384, frames);
  return { mins: [new Float32Array(bins), new Float32Array(bins)], maxs: [new Float32Array(bins), new Float32Array(bins)] };
}
function addPeaks(peaks, channels, at, frames) {
  for (let i = 0; i < channels[0].length; i++) {
    const bin = Math.min(peaks.mins[0].length - 1, Math.floor((at + i) / frames * peaks.mins[0].length));
    for (let c = 0; c < 2; c++) {
      peaks.mins[c][bin] = Math.min(peaks.mins[c][bin], channels[c][i]);
      peaks.maxs[c][bin] = Math.max(peaks.maxs[c][bin], channels[c][i]);
    }
  }
}
async function measureAudio(value, mix, revision = null) {
  if (!value.cacheId) return measureLoudness(mixParts(value.parts, mix, value.channels[0].length), value.sampleRate);
  const peaks = envelope(value.frames), read = readAudio(value, mix);
  const result = await measureStream(async (at, size) => {
    if (revision !== null && revision !== meterRevision) throw new Error('Mix changed');
    const channels = await read(at, size);
    addPeaks(peaks, channels, at, value.frames);
    return channels;
  }, value.frames, value.sampleRate);
  if (revision !== null && revision === meterRevision) { value.envelope = peaks; wave.show(peaks); }
  return result;
}
function queueMeter() {
  const revision = ++meterRevision;
  clearTimeout(meterTimer);
  $('loudness').textContent = 'Integrated loudness: measuring…';
  meterTimer = setTimeout(async () => {
    if (measuring) { queueMeter(); return; }
    if (!audio) return;
    measuring = true;
    try {
      const value = audio, key = JSON.stringify(mixSelection());
      const { lufs, peak } = await measureAudio(value, mixSelection(), revision);
      if (revision === meterRevision && audio === value) value.mixReading = { key, lufs, peak };
      const reduction = mixPeakGain(peak);
      if (revision === meterRevision && audio === value) $('mix-peak').textContent = 'Mix peak: ' + (peak ? (20 * Math.log10(peak)).toFixed(1) + ' dBFS' : 'silence') + (reduction < 1 ? ' / protection ' + (20 * Math.log10(reduction)).toFixed(1) + ' dB' : ' / no reduction');
      if (revision === meterRevision) $('loudness').textContent = Number.isFinite(lufs)
        ? 'Integrated loudness: ' + (lufs + 20 * Math.log10(reduction)).toFixed(1) + ' LUFS (protected preview)'
        : 'Integrated loudness: no reading (silence or shorter than 0.4 s)';
    } catch (err) {
      if (revision === meterRevision) $('loudness').textContent = 'Loudness unavailable: ' + err.message;
    } finally { measuring = false; }
  }, 250);
}
function sync() {
  $('generate').disabled = busy;
  $('new-seed').disabled = busy;
  $('clear-choices').disabled = busy;
  $('seed').disabled = busy;
  $('feeling').disabled = busy;
  $('genre').disabled = busy;
  $('bpm').disabled = busy;
  $('key').disabled = busy;
  $('mode').disabled = busy;
  $('use').disabled = busy;
  $('form').disabled = busy;
  $('long-track').disabled = busy;
  $('length').disabled = busy || !$('long-track').checked;
  $('cancel-render').hidden = !rendering;
  $('melody').disabled = busy;
  $('drums').disabled = busy;
  $('bass').disabled = busy;
  $('progression').disabled = busy;
  $('pad').disabled = busy;
  for (const button of document.querySelectorAll('[data-part], [data-instrument], [data-gain], [data-pan], [data-playing], [data-section]')) button.disabled = busy || !audio;
  for (const id of ['play', 'stop', 'repeat', 'clear-solo']) $(id).disabled = busy || !audio;
  $('wave-zoom').disabled = busy || !audio;
  $('wave-scroll').disabled = busy || !audio || $('wave-zoom').value === '1';
  for (const button of document.querySelectorAll('[data-count]')) {
    const count = song?.tracks.filter(t => partType(t) === button.dataset.count).length ?? 0;
    button.disabled = busy || !audio || (button.dataset.action === 'add' ? song.tracks.length >= MAX_PARTS : !count);
  }
  $('save').disabled = busy || !audio;
  for (const id of ['save-mix-preset', 'reset-mix']) $(id).disabled = busy || !audio;
  $('apply-mix-preset').disabled = busy || !audio || $('mix-preset').value === '';
  $('keep-mix').disabled = busy;
  $('normalize-wav').disabled = busy;
  $('save-song').disabled = busy || !audio;
  $('open-song').disabled = busy;
  $('open').disabled = busy || !folder;
  for (const id of ['vary-instruments', 'favorites-only']) $(id).disabled = busy;
  for (const button of document.querySelectorAll('[data-lock], [data-favorite]')) button.disabled = busy || !audio;
  $('save-midi').disabled = busy || !audio;
  $('save-stems').disabled = busy || !audio || !song.tracks.length;
  $('sound-preset').disabled = busy;
  $('apply-preset').disabled = busy || !audio || !$('sound-preset').value;
  for (const input of document.querySelectorAll('[data-effect]')) input.disabled = busy || !audio;
  for (const id of ['user-preset', 'preset-name', 'exact-duration', 'song-title', 'song-favorite', 'song-tags', 'refresh-library']) $(id).disabled = busy;
  $('export-seconds').disabled = busy || !$('exact-duration').checked;
  $('save-user-preset').disabled = busy || !audio;
  $('apply-user-preset').disabled = busy || !audio || !$('user-preset').value;
  $('save-library-info').disabled = busy || !libraryName;
  $('library-edit-target').textContent = libraryName ? 'Library info updates ' + libraryName + ' only. Save Song writes a new score.' : 'Save or open a library song to update its title, favorite flag and tags.';
  const genre = $('genre').value;
  $('set-genre-default').disabled = busy || !audio || song.genre !== genre || !GENRES[genre].instruments || GENRES[genre].composed;
  $('reset-genre-default').disabled = busy || !genreDefaults[genre];
  $('genre-default-state').textContent = genreDefaultState(genre);
  $('undo').disabled = busy || !history.canUndo();
  $('redo').disabled = busy || !history.canRedo();
  for (const button of document.querySelectorAll('[data-library]')) button.disabled = busy || button.dataset.broken === 'true';
}
const names = { keys: 'Keys / melody', pad: 'Pad / chords', bass: 'Bass', drums: 'Drums' };
for (const [id, genre] of Object.entries(GENRES)) {
  const option = document.createElement('option');
  option.value = id; option.textContent = genre.name; $('genre').append(option);
}
$('genre').addEventListener('change', () => { sync(); $('status').textContent = 'Click Generate to apply the genre. Auto patterns use its rules; clear BPM for its tempo.'; });
function genreDefaultState(genre) {
  if (!GENRES[genre].instruments) return 'Original has no genre default instruments.';
  if (GENRES[genre].composed) return GENRES[genre].name + ' is a composed cue set, so its parts keep their scored instruments.';
  const source = genreDefaults[genre] ? 'your saved default' : personalDefaults[genre] ? 'personal-defaults.json' : 'the built-in default';
  return GENRES[genre].name + ' starts from ' + source + ': ' + PARTS.map(part => INSTRUMENTS[genreDefault(genre, part, composeOptions()).instrument].name).join(', ') + '.';
}
$('set-genre-default').addEventListener('click', async () => {
  const genre = song.genre;
  genreDefaults = { ...genreDefaults, [genre]: captureGenreDefault(song) };
  if (await savePalette()) $('status').textContent = GENRES[genre].name + ' default saved. Generate and Clear now start from these instruments and effects.';
  sync();
});
$('reset-genre-default').addEventListener('click', async () => {
  const genre = $('genre').value;
  genreDefaults = { ...genreDefaults };
  delete genreDefaults[genre];
  if (await savePalette()) $('status').textContent = GENRES[genre].name + ' default reset. New songs use ' + (personalDefaults[genre] ? 'personal-defaults.json.' : 'the built-in instruments.');
  sync();
});
for (const [id, preset] of Object.entries(SOUND_PRESETS)) {
  const option = document.createElement('option');
  option.value = id; option.textContent = preset.name; $('sound-preset').append(option);
}
$('sound-preset').addEventListener('change', () => {
  sync();
  $('status').textContent = "Apply preset keeps the main parts' notes. Echo tide builds a repeating figure in a second Keys part.";
});
$('apply-preset').addEventListener('click', () => {
  try { renderPreview(applySoundPreset(song, $('sound-preset').value, { locks }), 'Sound preset applied.'); }
  catch (err) { $('status').textContent = "Couldn't apply preset: " + err.message; }
});
function trackName(id) {
  const track = song.tracks.find(t => t.id === id);
  const suffix = id.split('-')[1];
  return names[partType(track)] + (suffix ? ' ' + suffix : '');
}
for (const part of PARTS) {
  const group = document.createElement('span');
  group.className = 'seed';
  const count = document.createElement('output');
  count.id = 'count-' + part; count.textContent = names[part] + ': 1';
  group.append(count);
  for (const [action, label] of [['remove', '-'], ['add', '+']]) {
    const button = document.createElement('button');
    button.textContent = label; button.disabled = true; button.dataset.count = part; button.dataset.action = action;
    button.setAttribute('aria-label', (action === 'add' ? 'Add ' : 'Remove last ') + names[part]);
    button.title = tip('count.' + action, { part: names[part] });
    button.addEventListener('click', () => {
      let next = action === 'add' ? addPart(song, part, undefined, composeOptions()) : removePart(song, song.tracks.filter(t => partType(t) === part).at(-1).id);
      if (action === 'add' && $('vary-instruments').checked) {
        const track = next.tracks.at(-1);
        next = { ...next, tracks: next.tracks.map(t => t.id === track.id ? selectPartInstrument(next, t, composeOptions()) : t) };
      }
      renderPreview(next, names[part] + ' part ' + (action === 'add' ? 'added.' : 'removed.'));
    });
    group.append(button);
  }
  $('part-counts').append(group);
}
const newSeed = () => crypto.getRandomValues(new Uint32Array(1))[0];
for (const [id, feel] of Object.entries(FEELINGS)) {
  const option = document.createElement('option');
  option.value = id;
  option.textContent = feel.name;
  $('feeling').append(option);
}
for (const key of KEYS) {
  const option = document.createElement('option');
  option.value = key; option.textContent = key; $('key').append(option);
}
for (const id of ['key', 'mode']) $(id).addEventListener('change', () => {
  $('status').textContent = 'Click Generate to compose new notes in the selected key and mode.';
});
$('feeling').addEventListener('change', () => { $('status').textContent = 'Click Generate to apply ' + FEELINGS[$('feeling').value].name + '. Clear BPM for its automatic tempo; Auto patterns follow the mood.'; });
for (const [id, use] of Object.entries(USES)) {
  const option = document.createElement('option');
  option.value = id;
  option.textContent = use.name;
  $('use').append(option);
}
$('use').addEventListener('change', () => { $('status').textContent = 'Click Generate to apply ' + USES[$('use').value].name + '. Clear BPM for its automatic tempo; Auto rhythm follows the use.'; });
for (const [id, name] of Object.entries(FORMS)) {
  const option = document.createElement('option');
  option.value = id; option.textContent = name; $('form').append(option);
}
$('form').addEventListener('change', () => { $('status').textContent = 'Click Generate to apply the form.'; });
$('long-track').addEventListener('change', () => {
  if ($('long-track').checked && $('form').value === 'sketch') $('form').value = 'song';
  sync();
  $('status').textContent = 'Click Generate to apply the length.';
});
$('form').addEventListener('change', () => { if ($('form').value === 'sketch') $('long-track').checked = false; sync(); });
$('length').addEventListener('input', () => {
  const seconds = Number($('length').value);
  $('length-value').textContent = Math.floor(seconds / 60) + ':' + String(seconds % 60).padStart(2, '0');
});
$('cancel-render').addEventListener('click', () => { canceled = true; cancelRender(); });
for (const [id, family] of Object.entries(MELODIES)) {
  const option = document.createElement('option');
  option.value = id; option.textContent = family.name; $('melody').append(option);
}
$('melody').addEventListener('change', () => { $('status').textContent = 'Click Generate to apply the melody family.'; });
for (const [id, family] of Object.entries(DRUMS)) {
  const option = document.createElement('option');
  option.value = id; option.textContent = family.name; $('drums').append(option);
}
$('drums').addEventListener('change', () => { $('status').textContent = 'Click Generate to apply the drum pattern.'; });
for (const [id, family] of Object.entries(BASS)) {
  const option = document.createElement('option');
  option.value = id; option.textContent = family.name; $('bass').append(option);
}
$('bass').addEventListener('change', () => { $('status').textContent = 'Click Generate to apply the bass pattern.'; });
for (const [id, family] of Object.entries(HARMONIES)) {
  const option = document.createElement('option');
  option.value = id; option.textContent = family.name; $('progression').append(option);
}
$('progression').addEventListener('change', () => { $('status').textContent = 'Click Generate to rebuild the pitched parts around this harmony.'; });
for (const [id, family] of Object.entries(PADS)) {
  const option = document.createElement('option');
  option.value = id; option.textContent = family.name; $('pad').append(option);
}
$('pad').addEventListener('change', () => { $('status').textContent = 'Click Generate to apply the pad pattern.'; });
function updateView() {
  if (!audio) return;
  const span = 1 / Number($('wave-zoom').value);
  const start = Number($('wave-scroll').value) / 100 * (1 - span);
  const duration = audioFrames() / audio.sampleRate;
  wave.setView(start, start + span);
  for (const partWave of partWaves.values()) partWave.setView(start, start + span);
  $('wave-range').textContent = (start * duration).toFixed(2) + ' s - ' + ((start + span) * duration).toFixed(2) + ' s';
}
$('wave-zoom').addEventListener('change', () => { updateView(); sync(); });
$('wave-scroll').addEventListener('input', updateView);
function effectControls(track) {
  const panel = document.createElement('details');
  panel.className = 'part-effects';
  panel.open = openEffects.has(track.id);
  panel.addEventListener('toggle', () => { if (panel.open) openEffects.add(track.id); else openEffects.delete(track.id); });
  const heading = document.createElement('summary');
  heading.textContent = 'Effects' + (track.effects === undefined ? ' (original sound)' : ' (custom)');
  heading.title = tip('part.effects');
  panel.append(heading);
  const change = effects => {
    openEffects.add(track.id);
    const next = structuredClone(song);
    const part = next.tracks.find(t => t.id === track.id);
    if (effects === undefined) delete part.effects;
    else part.effects = effects;
    renderPreview(next, trackName(track.id) + ' effects changed. Notes kept.');
  };
  const toggle = (label, checked, action, hover = '') => {
    const row = document.createElement('label'), input = document.createElement('input');
    input.type = 'checkbox'; input.checked = checked; input.dataset.effect = track.id;
    input.setAttribute('aria-label', trackName(track.id) + ' ' + label);
    input.addEventListener('change', () => action(input.checked));
    row.title = hover;
    row.append(input, label); panel.append(row);
  };
  toggle('Custom effects', track.effects !== undefined, checked => change(checked ? {} : undefined), tip('effect.custom'));
  if (track.effects === undefined) return panel;
  const specs = [
    ['delay', 'Delay', { mix: .18, beats: .5, feedback: .35, damp: .45 }, [['mix', 'Wet', 0, 1, .01], ['beats', 'Beats', .125, 2, .125], ['feedback', 'Feedback', 0, .75, .01], ['damp', 'Darkening', 0, 1, .01]]],
    ['reverb', 'Reverb', { mix: .18, size: .6, damp: .45 }, [['mix', 'Wet', 0, 1, .01], ['size', 'Size', .2, 1, .01], ['damp', 'Darkening', 0, 1, .01]]],
    ['crush', 'Bit reduction', { mix: .2, bits: 10, rate: 2 }, [['mix', 'Wet', 0, 1, .01], ['bits', 'Bits', 4, 16, 1], ['rate', 'Sample hold', 1, 16, 1]]],
    ['tone', 'Tone', { mix: 1, cut: .7, warmth: .15 }, [['mix', 'Amount', 0, 1, .01], ['cut', 'Brightness', 0, 1, .01], ['warmth', 'Warmth', 0, 1, .01]]],
    ['hall', 'Hall reverb', { mix: .3, size: .6, damp: .5, predelay: .02 }, [['mix', 'Wet', 0, 1, .01], ['size', 'Size', 0, 1, .01], ['damp', 'Darkening', 0, 1, .01], ['predelay', 'Pre-delay (s)', 0, .12, .005]]],
    ['soften', 'Soften attacks', { mix: 1, amount: .5 }, [['mix', 'Amount', 0, 1, .01], ['amount', 'Depth', 0, 1, .01]]],
    ['eq', 'Air and low-mid EQ', { mix: 1, air: .4, mud: .4 }, [['mix', 'Amount', 0, 1, .01], ['air', 'Air', 0, 1, .01], ['mud', 'Low-mid cut', 0, 1, .01]]],
    ['tape', 'Tape / lo-fi', { mix: 1, width: .15, drive: .4, wow: .4, squash: .6 }, [['mix', 'Wet', 0, 1, .01], ['width', 'Stereo width', 0, 1, .01], ['drive', 'Drive', 0, 1, .01], ['wow', 'Wobble', 0, 1, .01], ['squash', 'Squash', 0, 1, .01]]],
    ['wide', 'Stereo chorus / width', { mix: .5, depth: .4 }, [['mix', 'Wet', 0, 1, .01], ['depth', 'Sweep', 0, 1, .01]]],
    ['pump', 'Pump / sidechain duck', { mix: .5, beats: 1, release: .6 }, [['mix', 'Depth', 0, 1, .01], ['beats', 'Every (beats)', .25, 2, .25], ['release', 'Recovery', .1, 1, .01]]],
  ];
  for (const [key, name, defaults, fields] of specs) {
    toggle(name, Boolean(track.effects[key]), checked => {
      const effects = structuredClone(track.effects);
      if (checked) effects[key] = defaults; else delete effects[key];
      change(effects);
    });
    if (!track.effects[key]) continue;
    const group = document.createElement('div'); group.className = 'effect-fields';
    for (const [field, label, min, max, step] of fields) {
      const row = document.createElement('label'), input = document.createElement('input');
      input.type = 'number'; input.min = min; input.max = max; input.step = step;
      input.value = track.effects[key][field]; input.required = true; input.dataset.effect = track.id;
      input.setAttribute('aria-label', trackName(track.id) + ' ' + name + ' ' + label);
      row.title = tip('effect.' + key + '.' + field) || tip('effect.' + field);
      input.addEventListener('change', () => {
        if (!input.reportValidity()) return;
        const effects = structuredClone(track.effects); effects[key][field] = Number(input.value); change(effects);
      });
      row.append(label + ' ', input); group.append(row);
    }
    panel.append(group);
  }
  return panel;
}
function showParts() {
  $('bars').textContent = song.bars + ' bars';
  $('tempo').textContent = song.tempo + ' BPM';
  $('harmony').textContent = song.harmony.name + ' / ' +
    (song.genre && song.progression === 'auto' ? GENRES[song.genre].name + ' harmony' : chooseHarmony(song).name);
  $('groove').textContent = song.groove.replace('-', ' ');
  for (const partWave of partWaves.values()) partWave.destroy();
  partWaves.clear();
  $('tracks').replaceChildren();
  $('sections').replaceChildren();
  for (const section of song.sections ?? []) {
    const button = document.createElement('button');
    button.textContent = section.name + ' / bar ' + (section.bar + 1);
    button.dataset.section = section.name;
    button.title = tip('section.play');
    button.addEventListener('click', () => seekPlayback(tickSample(song, section.bar * 4 * song.ppq) / audioFrames()));
    $('sections').append(button);
  }
  for (const part of PARTS) $('count-' + part).textContent = names[part] + ': ' + song.tracks.filter(t => partType(t) === part).length;
  for (const track of song.tracks) {
    const part = partType(track);
    const item = document.createElement('li');
    item.dataset.track = track.id;
    item.dataset.type = part;
    const title = document.createElement('strong');
    title.textContent = trackName(track.id);
    const info = document.createElement('span');
    info.textContent = track.notes.length + ' notes / part seed ' + track.seed +
      (song.genre && song[['melody', 'pad', 'bass', 'drums'][PARTS.indexOf(part)]] === 'auto' ? ' / ' + GENRES[song.genre].name + ' pattern' :
        part === 'keys' ? ' / ' + chooseMelody(song, track.seed).name : part === 'drums' ? ' / ' + chooseDrums(song, track.seed).name : part === 'bass' ? ' / ' + chooseBass(song, track.seed).name : ' / ' + choosePad(song, track.seed).name);
    if ($('vary-instruments').checked && $('favorites-only').checked && !locks[track.id]?.instrument && instrumentChoices(song, track, composeOptions()).favoritesFallback)
      info.textContent += ' / No favorite fits, using the genre\'s instruments';
    const button = document.createElement('button');
    button.textContent = 'Change notes';
    button.dataset.part = track.id;
    button.setAttribute('aria-label', 'Change ' + track.id + ' notes');
    button.title = tip('part.change-notes');
    button.addEventListener('click', () => renderPreview(rerollPart(song, track.id, newSeed()), trackName(track.id) + ' changed. Other parts kept.'));
    const canvas = document.createElement('canvas');
    canvas.className = 'wave';
    canvas.setAttribute('aria-label', trackName(track.id) + ' waveform');
    canvas.title = tip('wave.seek');
    const controls = document.createElement('div');
    controls.className = 'part-controls';
    const lockControls = document.createElement('div');
    lockControls.className = 'part-locks';
    lockControls.append('Keep on Generate: ');
    for (const [key, text] of [['notes', 'Notes'], ['instrument', 'Instrument'], ['mix', 'Mix']]) {
      const lock = document.createElement('button');
      lock.textContent = text; lock.dataset.lock = track.id;
      lock.setAttribute('aria-label', 'Keep ' + trackName(track.id) + ' ' + (key === 'mix' ? 'mix and effects' : key) + ' on Generate');
      lock.setAttribute('aria-pressed', String(Boolean(locks[track.id]?.[key])));
      lock.title = tip('part.keep-' + key);
      lock.addEventListener('click', () => {
        remember();
        locks[track.id] ??= {};
        locks[track.id][key] = !locks[track.id][key];
        lock.setAttribute('aria-pressed', String(locks[track.id][key]));
      });
      lockControls.append(lock);
    }
    controls.append(lockControls);
    if (part === 'keys' && song.arrangement === 'developed-v1' && song.melody === 'auto') {
      const label = document.createElement('label');
      label.textContent = 'Role ';
      const select = document.createElement('select');
      select.dataset.part = track.id;
      select.setAttribute('aria-label', trackName(track.id) + ' musical role');
      select.title = tip('part.role');
      for (const [id, name] of Object.entries(KEY_ROLES)) {
        const option = document.createElement('option');
        option.value = id;
        option.textContent = id === 'auto' ? 'Auto (' + KEY_ROLES[keyRole(track.id)] + ')' : name;
        select.append(option);
      }
      select.value = track.role ?? 'auto';
      select.addEventListener('change', () => renderPreview(changeKeyRole(song, track.id, select.value), trackName(track.id) + ' role changed. Other parts kept.'));
      label.append(select); controls.append(label);
    }
    if (Object.values(INSTRUMENTS).filter((instrument) => instrument.part === part).length > 1) {
      const label = document.createElement('label');
      label.textContent = 'Instrument ';
      const select = document.createElement('select');
      select.dataset.instrument = track.id;
      select.setAttribute('aria-label', trackName(track.id) + ' instrument');
      select.title = tip('part.instrument');
      for (const [id, instrument] of Object.entries(INSTRUMENTS)) {
        if (instrument.part !== part || !instrumentReady(id, available)) continue;
        const option = document.createElement('option');
        option.value = id;
        option.textContent = instrument.name;
        select.append(option);
      }
      select.value = track.instrument;
      const feedback = document.createElement('span');
      feedback.className = 'instrument-feedback';
      feedback.setAttribute('role', 'status');
      select.addEventListener('change', () => {
        const requested = select.value;
        feedback.replaceChildren();
        try { renderPreview(swapInstrument(song, track.id, select.value), trackName(track.id) + ' instrument changed. Notes kept.'); }
        catch (err) {
          select.value = track.instrument;
          $('status').textContent = err.message;
          feedback.textContent = err.message + '. Current instrument kept.';
          if (part !== 'drums') {
            let fitted;
            try { fitted = fitPitchedInstrument(song, track.id, requested); }
            catch (fitError) { feedback.textContent += ' ' + fitError.message; return; }
            const apply = document.createElement('button');
            apply.dataset.part = track.id;
            const count = Math.abs(fitted.octaves);
            apply.textContent = fitted.folded ? 'Fit notes to ' + INSTRUMENTS[requested].name + ' range' : (fitted.octaves < 0 ? 'Lower ' : 'Raise ') + count + (count === 1 ? ' octave' : ' octaves') + ' and use ' + INSTRUMENTS[requested].name;
            apply.addEventListener('click', () => renderPreview(fitted.song, INSTRUMENTS[requested].name + (fitted.folded ? ' applied with octave moves per note. Rhythm and pitch classes kept.' : ' applied with an octave shift. Rhythm kept.')));
            feedback.append(apply);
          }
        }
      });
      label.append(select);
      controls.append(label, feedback);
      const favorite = document.createElement('button');
      favorite.textContent = 'Favorite'; favorite.dataset.favorite = track.id;
      favorite.setAttribute('aria-label', 'Favorite ' + INSTRUMENTS[track.instrument].name);
      favorite.setAttribute('aria-pressed', String(favorites.includes(track.instrument)));
      favorite.title = tip('part.favorite');
      favorite.addEventListener('click', () => {
        remember();
        if (favorites.includes(track.instrument)) favorites = favorites.filter(id => id !== track.instrument);
        else favorites.push(track.instrument);
        for (const button of document.querySelectorAll('[data-favorite]')) {
          const instrument = song.tracks.find(t => t.id === button.dataset.favorite).instrument;
          button.setAttribute('aria-pressed', String(favorites.includes(instrument)));
        }
        paletteSummary(); savePalette();
      });
      controls.append(favorite);
    }
    if (part !== 'drums') {
      const octave = document.createElement('span');
      const offset = track.octaves ?? 0;
      octave.textContent = 'Octave ' + (offset > 0 ? '+' : '') + offset + ' ';
      for (const step of [-1, 1]) {
        const shift = document.createElement('button');
        shift.textContent = step < 0 ? '−' : '+';
        shift.dataset.part = track.id;
        shift.setAttribute('aria-label', (step < 0 ? 'Lower ' : 'Raise ') + trackName(track.id) + ' one octave');
        shift.title = tip(step < 0 ? 'part.octave-down' : 'part.octave-up');
        shift.addEventListener('click', () => {
          try { renderPreview(shiftOctave(song, track.id, step), trackName(track.id) + ' octave changed. Rhythm kept.'); }
          catch (err) { $('status').textContent = err.message; }
        });
        octave.append(shift);
      }
      controls.append(octave);
    }
    const level = document.createElement('label');
    level.className = 'part-level';
    level.append('Level ');
    const slider = document.createElement('input');
    slider.type = 'range';
    slider.min = '0';
    slider.max = '200';
    slider.step = '1';
    slider.value = Math.round((gains[track.id] ?? 1) * 100);
    slider.dataset.gain = track.id;
    slider.setAttribute('aria-label', trackName(track.id) + ' level');
    slider.title = tip('part.level');
    const value = document.createElement('output');
    value.textContent = slider.value + '%';
    slider.addEventListener('input', () => {
      if (slider.dataset.editing !== 'true') { remember(); slider.dataset.editing = 'true'; }
      gains[track.id] = Number(slider.value) / 100;
      value.textContent = slider.value + '%';
      slider.setAttribute('aria-valuetext', value.textContent);
      updateMix(track.id);
    });
    slider.addEventListener('change', () => { delete slider.dataset.editing; sync(); });
    slider.setAttribute('aria-valuetext', value.textContent);
    level.append(slider, value);
    const remove = document.createElement('button');
    remove.textContent = 'Remove'; remove.dataset.part = track.id;
    remove.setAttribute('aria-label', 'Remove ' + trackName(track.id));
    remove.title = tip('part.remove');
    remove.addEventListener('click', () => renderPreview(removePart(song, track.id), trackName(track.id) + ' removed.'));
    const reset = document.createElement('button');
    reset.textContent = '100%'; reset.dataset.part = track.id; reset.title = tip('part.level-reset');
    reset.addEventListener('click', () => { remember(); gains[track.id] = 1; slider.value = '100'; value.textContent = '100%'; slider.setAttribute('aria-valuetext', '100%'); updateMix(track.id); });
    level.append(reset);
    const balance = document.createElement('label'), pan = document.createElement('input'), panValue = document.createElement('output');
    balance.className = 'part-level'; balance.append('Pan ');
    pan.type = 'range'; pan.min = '-100'; pan.max = '100'; pan.step = '1'; pan.value = Math.round((pans[track.id] ?? 0) * 100); pan.dataset.pan = track.id;
    pan.setAttribute('aria-label', trackName(track.id) + ' pan');
    pan.title = tip('part.pan');
    const labelPan = () => { panValue.textContent = Number(pan.value) === 0 ? 'Center' : Math.abs(Number(pan.value)) + '% ' + (pan.value < 0 ? 'L' : 'R'); pan.setAttribute('aria-valuetext', panValue.textContent); };
    labelPan();
    pan.addEventListener('input', () => { if (pan.dataset.editing !== 'true') { remember(); pan.dataset.editing = 'true'; } pans[track.id] = Number(pan.value) / 100; labelPan(); updateMix(track.id); });
    pan.addEventListener('change', () => { delete pan.dataset.editing; sync(); });
    const center = document.createElement('button'); center.textContent = 'Center'; center.dataset.part = track.id; center.title = tip('part.center');
    center.addEventListener('click', () => { remember(); pans[track.id] = 0; pan.value = '0'; labelPan(); updateMix(track.id); });
    balance.append(pan, panValue, center);
    const peakRow = document.createElement('label'), meter = document.createElement('meter'), peakText = document.createElement('output');
    peakRow.className = 'part-level'; peakRow.append('Part peak '); meter.min = 0; meter.max = 1; meter.high = .891; meter.dataset.peak = track.id; peakText.dataset.peakText = track.id; peakRow.append(meter, peakText);
    const playing = document.createElement('label'), style = document.createElement('select'); playing.append('Playing '); style.dataset.playing = track.id;
    for (const [id, name] of Object.entries(PLAYING[part])) { const option = document.createElement('option'); option.value = id; option.textContent = name; style.append(option); }
    style.value = track.playing ?? (song.performance ? 'auto' : 'plain');
    style.title = song.performance ? tip('part.playing', { style: PLAYING[part][playingStyle(song, track)] }) : tip('part.playing-saved');
    style.addEventListener('change', () => renderPreview(changePlaying(song, track.id, style.value), trackName(track.id) + ' playing changed. Other parts kept.'));
    playing.append(style);
    controls.append(level, balance, peakRow, playing, button, remove, effectControls(track));
    for (const [label, selection] of [['Mute', muted], ['Solo', solo]]) {
      const toggle = document.createElement('button');
      toggle.textContent = label;
      toggle.dataset.part = track.id;
      toggle.dataset.action = label.toLowerCase();
      toggle.setAttribute('aria-label', label + ' ' + trackName(track.id));
      toggle.title = tip('part.' + label.toLowerCase());
      toggle.addEventListener('click', () => {
        remember();
        if (selection.has(track.id)) selection.delete(track.id);
        else selection.add(track.id);
        updateMix();
      });
      controls.append(toggle);
    }
    const timeline = document.createElement('div');
    timeline.className = 'timeline';
    timeline.textContent = 'Track length: ' + (audioFrames() / audio.sampleRate).toFixed(2) + ' s / instrument: ' + INSTRUMENTS[track.instrument].name;
    item.append(title, info, canvas, timeline, controls);
    $('tracks').append(item);
    const partWave = createWaveform(canvas, { combine: true, onSeek: seekPlayback });
    const rendered = audio.parts.find((part) => part.id === track.id);
    partWave.show(rendered.envelope ?? rendered.channels, gains[track.id] ?? 1);
    partWaves.set(track.id, partWave);
  }
}
async function renderPreview(next, message = 'Ready. Play the song or save a WAV.', saved = null, reset = false, restoring = false) {
  const installed = installedSong(next, composeOptions());
  if (installed.swapped.length) {
    next = installed.song;
    message += (/[.!?]$/.test(message) ? ' ' : '. ') + 'Not installed, swapped to the genre default: ' + installed.swapped.map(s => INSTRUMENTS[s.from].name + ' → ' + INSTRUMENTS[s.to].name).join(', ') + '.';
  }
  const previous = audio;
  const before = snapshot();
  let cacheId = null, writes = Promise.resolve(), committed = false;
  busy = true;
  rendering = true; canceled = false;
  stop();
  audio = null;
  ++meterRevision; clearTimeout(meterTimer);
  $('loudness').textContent = 'Integrated loudness: not measured';
  wave.show(null);
  $('duration').textContent = 'Rendering…';
  $('status').textContent = next.form === 'loop' && next.tracks.some(track => Object.values(track.effects ?? {}).some(effect => effect.mix > 0))
    ? 'Preparing the loop…' : 'Rendering the song…';
  sync();
  try {
    const banks = new Map();
    for (const track of next.tracks.filter(t => INSTRUMENTS[t.instrument].sample)) {
      if (!banks.has(track.instrument)) banks.set(track.instrument, new Set());
      for (const note of track.notes) banks.get(track.instrument).add(note.midi);
    }
    const samples = (await Promise.all([...banks].map(([id, notes]) => window.api.pianoSamples([...notes], id)))).flat();
    if (canceled) throw new Error('Rendering canceled');
    const progress = value => { $('status').textContent = 'Rendering ' + Math.round(value * 100) + '%…'; };
    const end = tickSample(next, next.bars * 4 * next.ppq);
    if (end / next.output.sampleRate > 30) {
      const meta = { frames: effectFrames(next),
        sampleRate: next.output.sampleRate, loop: next.form === 'loop' ? { start: 0, end } : null,
        parts: next.tracks.map(t => ({ id: t.id, instrument: t.instrument })) };
      cacheId = await window.api.beginPreview(meta);
      if (canceled) throw new Error('Rendering canceled');
      const result = await renderCached(next, samples, block => {
        writes = Promise.all(block.parts.map(part => window.api.appendPreview(cacheId, part.id, block.at, part.channels)));
        return writes;
      }, progress);
      await window.api.finishPreview(cacheId, { gain: result.gain });
      if (canceled) throw new Error('Rendering canceled');
      audio = { ...result, cacheId }; cacheId = null;
    } else audio = await render(next, samples, progress);
    song = next;
    if (reset && !$('keep-mix').checked) {
      for (const id of muted) if (!locks[id]?.mix) muted.delete(id);
      for (const id of solo) if (!locks[id]?.mix) solo.delete(id);
      for (const id of Object.keys(gains)) if (!locks[id]?.mix) delete gains[id];
      for (const id of Object.keys(pans)) if (!locks[id]?.mix) delete pans[id];
    }
    if (saved) {
      $('song-title').value = saved.library?.title ?? '';
      $('song-favorite').checked = saved.library?.favorite ?? false;
      $('song-tags').value = (saved.library?.tags ?? []).join(', ');
      $('exact-duration').checked = saved.exportSeconds != null;
      $('export-seconds').value = saved.exportSeconds ?? 30;
      libraryName = saved.libraryName ?? null;
      const savedPath = saved.path?.replaceAll('\\', '/');
      if (savedPath?.toLowerCase().startsWith(libraryDir.toLowerCase()) && !savedPath.slice(libraryDir.length).includes('/')) {
        libraryName = savedPath.slice(libraryDir.length);
      }
      $('normalize-wav').checked = saved.normalizeWav ?? false;
      muted.clear(); saved.mix.muted.forEach((id) => muted.add(id));
      solo.clear(); saved.mix.solo.forEach((id) => solo.add(id));
      for (const id of Object.keys(gains)) delete gains[id];
      Object.assign(gains, saved.mix.gains);
      for (const id of Object.keys(pans)) delete pans[id];
      Object.assign(pans, saved.mix.pans ?? {});
      $('keep-mix').checked = saved.generation?.keepMix ?? settings.music?.keepMix ?? true;
      repeat = saved.repeat;
      setLoop(repeat);
      $('repeat').setAttribute('aria-pressed', String(repeat));
      locks = structuredClone(saved.generation?.locks ?? {});
      $('vary-instruments').checked = saved.generation?.varyInstruments ?? false;
      $('favorites-only').checked = saved.generation?.favoritesOnly ?? false;
      if (saved.generation) favorites = [...saved.generation.favorites];
      paletteSummary(); savePalette();
    }
    $('seed').value = song.seed;
    $('bpm').value = song.tempo;
    $('key').value = KEYS[song.harmony.root % 12];
    $('mode').value = song.harmony.mode;
    $('feeling').value = song.feeling ?? 'neutral';
    $('genre').value = song.genre ?? 'original';
    $('sound-preset').value = song.soundPreset ?? '';
    $('use').value = song.use ?? 'sketch';
    $('form').value = song.form ?? 'sketch';
    $('long-track').checked = Boolean(song.lengthSeconds);
    if (song.lengthSeconds) $('length').value = song.lengthSeconds;
    $('length').dispatchEvent(new Event('input'));
    $('melody').value = song.melody ?? 'original';
    $('drums').value = song.drums ?? 'original';
    $('bass').value = song.bass ?? 'original';
    $('progression').value = song.progression ?? 'original';
    $('pad').value = song.pad ?? 'original';
    $('loop-info').textContent = audio.loop ? 'Loop: Repeat and WAV export use the same ' + song.bars + '-bar cycle.' : 'Repeat restarts the preview, including its release tail. Choose Loop for a repeating WAV.';
    if (song.sections) $('loop-info').textContent += ' Sections: ' + song.sections.map(s => s.name).join(' → ') + '.';
    const ids = new Set(song.tracks.map(t => t.id));
    for (const id of muted) if (!ids.has(id)) muted.delete(id);
    for (const id of solo) if (!ids.has(id)) solo.delete(id);
    for (const id of Object.keys(gains)) if (!ids.has(id)) delete gains[id];
    for (const id of Object.keys(pans)) if (!ids.has(id)) delete pans[id];
    for (const id of Object.keys(locks)) if (!ids.has(id)) delete locks[id];
    for (const id of openEffects) if (!ids.has(id)) openEffects.delete(id);
    audio.partPeaks = Object.fromEntries(audio.parts.map(p => [p.id, (p.envelope ? p.envelope.maxs : p.channels).map((ch, c) => { let peak = 0; for (const x of ch) peak = Math.max(peak, Math.abs(x)); if (p.envelope) for (const x of p.envelope.mins[c]) peak = Math.max(peak, Math.abs(x)); return peak; })]));
    showParts();
    updateMix();
    $('duration').textContent = (audioFrames() / audio.sampleRate).toFixed(2) + ' s';
    $('format').textContent = audio.sampleRate / 1000 + ' kHz / ' + song.output.bitDepth + '-bit WAV / stereo';
    $('status').textContent = message;
    if (!restoring && before) history.record(before);
    committed = true;
  } catch (err) {
    audio = previous;
    if (audio) { showParts(); updateMix(); }
    $('duration').textContent = audio ? (audioFrames() / audio.sampleRate).toFixed(2) + ' s' : 'Not rendered';
    $('status').textContent = "Couldn't render: " + err.message;
  } finally {
    try {
      if (cacheId !== null) { await writes.catch(() => {}); await window.api.releasePreview(cacheId); }
      if (committed && previous?.cacheId) await window.api.releasePreview(previous.cacheId);
    } catch (err) { $('status').textContent += ' Preview cleanup failed: ' + err.message; }
    finally { rendering = false; busy = false; sync(); }
  }
  return committed;
}
function generate() {
  if (!$('seed').reportValidity() || !$('bpm').reportValidity()) return;
  try {
    const options = composeOptions();
    const next = keepPartLayout(createProceduralSong(Number($('seed').value), $('feeling').value, $('use').value, $('form').value, $('melody').value, $('drums').value, $('bass').value, $('progression').value, $('pad').value, $('long-track').checked ? Number($('length').value) : null, $('bpm').value === '' ? null : Number($('bpm').value), $('key').value || null, $('mode').value || null, $('genre').value, options), song, options);
    let chosen = generateChoices(next, fresh ? null : song, options);
    fresh = false;
    if ($('sound-preset').value) chosen = applySoundPreset(chosen, $('sound-preset').value, { locks });
    else delete chosen.soundPreset;
    renderPreview(chosen, undefined, null, true);
  } catch (err) { $('status').textContent = "Couldn't generate: " + err.message; }
}
$('bpm').addEventListener('change', () => { $('status').textContent = 'Click Generate to apply BPM. Leave blank for automatic feeling, use or genre tempo.'; });
$('generate').addEventListener('click', generate);
$('new-seed').addEventListener('click', () => { $('seed').value = newSeed(); generate(); });
$('clear-choices').addEventListener('click', () => {
  remember();
  for (const id of ['key', 'mode', 'bpm']) $(id).value = '';
  for (const id of ['melody', 'drums', 'bass', 'progression', 'pad']) $(id).value = 'auto';
  $('seed').value = newSeed();
  $('sound-preset').value = '';
  locks = {};
  for (const button of document.querySelectorAll('[data-lock]')) button.setAttribute('aria-pressed', 'false');
  fresh = true;
  sync();
  $('status').textContent = 'Cleared to Auto with a new seed. Generate starts from the genre default instruments' + ($('vary-instruments').checked ? ', then varies them because Vary instruments is on.' : '.');
});
function seekPlayback(fraction) {
  if (busy || !audio) return;
  return startPlayback(fraction * audioFrames() / audio.sampleRate);
}
async function startPlayback(offset = 0) {
  const request = ++playbackRevision, value = audio, mix = mixSelection(), key = JSON.stringify(mix);
  stop();
  try {
    let peak;
    if (value.mixReading?.key === key) peak = value.mixReading.peak;
    else { const reading = await measureAudio(value, mix); if (request !== playbackRevision || audio !== value) return; value.mixReading = { key, ...reading }; peak = reading.peak; }
    if (request !== playbackRevision || audio !== value || busy) return;
    const gain = mixPeakGain(peak);
    if (value.cacheId) playStream(async (at, size) => (await readAudio(value, mix)(at, size)).map(ch => ch.map(x => x * gain)), value.frames, value.sampleRate,
      { loop: repeat, offset, onError: err => { $('status').textContent = "Couldn't play: " + err.message; } });
    else play(value.channels.map(ch => ch.map(x => x * gain)), value.sampleRate, { loop: repeat, offset });
    wave.animate(); for (const partWave of partWaves.values()) partWave.animate();
  } catch (err) { if (request === playbackRevision) $('status').textContent = "Couldn't play: " + err.message; }
}
function partPeak(id) {
  const balance = panLevels(pans[id]);
  return Math.max(...audio.partPeaks[id].map((peak, c) => peak * balance[c])) * (gains[id] ?? 1);
}
function updateMix(changed) {
  playbackRevision++;
  const playing = position() !== null;
  if (!audio.cacheId) audio.channels = mixParts(audio.parts, mixSelection(), audioFrames(), audio.channels);
  wave.show(audio.envelope ?? audio.channels);
  updateView();
  queueMeter();
  for (const item of $('tracks').children) {
    const id = item.dataset.track;
    const peak = partPeak(id);
    item.querySelectorAll('[data-peak]').forEach(m => { m.value = Math.min(1, peak); m.title = tip('part.peak'); });
    item.querySelectorAll('[data-peak-text]').forEach(o => { o.textContent = peak ? (20 * Math.log10(peak)).toFixed(1) + ' dBFS' : 'Silence'; });
    item.dataset.audible = String((gains[id] ?? 1) > 0 && !muted.has(id) && (!solo.size || solo.has(id)));
    if (id === changed) {
      const part = audio.parts.find(part => part.id === id);
      partWaves.get(id).show(part.envelope ?? part.channels, gains[id] ?? 1);
    }
    for (const button of item.querySelectorAll('[data-action]')) {
      button.setAttribute('aria-pressed', String((button.dataset.action === 'mute' ? muted : solo).has(id)));
    }
  }
  $('mix-state').textContent = (solo.size ? 'Solo: ' + [...solo].map(trackName).join(', ') : 'Full mix') +
    (muted.size ? ' / Muted: ' + [...muted].map(trackName).join(', ') : '');
  $('clear-solo').hidden = !solo.size;
  if (playing) startPlayback();
}
$('play').addEventListener('click', () => startPlayback());
$('clear-solo').addEventListener('click', () => { remember(); solo.clear(); updateMix(); });
$('stop').addEventListener('click', () => { playbackRevision++; stop(); });
$('repeat').addEventListener('click', () => {
  remember();
  repeat = !repeat;
  $('repeat').setAttribute('aria-pressed', String(repeat));
  setLoop(repeat);
});
for (const id of ['normalize-wav', 'exact-duration', 'export-seconds', 'song-title', 'song-favorite', 'song-tags']) {
  const input = $(id);
  let prior;
  input.addEventListener('focus', () => { prior = snapshot(); });
  input.addEventListener('pointerdown', () => { prior = snapshot(); });
  input.addEventListener('change', () => {
    const current = snapshot();
    if (prior && JSON.stringify(prior) !== JSON.stringify(current)) history.record(prior);
    prior = current; sync();
  });
}
async function restoreHistory(direction) {
  if (busy || !song) return;
  const current = snapshot(), destination = history[direction](current);
  if (!destination) return;
  const ok = await renderPreview(destination.song, direction === 'undo' ? 'Edit undone.' : 'Edit redone.', destination, false, true);
  if (!ok) history[direction === 'undo' ? 'redo' : 'undo'](destination);
  sync();
}
$('undo').addEventListener('click', () => restoreHistory('undo'));
$('redo').addEventListener('click', () => restoreHistory('redo'));
document.addEventListener('keydown', event => {
  if (!(event.ctrlKey || event.metaKey) || event.target?.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(event.target?.tagName)) return;
  const key = event.key.toLowerCase();
  if (key !== 'z' && key !== 'y') return;
  event.preventDefault(); restoreHistory(key === 'y' || event.shiftKey ? 'redo' : 'undo');
});
function exportSource(mix, partId = null) {
  const source = audioFrames(), frames = exportFrames(source, audio.sampleRate, exactSeconds());
  const channels = audio.cacheId ? null : partId === null ? mixParts(audio.parts, mix, source) : audio.parts.find(p => p.id === partId).channels;
  const rawRead = audio.cacheId ? (at, size) => window.api.readPreview(audio.cacheId, at, size, mix, partId)
    : (at, size) => {
      return channels.map(channel => channel.slice(at, at + size));
    };
  const balance = partId === null ? [1, 1] : panLevels(mix.pans?.[partId]);
  const read = async (at, size) => (await rawRead(at, size)).map((ch, c) => ch.map(x => x * balance[c]));
  return { frames, read: exportReader(read, source, frames, audio.sampleRate, exactSeconds()), loop: exportLoop(audio.loop, source, frames, exactSeconds()) };
}
$('save').addEventListener('click', async () => {
  if ($('exact-duration').checked && !$('export-seconds').reportValidity()) return;
  let exportId = null;
  busy = true;
  sync();
  $('status').textContent = 'Saving WAV…';
  try {
    const output = exportSource(mixSelection());
    $('status').textContent = 'Measuring adjusted mix…';
    const { lufs, peak } = await measureStream(output.read, output.frames, audio.sampleRate);
    let gain = mixPeakGain(peak), normalization = gain < 1 ? ' / peak protected' : '';
    if ($('normalize-wav').checked) {
      gain = loudnessGain(lufs, peak);
      const achieved = lufs + 20 * Math.log10(gain);
      normalization = Number.isFinite(achieved)
        ? ' / ' + achieved.toFixed(1) + ' LUFS' + (achieved < -16.05 ? ' (sample-peak ceiling reached)' : '')
        : ' / no loudness reading; level kept';
    }
    folder = (await window.api.soundsDir()) + '/music';
    $('folder').textContent = folder;
    let n = 1;
    let name;
    do { name = 'song_' + song.seed + '_' + String(n++).padStart(3, '0') + '.wav'; }
    while (await window.api.fileExists(folder, name));
    exportId = await window.api.beginWav(folder, name);
    let bytes = 0;
    const options = { bitDepth: song.output.bitDepth, loop: output.loop, gain };
    const chunks = encodeWavStream(output.read, output.frames, audio.sampleRate, options);
    for await (const chunk of chunks) {
      await window.api.appendWav(exportId, chunk); bytes += chunk.length;
      $('status').textContent = 'Saving WAV: ' + (bytes / 1048576).toFixed(1) + ' MiB…';
    }
    const target = await window.api.finishWav(exportId); exportId = null;
    $('status').textContent = 'Saved ' + target + normalization;
  } catch (err) {
    $('status').textContent = "Couldn't save: " + err.message;
  } finally {
    try { if (exportId !== null) await window.api.abortWav(exportId); }
    finally { busy = false; sync(); }
  }
});
$('open').addEventListener('click', async () => {
  try { await window.api.openInExplorer(folder); }
  catch (err) { $('status').textContent = "Couldn't open folder: " + err.message; }
});

$('save-midi').addEventListener('click', async () => {
  busy = true; sync();
  try {
    const target = await window.api.saveMidi({ format: 'bosstrack-song', v: 1, renderer: 'song-v1', song,
      mix: mixSelection(), repeat, normalizeWav: $('normalize-wav').checked, generation: generation() });
    folder = (await window.api.soundsDir()) + '/music';
    $('folder').textContent = folder;
    $('status').textContent = 'Saved MIDI ' + target;
  } catch (err) { $('status').textContent = "Couldn't save MIDI: " + err.message; }
  finally { busy = false; sync(); }
});
$('save-stems').addEventListener('click', async () => {
  if ($('exact-duration').checked && !$('export-seconds').reportValidity()) return;
  let exportId = null;
  busy = true; sync();
  try {
    $('status').textContent = 'Measuring all parts for stems…';
    const measured = exportSource({ gains: { ...gains }, pans: { ...pans } });
    const reading = await measureStream(measured.read, measured.frames, audio.sampleRate);
    const peak = Math.max(reading.peak, ...song.tracks.map(t => partPeak(t.id)));
    const gain = $('normalize-wav').checked ? loudnessGain(reading.lufs, peak) : mixPeakGain(peak);
    const files = song.tracks.map(track => track.id + '_' + track.instrument + '.wav');
    exportId = await window.api.beginStems(files);
    for (let i = 0; i < song.tracks.length; i++) {
      const track = song.tracks[i];
      const output = exportSource({ pans: { ...pans } }, track.id);
      const options = { bitDepth: song.output.bitDepth, loop: output.loop, gain: gain * (gains[track.id] ?? 1) };
      const chunks = encodeWavStream(output.read, output.frames, audio.sampleRate, options);
      for await (const chunk of chunks) {
        await window.api.appendStem(exportId, files[i], chunk);
        $('status').textContent = 'Saving stems: ' + (i + 1) + '/' + song.tracks.length + ' / ' + trackName(track.id);
      }
    }
    folder = await window.api.finishStems(exportId); exportId = null;
    $('folder').textContent = folder;
    $('status').textContent = 'Saved aligned stems to ' + folder;
  } catch (err) { $('status').textContent = "Couldn't save stems: " + err.message; }
  finally {
    try { if (exportId !== null) await window.api.abortStems(exportId); }
    finally { busy = false; sync(); }
  }
});

$('save-song').addEventListener('click', async () => {
  busy = true; sync();
  try {
    const file = snapshot(); delete file.libraryName;
    if (file.exportSeconds === null) delete file.exportSeconds;
    const target = await window.api.saveSong(file);
    libraryName = target.replaceAll('\\', '/').split('/').at(-1);
    folder = (await window.api.soundsDir()) + '/music';
    $('folder').textContent = folder;
    $('status').textContent = 'Saved song ' + target;
    await refreshLibrary();
  } catch (err) { $('status').textContent = "Couldn't save song: " + err.message; }
  finally { busy = false; sync(); }
});
$('open-song').addEventListener('click', async () => {
  busy = true; sync();
  try {
    const file = await window.api.openSong();
    if (file) await renderPreview(file.song, 'Opened ' + file.path, file);
  } catch (err) { $('status').textContent = 'Error loading song: ' + ipcMessage(err); }
  finally { busy = false; sync(); }
});
function showMixPresets() {
  const selected = $('mix-preset').value;
  $('mix-preset').replaceChildren();
  for (const [value, name] of [['', 'Choose a saved balance'], ...mixPresets.map((p, i) => [String(i), p.name])]) {
    const option = document.createElement('option'); option.value = value; option.textContent = name; $('mix-preset').append(option);
  }
  $('mix-preset').value = selected;
}
showMixPresets();
$('mix-preset').addEventListener('change', sync);
$('save-mix-preset').addEventListener('click', async () => {
  try {
    const preset = captureMixPreset(song, mixSelection(), $('mix-preset-name').value);
    const index = mixPresets.findIndex(p => p.name === preset.name);
    if (index < 0) mixPresets.push(preset); else mixPresets[index] = preset;
    const saved = await savePalette(); showMixPresets();
    $('mix-preset').value = String(index < 0 ? mixPresets.length - 1 : index); sync();
    if (saved) $('status').textContent = 'Saved balance ' + preset.name;
  } catch (err) { $('status').textContent = "Couldn't save balance: " + err.message; }
});
$('apply-mix-preset').addEventListener('click', () => {
  remember();
  const next = applyMixPreset(song, mixSelection(), mixPresets[Number($('mix-preset').value)], locks);
  for (const id of Object.keys(gains)) delete gains[id]; for (const id of Object.keys(pans)) delete pans[id];
  Object.assign(gains, next.gains); Object.assign(pans, next.pans); showParts(); updateMix(); sync();
});
$('reset-mix').addEventListener('click', () => {
  remember(); for (const id of Object.keys(gains)) delete gains[id]; for (const id of Object.keys(pans)) delete pans[id];
  showParts(); updateMix(); sync();
});
function showUserPresets() {
  const selected = $('user-preset').value;
  $('user-preset').replaceChildren();
  for (const [value, name] of [['', 'Choose a saved sound'], ...userPresets.map((preset, index) => [String(index), preset.name])]) {
    const option = document.createElement('option'); option.value = value; option.textContent = name; $('user-preset').append(option);
  }
  $('user-preset').value = selected;
}
showUserPresets();
$('user-preset').addEventListener('change', sync);
$('save-user-preset').addEventListener('click', async () => {
  try {
    const preset = captureSoundPreset(song, $('preset-name').value);
    const index = userPresets.findIndex(p => p.name === preset.name);
    if (index < 0) userPresets.push(preset); else userPresets[index] = preset;
    const saved = await savePalette(); showUserPresets();
    $('user-preset').value = String(index < 0 ? userPresets.length - 1 : index); sync();
    if (saved) $('status').textContent = 'Saved sound preset ' + preset.name;
  } catch (err) { $('status').textContent = "Couldn't save sound preset: " + err.message; }
});
$('apply-user-preset').addEventListener('click', () => {
  try { renderPreview(applyUserPreset(song, userPresets[Number($('user-preset').value)], { locks }), 'Saved sound applied.'); }
  catch (err) { $('status').textContent = "Couldn't apply saved sound: " + err.message; }
});
function showLibrary() {
  const query = $('library-search').value.trim().toLowerCase();
  const rows = libraryRows.filter(row => (!$('library-favorites').checked || row.favorite) &&
    [row.title, row.genre, row.name, ...(row.tags ?? [])].join(' ').toLowerCase().includes(query));
  $('song-library').replaceChildren();
  for (const row of rows) {
    const item = document.createElement('li'), title = document.createElement('strong'), details = document.createElement('span'), button = document.createElement('button');
    title.textContent = (row.favorite ? 'Favorite / ' : '') + (row.title || row.name);
    details.textContent = row.broken ? 'Error loading song: ' + row.error : [row.genre || 'Original', row.tempo + ' BPM', row.bars + ' bars', ...(row.tags ?? [])].join(' / ');
    button.textContent = 'Open'; button.dataset.library = row.name; button.dataset.broken = String(Boolean(row.broken));
    button.addEventListener('click', async () => {
      busy = true; sync();
      try {
        const file = await window.api.openLibrarySong(row.name);
        file.libraryName = row.name;
        await renderPreview(file.song, 'Opened ' + row.name, file);
      } catch (err) { $('status').textContent = 'Error loading song: ' + ipcMessage(err); }
      finally { busy = false; sync(); }
    });
    item.append(title, details, button); $('song-library').append(item);
  }
  $('library-state').textContent = rows.length + ' of ' + libraryRows.length + ' saved songs'; sync();
}
async function refreshLibrary() {
  try { libraryRows = await window.api.listSongs(); showLibrary(); }
  catch (err) { $('library-state').textContent = "Couldn't read song library: " + err.message; }
}
$('refresh-library').addEventListener('click', refreshLibrary);
$('library-search').addEventListener('input', showLibrary);
$('library-favorites').addEventListener('change', showLibrary);
$('save-library-info').addEventListener('click', async () => {
  busy = true; sync();
  try { await window.api.updateSongInfo(libraryName, libraryInfo()); await refreshLibrary(); $('status').textContent = 'Saved library info.'; }
  catch (err) { $('status').textContent = "Couldn't save library info: " + err.message; }
  finally { busy = false; sync(); }
});
function link(url, text = url) {
  const a = document.createElement('a');
  a.href = url; a.textContent = text;
  return a;
}
async function fillAbout() {
  const info = await window.api.aboutInfo();
  $('about-version').textContent = 'Version ' + info.version;
  $('about-notice').textContent = info.notice ?? 'NOTICE file not found.';
  $('about-license').textContent = info.license ?? 'LICENSE file not found.';
  const list = $('about-credits');
  list.replaceChildren();
  if (!info.credits.length) list.textContent = 'No recorded instruments are installed.';
  for (const group of info.credits) {
    const item = document.createElement('section');
    const title = document.createElement('h4');
    title.textContent = group.heading;
    const facts = document.createElement('p');
    facts.className = 'hint';
    facts.append('By ' + group.maker + ' · ', link(group.website, 'Website'), ' · ', link(group.licenseUrl, group.license), ' · Source: ');
    [group.source].flat().forEach((url, i) => facts.append(i ? ', ' : '', /^https:/.test(url) ? link(url, new URL(url).hostname) : url));
    const used = document.createElement('p');
    used.className = 'hint';
    used.textContent = 'Used by: ' + [...new Set(group.banks.flatMap(b => b.instruments))].join(', ');
    item.append(title, facts, used);
    list.append(item);
  }
}
let aboutFilled = null;
$('about-open').addEventListener('click', async () => {
  try { await (aboutFilled ??= fillAbout()); }
  catch (err) { aboutFilled = null; $('status').textContent = "Couldn't load the About page: " + err.message; return; }
  $('about').showModal();
});
$('about-close').addEventListener('click', () => $('about').close());
$('about').addEventListener('click', event => {
  const a = event.target.closest('a');
  if (!a) return;
  event.preventDefault();
  window.api.openLink(a.href).catch(err => { $('status').textContent = "Couldn't open link: " + err.message; });
});
sync();
