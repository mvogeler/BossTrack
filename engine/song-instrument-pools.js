const calm = {
  keys: ['felt_keys', 'marimba', 'vibraphone', 'celesta', 'musicbox', 'kalimba', 'harp', 'nylon_pluck', 'fm_epiano', 'steinway_piano', 'flute', 'reed', 'glock_recorded', 'cello_pizz', 'ocarina_recorded', 'mbira_recorded', 'dan_tranh_recorded'],
  pad: ['steinway_chords', 'fm_epiano_chords', 'archtop_acoustic_chords', 'strumstick_chords', 'dan_tranh_chords', 'psaltery_chords', 'pad', 'bowed', 'woodwind_section_chords'],
  bass: ['upright_bass', 'sub_bass', 'pluckbass', 'finger_bass'], drums: ['drums_jazz_kit', 'drums_brush_kit', 'drums_dry_kit', 'drums_tight'],
};
const dance = {
  keys: ['supersaw', 'analog_lead', 'pulse_lead', 'harmonic_lead', 'fm_glass', 'edm_pluck', 'lead', 'chip', 'digital_pluck'],
  pad: ['analog_pad', 'shimmer_pad', 'bright', 'fm_epiano_chords', 'brass_impact', 'trumpet_stabs'],
  bass: ['reese_bass', 'sub_bass', 'acid_bass', 'rubber_bass', 'bass', 'pluckbass', 'bass_808'],
  drums: ['drums_analog', 'electronic', 'drums_punchy_kit', 'drums_impact'],
};
const band = {
  keys: ['guitar_clean', 'guitar_muted', 'guitar_drive', 'humbucker_guitar', 'hollowbody_guitar', 'hollowbody_muted', 'guitar_soaring'],
  pad: ['hollowbody_muted_chords', 'fm_epiano_chords', 'brass_warm', 'organ'],
  bass: ['picked_bass', 'finger_bass', 'growl', 'bass_grit'],
  drums: ['drums_tight', 'drums_rock_kit', 'drums_studio_kit', 'drums_deadkick_kit'],
};

const orchestra = {
  keys: ['horn_recorded', 'trumpet_recorded', 'violin_recorded', 'cello_recorded', 'oboe_recorded', 'clarinet_recorded', 'bassoon_recorded', 'flute_recorded', 'harp_recorded'],
  pad: ['violin_chords', 'cello_chords', 'horn_chords', 'trombone_chords', 'harp_chords'],
  bass: ['cello_bass', 'tuba_recorded'], drums: ['drums_orchestral'],
};

const watercolor = {
  keys: ['upright_piano', 'marimba_recorded', 'flute_recorded', 'clarinet_recorded', 'harp_recorded', 'glock_recorded', 'violin_pizz', 'viola_recorded', 'oboe_recorded', 'cello_pizz', 'soft_flute'],
  pad: ['upright_chords', 'viola_chords', 'violin_chords', 'cello_chords', 'harp_chords', 'analog_pad', 'bowed'],
  bass: ['contrabass_pizz', 'cello_bass', 'upright_bass', 'sub_bass'], drums: ['drums_orchestral'],
};

const watercolorV2 = { ...watercolor, keys: [...watercolor.keys, 'strings_section_lead'], pad: [...watercolor.pad, 'strings_section_chords', 'vinyl_crackle'],
  drums: ['drums_soft_perc', 'drums_orchestral'] };

export const INSTRUMENT_POOLS = {
  watercolor_a: watercolor, watercolor_b: watercolor,
  watercolor_a2: watercolorV2, watercolor_b2: watercolorV2,
  cinematic_wonder: orchestra,
  cinematic_command: { ...orchestra, pad: ['violin_spiccato', 'trombone_chords', 'horn_chords'] },
  space: { keys: ['orbital_theme', 'horizon_lead', 'clockwork_pulse'], pad: ['nebula_strings', 'spectral_pad', 'violin_chords'], bass: ['navigation_pulse', 'abyss_bass', 'sub_bass'], drums: ['drums_machine', 'drums_orchestral'] },
  original: calm, cozy: calm, lofi: { ...calm, keys: ['fm_epiano', 'felt_keys', 'vibraphone', 'archtop_jazz'] },
  incremental: { ...calm, keys: ['ocarina_recorded', 'mbira_recorded', 'soft_flute', 'flute', 'softmallet', 'nylon_pluck', 'fm_epiano'],
    pad: ['fm_epiano_chords', 'steinway_chords'], bass: ['sub_bass', 'upright_bass'], drums: ['drums_jazz_kit', 'drums_brush_kit', 'drums_tight'] },
  muzak: { ...calm, keys: ['vibraphone', 'fm_epiano', 'archtop_jazz', 'reed', 'flute'], pad: ['fm_epiano_chords', 'brass_warm'] },
  newage: { ...calm, keys: ['ocarina_recorded', 'psaltery_recorded', 'dan_tranh_recorded', 'harp', 'celesta', 'fm_glass', 'flute', 'felt_keys'], pad: ['choir_oo', 'choir_ah', 'shimmer_pad', 'bowed'], bass: ['sub_bass', 'upright_bass'] },
  bossa: { ...calm, keys: ['archtop_jazz', 'nylon_pluck', 'archtop_acoustic', 'reed', 'vibraphone'], pad: ['archtop_jazz_chords', 'archtop_acoustic_chords', 'fm_epiano_chords'] },
  folk: { ...calm, keys: ['strumstick_recorded', 'harmonica_recorded', 'dan_tranh_recorded', 'ocarina_recorded', 'archtop_acoustic', 'nylon_pluck', 'harp', 'kalimba', 'flute'], pad: ['archtop_acoustic_chords', 'steinway_chords', 'bowed'] },
  ambient: { ...calm, keys: ['ocarina_recorded', 'psaltery_recorded', 'mbira_recorded', 'musicbox', 'fm_glass', 'softmallet', 'harp', 'flute', 'tubular_bell'], pad: ['shimmer_pad', 'pad', 'choir_oo', 'choir_ah', 'bowed'] },
  adventure: { ...calm, keys: ['woodwind_section_lead', 'brass_section_lead', 'solo_strings_lead', 'pizzicato', 'reed', 'trumpet_short', 'cello_pizz'], pad: ['strings_section_chords', 'bowed', 'brass_section_chords', 'woodwind_section_chords'], drums: ['drums_studio_kit', 'drums_tight', 'drums_rock_kit'] },
  electronic: dance, house: { ...dance, keys: ['edm_pluck', 'fm_glass', 'fm_epiano', 'analog_lead'] },
  trance: { ...dance, keys: ['supersaw', 'harmonic_lead', 'edm_pluck', 'pulse_lead'] },
  synthwave: { ...dance, keys: ['pulse_lead', 'analog_lead', 'supersaw', 'lead'] },
  dnb: { ...dance, bass: ['reese_bass', 'sub_bass', 'growl', 'wobble'] },
  dubstep: { ...dance, bass: ['wobble', 'growl', 'reese_bass', 'acid_bass'] },
  rock: band,
  metal: { ...band, keys: ['guitar_palm', 'guitar_soaring', 'guitar_heavy', 'chug', 'guitar_drive'], pad: ['guitar_power', 'brass_warm', 'bowed', 'hollowbody_muted_chords'], drums: ['drums_foundry_kit', 'drums_machine', 'drums_metal_kit', 'drums_deadkick_kit', 'drums_tight'] },
  pop: { ...dance, keys: ['celesta', 'fm_epiano', 'guitar_clean', 'edm_pluck', 'felt_keys'], bass: ['finger_bass', 'sub_bass', 'rubber_bass'] },
  kpop: { ...dance, keys: ['digital_pluck', 'trumpet_short', 'fm_glass', 'supersaw', 'edm_pluck', 'pulse_lead', 'guitar_clean'], drums: ['drums_impact', 'drums_machine', 'drums_foundry_kit', 'drums_analog'] },
  neon: { keys: ['neon_lead', 'neon_pluck', 'supersaw', 'digital_pluck', 'pulse_lead', 'fm_glass', 'edm_pluck'],
    pad: ['neon_chords', 'analog_pad', 'shimmer_pad', 'brass_impact'], bass: ['neon_bass', 'bass_808', 'sub_bass', 'rubber_bass', 'reese_bass'],
    drums: ['drums_neon', 'drums_impact', 'drums_analog'] },
  musicbox: { keys: ['tine_box', 'musicbox', 'celesta', 'kalimba', 'harp', 'vibraphone'], pad: ['tine_box_chords', 'fm_epiano_chords'],
    bass: ['tine_box_bass', 'pluckbass'], drums: ['drums_soft_perc'] },
  funk: { ...band, keys: ['hollowbody_muted', 'guitar_muted', 'fm_epiano'], pad: ['fm_epiano_chords', 'organ', 'brass_warm'], bass: ['picked_bass', 'finger_bass', 'rubber_bass'], drums: ['drums_funk_kit', 'drums_dry_kit', 'drums_tight'] },
};
