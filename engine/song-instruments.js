import { PALETTE } from './song-palette.js';

export const PARTS = ['keys', 'pad', 'bass', 'drums'];
export const MAX_PARTS = 8;
export const partType = track => track.part ?? track.id;

export const INSTRUMENTS = {
  ...PALETTE,
  horn_recorded: { name: 'Expressive French horn', part: 'keys', level: 0.3, pan: -0.12, sample: true, range: [36, 77], cache: 'bank-cinematic-horn', foldRange: true, expressive: true },
  horn_chords: { name: 'Expressive horn chords', part: 'pad', level: 0.13, pan: 0.15, sample: true, range: [36, 77], cache: 'bank-cinematic-horn', foldRange: true, expressive: true },
  trumpet_recorded: { name: 'Expressive trumpet', part: 'keys', level: 0.3, pan: -0.12, sample: true, range: [57, 84], cache: 'bank-cinematic-trumpet', foldRange: true, expressive: true },
  trombone_recorded: { name: 'Expressive trombone', part: 'keys', level: 0.32, pan: -0.1, sample: true, range: [34, 65], cache: 'bank-cinematic-trombone', foldRange: true, expressive: true },
  trombone_chords: { name: 'Expressive trombone chords', part: 'pad', level: 0.14, pan: 0.16, sample: true, range: [34, 65], cache: 'bank-cinematic-trombone', foldRange: true, expressive: true },
  tuba_recorded: { name: 'Expressive tuba', part: 'bass', level: 0.38, pan: 0, sample: true, range: [29, 62], cache: 'bank-cinematic-tuba', foldRange: true, expressive: true },
  violin_recorded: { name: 'Expressive violin section', part: 'keys', level: 0.3, pan: -0.18, sample: true, range: [55, 86], cache: 'bank-cinematic-violin', foldRange: true, expressive: true, shortBow: true },
  violin_chords: { name: 'Expressive violin chords', part: 'pad', level: 0.14, pan: 0.2, sample: true, range: [55, 86], cache: 'bank-cinematic-violin', foldRange: true, expressive: true, shortBow: true },
  violin_spiccato: { defaultArticulation: 'short', name: 'Short bowed violin chords', part: 'pad', level: 0.18, pan: 0.18, sample: true, range: [55, 86], cache: 'bank-cinematic-violin', foldRange: true, expressive: true, shortBow: true },
  cello_recorded: { name: 'Expressive cello section', part: 'keys', level: 0.32, pan: -0.1, sample: true, range: [36, 77], cache: 'bank-cinematic-cello', foldRange: true, expressive: true, shortBow: true },
  cello_chords: { name: 'Expressive cello chords', part: 'pad', level: 0.14, pan: 0.15, sample: true, range: [36, 77], cache: 'bank-cinematic-cello', foldRange: true, expressive: true, shortBow: true },
  cello_bass: { name: 'Expressive cello bass', part: 'bass', level: 0.38, pan: 0, sample: true, range: [36, 77], cache: 'bank-cinematic-cello', foldRange: true, expressive: true, shortBow: true },
  oboe_recorded: { name: 'Expressive oboe', part: 'keys', level: 0.29, pan: -0.12, sample: true, range: [58, 82], cache: 'bank-cinematic-oboe', foldRange: true, expressive: true },
  clarinet_recorded: { name: 'Expressive clarinet', part: 'keys', level: 0.3, pan: -0.1, sample: true, range: [50, 86], cache: 'bank-cinematic-clarinet', foldRange: true, expressive: true },
  bassoon_recorded: { name: 'Expressive bassoon', part: 'keys', level: 0.32, pan: -0.1, sample: true, range: [34, 72], cache: 'bank-cinematic-bassoon', foldRange: true, expressive: true },
  flute_recorded: { name: 'Recorded vibrato flute', part: 'keys', level: 0.3, pan: -0.15, sample: true, range: [60, 96], cache: 'bank-cinematic-flute', foldRange: true, expressive: true },
  harp_recorded: { name: 'Recorded concert harp', part: 'keys', level: 0.4, pan: -0.16, sample: true, range: [28, 83], cache: 'bank-cinematic-harp', foldRange: true },
  harp_chords: { name: 'Recorded harp chords', part: 'pad', level: 0.17, pan: 0.18, sample: true, range: [28, 83], cache: 'bank-cinematic-harp', foldRange: true },
  drums_orchestral: { name: 'Recorded orchestral percussion', part: 'drums', level: 0.43, pan: 0, sample: true, range: [36, 56], cache: 'bank-cinematic-percussion' },
  ocarina_recorded: { name: 'Recorded ocarina', part: 'keys', level: 0.34, pan: -0.12, sample: true, range: [67, 87], cache: 'bank-vcsl-ocarina', foldRange: true },
  harmonica_recorded: { name: 'Recorded chromatic harmonica', part: 'keys', level: 0.32, pan: -0.12, sample: true, range: [46, 98], cache: 'bank-vcsl-harmonica' },
  strumstick_recorded: { name: 'Recorded strumstick', part: 'keys', level: 0.42, pan: -0.15, sample: true, range: [48, 83], cache: 'bank-vcsl-strumstick' },
  dan_tranh_recorded: { name: 'Recorded đàn tranh zither', part: 'keys', level: 0.4, pan: -0.1, sample: true, range: [45, 85], cache: 'bank-vcsl-dan-tranh' },
  psaltery_recorded: { name: 'Recorded bowed psaltery', part: 'keys', level: 0.28, pan: -0.12, sample: true, range: [68, 92], cache: 'bank-vcsl-psaltery', foldRange: true },
  mbira_recorded: { name: 'Recorded mbira / thumb piano', part: 'keys', level: 0.38, pan: -0.1, sample: true, range: [57, 80], cache: 'bank-vcsl-mbira', foldRange: true },
  strumstick_chords: { name: 'Recorded strumstick chords', part: 'pad', level: 0.18, pan: 0.18, sample: true, range: [48, 83], cache: 'bank-vcsl-strumstick' },
  dan_tranh_chords: { name: 'Recorded đàn tranh chords', part: 'pad', level: 0.17, pan: 0.18, sample: true, range: [45, 85], cache: 'bank-vcsl-dan-tranh' },
  psaltery_chords: { name: 'Recorded bowed psaltery chords', part: 'pad', level: 0.12, pan: 0.15, sample: true, range: [68, 92], cache: 'bank-vcsl-psaltery', foldRange: true },
  trumpet_short: { name: 'Recorded short trumpet', part: 'keys', level: 0.34, pan: -0.12, sample: true, range: [48, 96], cache: 'bank-vsco-trumpet-short' },
  trumpet_stabs: { name: 'Recorded trumpet stabs', part: 'pad', level: 0.15, pan: 0.18, sample: true, range: [48, 96], cache: 'bank-vsco-trumpet-short' },
  cello_pizz: { name: 'Recorded pizzicato cello', part: 'keys', level: 0.4, pan: 0.12, sample: true, range: [36, 84], cache: 'bank-vsco-cello-pizz' },
  upright_piano: { name: 'Recorded upright piano', part: 'keys', level: 0.34, pan: -0.06, sample: true, range: [21, 108], cache: 'bank-vsco-upright' },
  upright_chords: { name: 'Recorded upright piano chords', part: 'pad', level: 0.15, pan: 0.08, sample: true, range: [21, 108], cache: 'bank-vsco-upright' },
  violin_pizz: { name: 'Recorded pizzicato violins', part: 'keys', level: 0.34, pan: 0.22, sample: true, range: [55, 91], cache: 'bank-vsco-violin-pizz', foldRange: true },
  viola_recorded: { name: 'Expressive viola section', part: 'keys', level: 0.3, pan: -0.14, sample: true, range: [48, 91], cache: 'bank-vsco-viola', foldRange: true, expressive: true },
  viola_chords: { name: 'Expressive viola chords', part: 'pad', level: 0.14, pan: -0.16, sample: true, range: [48, 91], cache: 'bank-vsco-viola', foldRange: true, expressive: true },
  contrabass_pizz: { name: 'Recorded pizzicato double bass', part: 'bass', level: 0.46, pan: 0.04, sample: true, range: [28, 64], cache: 'bank-vsco-contrabass-pizz', foldRange: true },
  marimba_recorded: { name: 'Recorded marimba', part: 'keys', level: 0.34, pan: 0.12, sample: true, range: [36, 100], cache: 'bank-vsco-marimba', foldRange: true },
  glock_recorded: { name: 'Recorded glockenspiel', part: 'keys', level: 0.36, pan: -0.1, sample: true, range: [72, 108], cache: 'bank-vcsl-glock' },
  kawai_piano: { name: 'Recorded Kawai grand piano', part: 'keys', level: 0.432, pan: -0.2, sample: true, range: [21, 108], cache: 'open-kawai-grand' },
  steinway_piano: { name: 'Recorded close Steinway grand', part: 'keys', level: 0.454, pan: -0.2, sample: true, range: [21, 108], cache: 'open-steinway-close' },
  steinway_chords: { name: 'Recorded Steinway grand chords', part: 'pad', level: 0.126, pan: 0.2, sample: true, range: [21, 108], cache: 'open-steinway-close' },
  fm_epiano: { name: 'Recorded FM electric piano', part: 'keys', level: 0.307, pan: -0.2, sample: true, range: [24, 84], cache: 'open-fm-epiano' },
  fm_epiano_chords: { name: 'Recorded FM electric piano chords', part: 'pad', level: 0.115, pan: 0.2, sample: true, range: [24, 84], cache: 'open-fm-epiano' },
  archtop_acoustic: { name: 'Recorded archtop acoustic guitar', part: 'keys', level: 0.834, pan: -0.2, sample: true, range: [28, 96], cache: 'open-archtop-acoustic' },
  archtop_acoustic_chords: { name: 'Recorded archtop acoustic guitar chords', part: 'pad', level: 0.131, pan: 0.2, sample: true, range: [28, 96], cache: 'open-archtop-acoustic' },
  archtop_jazz: { name: 'Recorded archtop jazz guitar', part: 'keys', level: 0.444, pan: -0.2, sample: true, range: [28, 96], cache: 'open-archtop-electric' },
  archtop_jazz_chords: { name: 'Recorded archtop jazz guitar chords', part: 'pad', level: 0.145, pan: 0.2, sample: true, range: [28, 96], cache: 'open-archtop-electric' },
  humbucker_guitar: { name: 'Recorded humbucker guitar', part: 'keys', level: 0.438, pan: -0.2, sample: true, range: [28, 96], cache: 'open-emily-guitar' },
  hollowbody_guitar: { name: 'Recorded clean hollow-body guitar', part: 'keys', level: 0.404, pan: -0.2, sample: true, range: [28, 96], cache: 'open-gretsch-guitar' },
  hollowbody_muted: { defaultArticulation: 'short', name: 'Recorded muted hollow-body guitar', part: 'keys', level: 0.8, pan: -0.2, sample: true, range: [28, 96], cache: 'open-gretsch-guitar' },
  hollowbody_muted_chords: { defaultArticulation: 'short', name: 'Recorded muted hollow-body guitar chords', part: 'pad', level: 0.174, pan: 0.2, sample: true, range: [28, 96], cache: 'open-gretsch-guitar' },
  upright_bass: { name: 'Recorded upright acoustic bass', part: 'bass', level: 0.418, pan: 0, sample: true, range: [24, 68], cache: 'open-upright-bass' },
  picked_bass: { name: 'Recorded picked electric bass', part: 'bass', level: 0.865, pan: 0, sample: true, range: [24, 68], cache: 'open-picked-bass' },
  finger_bass: { name: 'Recorded fingered electric bass', part: 'bass', level: 0.636, pan: 0, sample: true, range: [24, 68], cache: 'open-finger-bass' },
  strings_section_lead: { name: 'Recorded strings section', part: 'keys', level: 0.191, pan: -0.14, sample: true, range: [24, 96], cache: 'open-strings-section', foldRange: true, expressive: true, shortBow: true },
  strings_section_chords: { name: 'Recorded strings section chords', part: 'pad', level: 0.174, pan: 0.18, sample: true, range: [24, 96], cache: 'open-strings-section', foldRange: true, expressive: true, shortBow: true },
  solo_strings_lead: { name: 'Recorded solo strings', part: 'keys', level: 0.489, pan: -0.2, sample: true, range: [24, 96], cache: 'open-strings-solo', foldRange: true, expressive: true },
  solo_strings_chords: { name: 'Recorded solo strings chords', part: 'pad', level: 0.187, pan: 0.25, sample: true, range: [24, 96], cache: 'open-strings-solo', foldRange: true, expressive: true },
  brass_section_lead: { name: 'Recorded brass section', part: 'keys', level: 0.404, pan: -0.2, sample: true, range: [24, 96], cache: 'open-brass-section', foldRange: true, expressive: true },
  brass_section_chords: { name: 'Recorded brass section chords', part: 'pad', level: 0.166, pan: 0.25, sample: true, range: [24, 96], cache: 'open-brass-section', foldRange: true, expressive: true },
  woodwind_section_lead: { name: 'Recorded woodwind section', part: 'keys', level: 0.466, pan: -0.2, sample: true, range: [24, 96], cache: 'open-woodwind-section', foldRange: true, expressive: true },
  woodwind_section_chords: { name: 'Recorded woodwind section chords', part: 'pad', level: 0.191, pan: 0.25, sample: true, range: [24, 96], cache: 'open-woodwind-section', foldRange: true, expressive: true },
  choir_ah: { name: 'Recorded choir "ah"', part: 'pad', level: 0.184, pan: 0.25, sample: true, range: [34, 74], cache: 'open-choir-ahh', foldRange: true },
  choir_oo: { name: 'Recorded choir "oo"', part: 'pad', level: 0.154, pan: 0.25, sample: true, range: [34, 74], cache: 'open-choir-ooh', foldRange: true },
  vinyl_crackle: { name: 'Recorded vinyl crackle', part: 'pad', level: 0.398, pan: 0, sample: true, range: [48, 72], cache: 'open-vinyl' },
  drums_rock_kit: { name: 'Recorded rock kit', part: 'drums', level: 0.502, pan: 0, sample: true, range: [36, 42], cache: 'open-drums-rock' },
  drums_studio_kit: { name: 'Recorded studio kit', part: 'drums', level: 0.132, pan: 0, sample: true, range: [36, 42], cache: 'open-drums-studio' },
  drums_funk_kit: { name: 'Recorded funk kit', part: 'drums', level: 0.491, pan: 0, sample: true, range: [36, 42], cache: 'open-drums-funk' },
  drums_metal_kit: { name: 'Recorded metal kit', part: 'drums', level: 0.634, pan: 0, sample: true, range: [36, 42], cache: 'open-drums-metal' },
  drums_dry_kit: { name: 'Recorded dry groove kit', part: 'drums', level: 0.601, pan: 0, sample: true, range: [36, 42], cache: 'open-drums-groove' },
  drums_deadkick_kit: { name: 'Recorded dead-kick kit', part: 'drums', level: 0.444, pan: 0, sample: true, range: [36, 42], cache: 'open-drums-deadkick' },
  drums_punchy_kit: { name: 'Recorded punchy kit', part: 'drums', level: 0.436, pan: 0, sample: true, range: [36, 42], cache: 'open-drums-punchy' },
  drums_jazz_kit: { name: 'Recorded jazz kit (ride)', part: 'drums', level: 0.352, pan: 0, sample: true, range: [36, 42], cache: 'open-drums-jazz' },
  drums_brush_kit: { name: 'Recorded brush kit', part: 'drums', level: 0.44, pan: 0, sample: true, range: [36, 42], cache: 'open-drums-brushes' },
  drums_foundry_kit: { name: 'Recorded industrial metal kit', part: 'drums', level: 0.621, pan: 0, sample: true, range: [36, 56], cache: 'open-drums-industrial', cowbellFills: true },
  drums_soft_perc: { name: 'Recorded soft percussion and shakers', part: 'drums', level: 0.395, pan: 0, sample: true, range: [36, 56], cache: 'open-perc-watercolor' },
  keys: { name: 'FM keys', part: 'keys', level: 0.24, pan: -0.2, echo: true },
  lead: { name: 'Triangle lead', part: 'keys', level: 0.24, pan: -0.2, echo: true },
  pluck: { name: 'Plucked string', part: 'keys', level: 0.3, pan: -0.2 },
  flute: { name: 'Synth flute', part: 'keys', level: 0.32, pan: -0.2, echo: true },
  chip: { name: 'Chip lead', part: 'keys', level: 0.14, pan: -0.2 },
  pad: { name: 'Soft pad', part: 'pad', level: 0.045, pan: 0.25 },
  organ: { name: 'Organ chords', part: 'pad', level: 0.065, pan: 0.25 },
  bright: { name: 'Bright synth chords', part: 'pad', level: 0.075, pan: 0.25 },
  bass: { name: 'Synth bass', part: 'bass', level: 0.28, pan: 0 },
  pluckbass: { name: 'Plucked synth bass', part: 'bass', level: 0.4, pan: 0 },
  growl: { name: 'Growling synth bass', part: 'bass', level: 0.2, pan: 0 },
  wobble: { name: 'Wobble bass', part: 'bass', level: 0.32, pan: 0 },
  chug: { name: 'Distorted power guitar', part: 'keys', level: 0.3, pan: -0.15 },
  drums: { name: 'Synth drums', part: 'drums', level: 0.32, pan: 0 },
  electronic: { name: 'Electronic kit', part: 'drums', level: 0.38, pan: 0 },
  chipdrums: { name: 'Chip kit', part: 'drums', level: 0.18, pan: 0 },
};

export function addInstruments({ order = [], instruments = {}, replaces = {} } = {}) {
  const all = { ...INSTRUMENTS, ...instruments };
  for (const [id, old] of Object.entries(replaces)) if (all[id]) all[id] = { ...all[id], replaces: old };
  const ids = new Set([...order.filter(id => Object.hasOwn(all, id)), ...Object.keys(all)]);
  for (const id of Object.keys(INSTRUMENTS)) delete INSTRUMENTS[id];
  for (const id of ids) INSTRUMENTS[id] = all[id];
}

export function swapInstrument(song, id, instrument) {
  const track = song.tracks.find((part) => part.id === id);
  if (!track) throw new Error('Unknown song part: ' + id);
  if (INSTRUMENTS[instrument]?.part !== partType(track)) throw new Error('Instrument does not fit this part: ' + instrument);
  const range = INSTRUMENTS[instrument].range;
  if (range && track.notes.some((n) => n.midi < range[0] || n.midi > range[1])) throw new Error(INSTRUMENTS[instrument].name + ' range is MIDI ' + range.join('–'));
  return { ...song, tracks: song.tracks.map((part) => part.id === id ? { ...part, instrument } : part) };
}

export function shiftOctave(song, id, step) {
  const track = song.tracks.find(t => t.id === id);
  if (!track || partType(track) === 'drums') throw new Error('Choose a pitched part');
  const octaves = (track.octaves ?? 0) + step;
  if (![-1, 1].includes(step) || Math.abs(octaves) > 10) throw new Error('Invalid octave shift');
  const range = INSTRUMENTS[track.instrument].range ?? [0, 127];
  if (track.notes.some(n => n.midi + step * 12 < range[0] || n.midi + step * 12 > range[1])) {
    throw new Error(INSTRUMENTS[track.instrument].name + ' cannot play that octave');
  }
  const next = { ...track, octaves, notes: track.notes.map(n => ({ ...n, midi: n.midi + step * 12, ...(n.slideFrom === undefined ? {} : { slideFrom: n.slideFrom + step * 12 }) })) };
  return { ...song, tracks: song.tracks.map(t => t.id === id ? next : t) };
}

export function fitMelodyInstrument(song, id, instrument) {
  const track = song.tracks.find(t => t.id === id);
  if (!track || partType(track) !== 'keys' || INSTRUMENTS[instrument]?.part !== 'keys') throw new Error('Choose a melody instrument');
  return fitPitchedInstrument(song, id, instrument);
}

export function fitPitchedInstrument(song, id, instrument) {
  const track = song.tracks.find(t => t.id === id);
  if (!track || partType(track) === 'drums' || INSTRUMENTS[instrument]?.part !== partType(track)) throw new Error('Choose a pitched instrument');
  const range = INSTRUMENTS[instrument].range;
  if (!range || track.notes.every(n => n.midi >= range[0] && n.midi <= range[1])) return { song: swapInstrument(song, id, instrument), octaves: 0 };
  for (let n = 1; n <= 10; n++) for (const sign of [-1, 1]) {
    const octaves = n * sign;
    if (!track.notes.every(note => note.midi + octaves * 12 >= range[0] && note.midi + octaves * 12 <= range[1])) continue;
    const next = { ...track, instrument, octaves: (track.octaves ?? 0) + octaves,
      notes: track.notes.map(note => ({ ...note, midi: note.midi + octaves * 12, ...(note.slideFrom === undefined ? {} : { slideFrom: note.slideFrom + octaves * 12 }) })) };
    return { song: { ...song, tracks: song.tracks.map(t => t.id === id ? next : t) }, octaves };
  }
  if (INSTRUMENTS[instrument].foldRange) {
    const fold = midi => { while (midi < range[0]) midi += 12; while (midi > range[1]) midi -= 12; return midi; };
    const next = { ...track, instrument, notes: track.notes.map(note => ({ ...note, midi: fold(note.midi),
      ...(note.slideFrom === undefined ? {} : { slideFrom: fold(note.slideFrom) }) })) };
    return { song: { ...song, tracks: song.tracks.map(t => t.id === id ? next : t) }, octaves: 0, folded: true };
  }
  throw new Error(INSTRUMENTS[instrument].name + ' cannot fit this part by an octave shift');
}
