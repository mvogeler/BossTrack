const hall = (mix, size, damp = 0.5, predelay = 0.02) => ({ mix, size, damp, predelay });
const tone = (cut, warmth = 0.2) => ({ mix: 1, cut, warmth });

const UPRIGHT = {
  name: 'Watercolor A: upright and strings',
  tracks: {
    keys: { instrument: 'upright_piano', gain: 1.7, vel: 0.55,
      styles: { arp: { lo: 60, hi: 84, vel: 0.3 }, comp: { lo: 55, hi: 76, vel: 0.3 } },
      effects: { tone: tone(0.85, 0.1), hall: hall(0.24, 0.55, 0.45, 0.015) } },
    pad: { instrument: 'upright_chords', gain: 0.7, lo: 43, hi: 67, vel: 0.32,
      styles: { comp: { lo: 50, hi: 72, vel: 0.28 } },
      effects: { tone: tone(0.72, 0.1), hall: hall(0.24, 0.55, 0.45, 0.015) } },
    'pad-2': { instrument: 'viola_chords', gain: 1, lo: 50, hi: 74, vel: 0.42,
      styles: { counter: { lo: 55, hi: 76, vel: 0.5 } },
      effects: { tone: tone(0.7, 0.1), hall: hall(0.36, 0.7, 0.5, 0.03) } },
    'pad-3': { instrument: 'violin_chords', gain: 0.9, lo: 67, hi: 86, vel: 0.34, count: 3,
      effects: { tone: tone(0.7, 0), hall: hall(0.4, 0.75, 0.5, 0.03) } },
    bass: { instrument: 'contrabass_pizz', gain: 0.6, lo: 31, hi: 50, vel: 0.55,
      effects: { tone: tone(0.6, 0.1), hall: hall(0.15, 0.45, 0.5, 0.01) } },
    'keys-2': { instrument: 'flute_recorded', gain: 1.4, vel: 0.5,
      styles: { counter: { lo: 67, hi: 86, vel: 0.42 } },
      effects: { tone: tone(0.8, 0), hall: hall(0.34, 0.65, 0.5, 0.025) } },
    'keys-3': { instrument: 'harp_recorded', gain: 0.7, lo: 55, hi: 86, vel: 0.26,
      effects: { tone: tone(0.8, 0), hall: hall(0.36, 0.7, 0.5, 0.02) } },
    drums: { instrument: 'drums_orchestral', gain: 0.6, vel: 0.4,
      effects: { tone: tone(0.65, 0.1), hall: hall(0.42, 0.7, 0.5, 0.02) } },
  },
  extra: {
    keys: { instrument: 'harp_recorded', lo: 55, hi: 84, vel: 0.24, roles: { Answer: 'arp:harp8', Refrain: 'arp:harp8', Contrast: 'arp:harp8' } },
    pad: { instrument: 'violin_chords', lo: 64, hi: 84, vel: 0.3, count: 3, roles: { Contrast: 'pad', Refrain: 'pad' } },
    bass: { instrument: 'contrabass_pizz', lo: 31, hi: 50, vel: 0.45, roles: { Main: 'bass:pedal', Refrain: 'bass:pedal' } },
    drums: { instrument: 'drums_orchestral', vel: 0.3, roles: { Refrain: 'percussion:soft' } },
  },
  sections: {
    Intro: { keys: 'lead:A@0-2', pad: 'arp:broken8', 'pad-2': 'pad', drums: 'percussion:swell' },
    Main: { keys: 'lead:A', pad: 'arp:broken8', 'pad-2': 'pad', bass: 'bass:root', drums: 'percussion:soft' },
    Answer: { 'keys-2': 'lead:B', keys: 'arp:piano8', pad: 'comp:block', 'pad-2': 'pad', bass: 'bass:root5', 'keys-3': 'arp:harp8', drums: 'percussion:soft' },
    Contrast: { keys: 'comp:rolled', 'pad-2': 'counter', 'pad-3': 'pad', bass: 'bass:pedal', 'keys-3': 'arp:harp8', drums: 'percussion:swell' },
    Refrain: { keys: 'lead:A', 'keys-2': 'counter', pad: 'arp:broken8', 'pad-2': 'pad', 'pad-3': 'pad', bass: 'bass:walk', 'keys-3': 'arp:harp16', drums: 'percussion:soft' },
    Turnaround: { keys: 'lead:A@0-2', pad: 'arp:broken8', 'pad-2': 'pad', bass: 'bass:root', drums: 'percussion:swell' },
  },
  cues: {
    menu: {
      title: 'Wet Paper Morning', tempo: 92, key: 7, mode: 'major',
      themes: {
        A: { base: 79, notes: "5:1 3:0.5 2:0.5 3:1 5:1 | 6:1.5 5:0.5 3:2 | 4:1 3:1 2:1 3:1 | 2:3 r:1 | 5:1 3:0.5 2:0.5 3:1 5:1 | 6:1.5 5:0.5 7:2 | 1':1 7:1 6:1 5:1 | 6:3 r:1" },
        B: { base: 67, notes: "3':2 2':1 7:1 | 2':2 6:2 | 7:1.5 6:0.5 5:2 | 5:1 6:1 7:1 2':1 | 3':1.5 2':0.5 1':2 | 7:2 6:1 5:1 | 5:1 3:1 5:1 1':1 | 6:2 5:2" },
      },
      sections: [
        { name: 'Intro', chords: ['1add9', '4maj7/1', '1add9', '5sus'] },
        { name: 'Main', chords: ['1', '3m7', '4maj7', '5sus 5', '6m7', '3m7', '2m7', '5'] },
        { name: 'Answer', chords: ['4maj7', '5', '3m7', '6m7', '2m7', '5/7', '1', '5sus 5'] },
        { name: 'Turnaround', chords: ['4maj7', '1/3', '2m7', '5sus 5'] },
      ],
    },
    game: {
      title: 'Pigment on the Pond', tempo: 80, key: 2, mode: 'major',
      themes: {
        A: { base: 74, notes: "3:1.5 2:0.5 3:1 5:1 | 5:2 4:1 3:1 | 2:1.5 1:0.5 2:1 3:1 | 3:3 r:1 | 3:1.5 2:0.5 3:1 6:1 | 5:1.5 6:0.5 5:1 3:1 | 2:1 3:0.5 2:0.5 1:1 7,:1 | 2:3 r:1" },
        B: { base: 74, notes: "5:1.5 3:0.5 5:1 1':1 | 7:2 6:1 5:1 | 6:1.5 5:0.5 3:2 | 2:1 3:1 5:2 | 3:1.5 5:0.5 7:2 | 6:1 5:1 3:1 2:1 | 2:2 1:1 7,:1 | 7,:2 5,:2" },
      },
      sections: [
        { name: 'Intro', chords: ['1maj7', '4add9/1', '6m7', '5sus 5'] },
        { name: 'Main', chords: ['1', '5/7', '6m7', '4maj7', '1/3', '4', '2m7', '5sus 5'] },
        { name: 'Answer', chords: ['1', '5/7', '6m7', '4maj7', '3m7', '6m7', '2m7', '5'] },
        { name: 'Contrast', chords: ['4maj7', '5', '3m7', '6m7', '4maj7', '1/3', '2m7', '5sus'] },
        { name: 'Refrain', chords: ['1', '5/7', '6m7', '4maj7', '1/3', '4', '2m7', '5sus 5'] },
        { name: 'Turnaround', chords: ['4maj7', '1/3', '2m7', '5sus 5'] },
      ],
    },
    ending: {
      title: 'Everything Dries Bright', tempo: 76, key: 0, mode: 'major',
      themes: {
        A: { base: 72, notes: "3:1 5:1 1':1.5 7:0.5 | 2':1.5 1':0.5 7:2 | 1':1 6:1 3:1 6:1 | 5:3 r:1 | 6:1 5:1 4:1 6:1 | 5:1.5 3:0.5 1':2 | 2':1 1':1 6:1 4:1 | 5:3 r:1" },
        B: { base: 72, notes: "6:1.5 5:0.5 4:1 6:1 | 7:2 2':2 | 3':1.5 2':0.5 7:2 | 1':3 r:1 | 6:1 5:0.5 4:0.5 6:1 1':1 | 2':2 7:2 | 1':1.5 7:0.5 5:2 | 6:2 7:2" },
      },
      sections: [
        { name: 'Intro', chords: ['1add9', '4maj7', '1add9', '5sus'] },
        { name: 'Main', chords: ['1', '5/7', '6m', '3m', '4', '1/3', '2m7', '5sus 5'] },
        { name: 'Answer', chords: ['4', '5', '3m7', '6m7', '2m7', '5', '1/3', '4 5'] },
        { name: 'Refrain', chords: ['4maj7', '1/3', '6m7', '5', '4', '1/3', '2m7 5', '1'], energy: 1 },
        { name: 'Turnaround', chords: ['4maj7', '1/3', '2m7', '5sus 5'] },
      ],
    },
    keeper: {
      title: "The Keeper's Ledger", tempo: 76, key: 11, mode: 'minor',
      tracks: { 'keys-2': { instrument: 'clarinet_recorded', gain: 0.9 }, 'keys-3': { instrument: 'violin_pizz', lo: 59, hi: 78, vel: 0.3, gain: 0.8 } },
      themes: {
        A: { base: 71, notes: "5:1 4:0.5 3:0.5 1:2 | 3:1.5 2:0.5 1:2 | 5:1.5 3:0.5 7:2 | 4:2 5:1 4:1 | 5:1 4:0.5 3:0.5 1:1 1':1 | 7:1.5 6:0.5 3':2 | 1':1.5 7:0.5 6:1 4:1 | 2:2 7#,:2" },
        B: { base: 71, notes: "3:1 5:1 1':2 | 7:1.5 6:0.5 5:2 | 4:2 6:1 4:1 | 3:1 2:1 1:2 | 3:1 5:1 1':2 | 3':1 2':1 1':1 7:1 | 6:1.5 5:0.5 4:2 | 4:3 r:1" },
      },
      sections: [
        { name: 'Intro', chords: ['1m', '6', '4m7', '5M'], roles: { keys: null, 'keys-3': 'arp:counting' } },
        { name: 'Main', chords: ['1m', '6', '3', '7', '1m', '6', '4m7', '5M'], roles: { keys: null, 'keys-2': 'lead:A', 'keys-3': 'arp:counting' } },
        { name: 'Answer', chords: ['6', '3', '7', '1m', '6', '3/5', '4m7', '5sus 5M'], roles: { keys: 'lead:B', 'keys-2': 'counter', 'keys-3': 'arp:counting' } },
        { name: 'Contrast', chords: ['6maj7', '7', '3/5', '1m', '6maj7', '7', '4m7', '5M'] },
        { name: 'Turnaround', chords: ['6', '7', '4m7', '5M'], roles: { keys: null, 'keys-2': 'lead:A@0-2', 'keys-3': 'arp:counting' } },
      ],
    },
    limner: {
      title: 'Lines That Stay Put', tempo: 72, key: 5, mode: 'lydian',
      themes: {
        A: { base: 77, notes: "5:2 3:1 4:1 | 2:3 4:1 | 3:2 5:1 7,:1 | 6:3 r:1 | 5:1.5 6:0.5 5:1 3:1 | 4:1.5 2:0.5 4:1 6:1 | 6:1 5:1 3:1 1:1 | 2:4" },
        B: { base: 77, notes: "6:1.5 5:0.5 3:2 | 4:1.5 2:0.5 7,:2 | 1:1 3:1 5:1 7:1 | 6:2 5:2 | 6:1.5 5:0.5 3:2 | 3:1 5:1 7:2 | 6:2 4:2 | 2:4" },
      },
      sections: [
        { name: 'Intro', chords: ['1maj7', '2', '1maj7', '2'], roles: { keys: null, 'keys-3': 'arp:harp16' } },
        { name: 'Main', chords: ['1maj7', '2', '3m7', '2', '1maj7', '2', '6m7', '5sus'], roles: { keys: 'arp:piano8', 'keys-2': 'lead:A', 'keys-3': 'arp:harp16', pad: null } },
        { name: 'Answer', chords: ['6m7', '2', '1maj7', '5', '6m7', '3m7', '2', '2'], roles: { keys: 'lead:B', 'keys-2': 'counter' } },
        { name: 'Contrast', chords: ['6m7', '3m7', '2', '1maj7', '6m7', '3m7', '2', '5sus'] },
        { name: 'Turnaround', chords: ['6m7', '2', '1maj7', '5sus'], roles: { keys: null, 'keys-2': 'lead:A@0-2', 'keys-3': 'arp:harp8' } },
      ],
    },
  },
};

const MALLETS = {
  name: 'Watercolor B: mallets and pads',
  tracks: {
    keys: { instrument: 'marimba_recorded', gain: 0.8, lo: 60, hi: 84, vel: 0.36,
      styles: { lead: { vel: 0.5 } },
      effects: { tone: tone(0.75, 0.1), hall: hall(0.24, 0.55, 0.5, 0.015) } },
    'keys-2': { instrument: 'flute_recorded', gain: 1.7, vel: 0.5,
      styles: { counter: { lo: 67, hi: 86, vel: 0.4 } },
      effects: { tone: tone(0.8, 0), hall: hall(0.34, 0.65, 0.5, 0.025) } },
    'keys-3': { instrument: 'glock_recorded', gain: 1, lo: 79, hi: 96, vel: 0.22,
      styles: { lead: { vel: 0.32 } },
      effects: { tone: tone(0.68, 0), hall: hall(0.4, 0.7, 0.5, 0.02) } },
    'keys-4': { instrument: 'harp_recorded', gain: 0.7, lo: 50, hi: 79, vel: 0.26,
      effects: { tone: tone(0.75, 0), hall: hall(0.36, 0.7, 0.5, 0.02) } },
    pad: { instrument: 'analog_pad', gain: 0.55, lo: 55, hi: 76, vel: 0.35,
      effects: { tone: tone(0.62, 0.1), hall: hall(0.3, 0.65, 0.5, 0.02) } },
    'pad-2': { instrument: 'viola_chords', gain: 0.9, lo: 55, hi: 76, vel: 0.36,
      styles: { counter: { lo: 55, hi: 76, vel: 0.45 }, lead: { vel: 0.5 } },
      effects: { tone: tone(0.7, 0.1), hall: hall(0.36, 0.7, 0.5, 0.03) } },
    bass: { instrument: 'contrabass_pizz', gain: 0.6, lo: 31, hi: 50, vel: 0.55,
      effects: { tone: tone(0.6, 0.1), hall: hall(0.15, 0.45, 0.5, 0.01) } },
    drums: { instrument: 'drums_orchestral', gain: 0.6, vel: 0.38,
      effects: { tone: tone(0.65, 0.1), hall: hall(0.42, 0.7, 0.5, 0.02) } },
  },
  extra: {
    keys: { instrument: 'harp_recorded', lo: 55, hi: 84, vel: 0.24, roles: { Main: 'arp:harp8', Refrain: 'arp:harp8' } },
    pad: { instrument: 'violin_chords', lo: 64, hi: 84, vel: 0.3, count: 3, roles: { Contrast: 'pad', Refrain: 'pad' } },
    bass: { instrument: 'sub_bass', lo: 28, hi: 45, vel: 0.35, roles: { Main: 'bass:pedal', Refrain: 'bass:pedal' } },
    drums: { instrument: 'drums_orchestral', vel: 0.3, roles: { Refrain: 'percussion:soft' } },
  },
  sections: {
    Intro: { keys: 'arp:ostinato', pad: 'pad', 'keys-3': 'sparkle', drums: 'percussion:swell' },
    Main: { keys: 'arp:ostinato', 'keys-2': 'lead:A', pad: 'pad', bass: 'bass:root5', 'keys-3': 'sparkle', drums: 'percussion:soft' },
    Answer: { keys: 'arp:ostinato', 'keys-3': 'lead:B', 'keys-4': 'arp:harp8', pad: 'pad', 'pad-2': 'pad', bass: 'bass:root5', drums: 'percussion:soft' },
    Contrast: { 'keys-4': 'arp:harp16', pad: 'pad', 'pad-2': 'counter', bass: 'bass:pedal', 'keys-3': 'sparkle', drums: 'percussion:swell' },
    Refrain: { keys: 'arp:ostinato', 'keys-2': 'lead:A', 'pad-2': 'counter', pad: 'pad', 'keys-4': 'arp:harp8', 'keys-3': 'sparkle', bass: 'bass:walk', drums: 'percussion:soft' },
    Turnaround: { keys: 'arp:ostinato', 'keys-2': 'lead:A@0-2', pad: 'pad', bass: 'bass:root', drums: 'percussion:swell' },
  },
  cues: {
    menu: {
      title: 'Tea Stain Sunrise', tempo: 96, key: 9, mode: 'major',
      themes: {
        A: { base: 69, notes: "5:1 1':1 7:0.5 6:0.5 5:1 | 7:1.5 6:0.5 5:2 | 6:1 5:1 3:1 1:1 | 3:3 r:1 | 5:1 1':1 7:0.5 6:0.5 5:1 | 6:1.5 7:0.5 1':2 | 2':2 1':2 | 7:3 r:1" },
        B: { base: 81, notes: "3:1 5:1 3:1 2:1 | 2:2 7,:2 | 3:1 5:1 7:2 | 6:2 5:1 3:1 | 4:1 6:1 2:2 | 7,:2 2:2 | 1:2 3:1 5:1 | 5:2 7,:2" },
      },
      sections: [
        { name: 'Intro', chords: ['1add9', '4maj7', '1add9', '4maj7'] },
        { name: 'Main', chords: ['1', '5/7', '6m7', '4maj7', '1/3', '4', '5sus', '5'] },
        { name: 'Answer', chords: ['4maj7', '5', '3m7', '6m7', '2m7', '5', '1', '5sus 5'] },
        { name: 'Turnaround', chords: ['4maj7', '1/3', '2m7', '5sus 5'] },
      ],
    },
    game: {
      title: 'Little Blotches Walking', tempo: 84, key: 5, mode: 'major',
      themes: {
        A: { base: 77, notes: "5,:0.5 1:0.5 3:1 3:0.5 2:0.5 1:1 | 6:1.5 5:0.5 3:2 | 4:0.5 5:0.5 6:1 6:0.5 5:0.5 4:1 | 5:3 r:1 | 5,:0.5 1:0.5 3:1 3:0.5 2:0.5 1:1 | 4:1.5 5:0.5 6:2 | 5:1 4:1 2:1 4:1 | 5:2 r:2" },
        B: { base: 65, notes: "3:1 4:1 6:1 5:1 | 5:2 3:1 2:1 | 3:1.5 1:0.5 3:1 5:1 | 6:3 r:1 | 4:1.5 2:0.5 4:1 6:1 | 2:1 3:1 5:2 | 1:3 r:1 | 5,:4" },
      },
      sections: [
        { name: 'Intro', chords: ['1maj7', '4maj7', '1maj7', '5sus'] },
        { name: 'Main', chords: ['1', '6m7', '2m7', '5', '1/3', '4', '2m7', '5sus 5'] },
        { name: 'Answer', chords: ['4maj7', '5', '3m7', '6m7', '2m7', '5', '1', '5sus'] },
        { name: 'Contrast', chords: ['b7', '4', 'b7', '4', '6m7', '2m7', '4', '5sus 5'] },
        { name: 'Refrain', chords: ['1', '6m7', '2m7', '5', '1/3', '4', '2m7', '5sus 5'] },
        { name: 'Turnaround', chords: ['4maj7', '1/3', '2m7', '5sus 5'] },
      ],
    },
    ending: {
      title: 'Color Comes Home', tempo: 78, key: 10, mode: 'major',
      themes: {
        A: { base: 70, notes: "3:1.5 4:0.5 5:2 | 6:1 5:1 3:2 | 4:1.5 3:0.5 2:1 4:1 | 3:3 r:1 | 5:1.5 6:0.5 1':2 | 2':1 1':1 6:2 | 6:1 5:1 4:1 3:1 | 2:2 r:2" },
        B: { base: 58, notes: "5:2 6:1 5:1 | 4:2 3:2 | 3:1 5:1 7:2 | 6:3 r:1 | 4:1 6:1 2':2 | 7:2 2':2 | 1':2 3':2 | 1':4" },
      },
      sections: [
        { name: 'Intro', chords: ['1add9', '4maj7', '6m7', '5sus'] },
        { name: 'Main', chords: ['1', '3m7', '4', '1/3', '6m7', '2m7', '4', '5sus 5'] },
        { name: 'Answer', chords: ['4maj7', '5', '3m7', '6m7', '2m7', '5/7', '1', '1'], roles: { 'keys-3': 'sparkle', 'pad-2': 'lead:B' } },
        { name: 'Refrain', chords: ['1', '3m7', '4', '1/3', '6m7', '2m7', '4', '5sus 5'], energy: 1 },
        { name: 'Turnaround', chords: ['4maj7', '1/3', '2m7', '5sus 5'] },
      ],
    },
    keeper: {
      title: 'Sealed Margins', tempo: 80, key: 4, mode: 'minor',
      tracks: { 'keys-2': { instrument: 'clarinet_recorded', gain: 0.9 } },
      themes: {
        A: { base: 64, notes: "1:1 3:0.5 5:0.5 4:1 3:1 | 1:1.5 7,:0.5 1:2 | 4:1 3:0.5 4:0.5 6:1 4:1 | 2:3 r:1 | 1:1 3:0.5 5:0.5 1':1 7:1 | 7:1.5 6:0.5 5:2 | 6:1 5:1 3:2 | 7#,:2 2:2" },
        B: { base: 76, notes: "3:1 5:1 1':2 | 7:1.5 6:0.5 5:2 | 5:1 3:1 2:1 3:1 | 1:3 r:1 | 3:1 5:1 1':2 | 2':1.5 1':0.5 7:2 | 6:1 5:1 4:1 3:1 | 2:3 r:1" },
      },
      sections: [
        { name: 'Intro', chords: ['1m', '6', '4m7', '5M'] },
        { name: 'Main', chords: ['1m', '6', '4m7', '5M', '1m', '3', '6', '5M'] },
        { name: 'Answer', chords: ['6', '7', '3', '1m', '6', '7', '4m7', '5M'], roles: { 'keys-3': null, keys: 'lead:B', 'keys-4': 'arp:harp8' } },
        { name: 'Contrast', chords: ['4m7', '1m', '4m7', '1m', '6', '3', '4m7', '5sus 5M'] },
        { name: 'Turnaround', chords: ['6', '7', '4m7', '5M'] },
      ],
    },
    limner: {
      title: 'Blue Surveyor', tempo: 70, key: 2, mode: 'lydian',
      themes: {
        A: { base: 74, notes: "5:2 4:1 3:1 | 2:3 3:1 | 7,:2 2:2 | 3:4 | 5:1.5 6:0.5 5:1 3:1 | 4:1.5 2:0.5 4:1 6:1 | 6:1 5:1 3:1 2:1 | 2:4" },
        B: { base: 86, notes: "6:1.5 5:0.5 3:2 | 4:1.5 2:0.5 7,:2 | 1:1 3:1 5:1 7:1 | 6:2 5:2 | 6:1.5 5:0.5 3:2 | 3:1 5:1 7:2 | 6:2 4:2 | 2:4" },
      },
      sections: [
        { name: 'Intro', chords: ['1maj7', '2', '1maj7', '2'], roles: { keys: null, 'keys-4': 'arp:harp16' } },
        { name: 'Main', chords: ['1maj7', '2', '7m7', '3m7', '1maj7', '2', '6m7', '5sus'], roles: { keys: null, 'keys-4': 'arp:harp16' } },
        { name: 'Answer', chords: ['6m7', '2', '1maj7', '5', '6m7', '3m7', '2', '2'] },
        { name: 'Contrast', chords: ['3m7', '6m7', '2', '1maj7', '3m7', '6m7', '2', '5sus'] },
        { name: 'Turnaround', chords: ['6m7', '2', '1maj7', '5sus'], roles: { keys: null, 'keys-4': 'arp:harp8' } },
      ],
    },
  },
};

const soften = amount => ({ mix: 1, amount });
const eq = (air, mud) => ({ mix: 1, air, mud });
const tape = { mix: 1, width: 0.35, drive: 0.4, wow: 0.45, squash: 0.8 };

const brush = sections => Object.fromEntries(Object.entries(sections).map(([name, roles]) =>
  [name, Object.fromEntries(Object.entries(roles).map(([id, job]) => [id, job === 'percussion:soft' ? 'percussion:brush'
    : job === 'percussion:swell' && name !== 'Turnaround' ? 'percussion:chimes' : job]))]));

function lofi(profile, cues, spare, cut) {
  const tracks = Object.fromEntries(Object.entries(profile.tracks).map(([id, t]) => [id, { effects: { ...t.effects, soften: soften(0.8), tone: tone(cut, 0.1), tape } }]));
  tracks[spare] = { instrument: 'vinyl_crackle', gain: 0.32, vel: 0.5, legato: true, effects: { eq: eq(0.6, 0.6), tape } };
  return Object.fromEntries(Object.entries(cues).map(([id, cue]) => [id, { ...cue, title: cue.title + ' (v2)', ...(id === 'menu' ? {
    tracks: { ...cue.tracks, ...tracks },
    sections: cue.sections.map(section => ({ ...section, roles: { ...section.roles, [spare]: 'bed' } })),
  } : {}) }]));
}

const UPRIGHT_V2 = {
  name: 'Watercolor A2: upright and legato strings',
  tracks: {
    keys: { ...UPRIGHT.tracks.keys, vel: 0.46,
      effects: { soften: soften(0.75), tone: tone(0.9, 0.05), eq: eq(0.3, 0.7), hall: hall(0.26, 0.55, 0.4, 0.015) } },
    pad: { ...UPRIGHT.tracks.pad, lo: 46, hi: 70, vel: 0.32, styles: { comp: { lo: 53, hi: 74, vel: 0.28 } },
      effects: { soften: soften(0.45), tone: tone(0.9, 0.1), eq: eq(0.4, 0.35), hall: hall(0.26, 0.55, 0.4, 0.015) } },
    'pad-2': { instrument: 'strings_section_chords', gain: 0.85, lo: 55, hi: 76, vel: 0.42, legato: true,
      styles: { counter: { lo: 57, hi: 79, vel: 0.5 } },
      effects: { tone: tone(0.82, 0), eq: eq(0.15, 0.7), hall: hall(0.38, 0.72, 0.45, 0.03) } },
    'pad-3': { ...UPRIGHT.tracks['pad-3'], legato: true,
      effects: { tone: tone(0.86, 0), eq: eq(0.15, 0), hall: hall(0.42, 0.75, 0.45, 0.03) } },
    bass: { ...UPRIGHT.tracks.bass, gain: 0.62,
      effects: { soften: soften(0.45), tone: tone(0.7, 0.2), eq: eq(0.2, 0.35), hall: hall(0.15, 0.45, 0.5, 0.01) } },
    'keys-2': { ...UPRIGHT.tracks['keys-2'], legato: true,
      effects: { tone: tone(0.9, 0), eq: eq(0.25, 0.2), hall: hall(0.36, 0.65, 0.45, 0.025) } },
    'keys-3': { ...UPRIGHT.tracks['keys-3'], gain: 0.6,
      effects: { soften: soften(0.5), tone: tone(0.9, 0), eq: eq(0.25, 0.3), hall: hall(0.38, 0.7, 0.45, 0.02) } },
    drums: { instrument: 'drums_soft_perc', gain: 0.48, vel: 0.4,
      effects: { tone: tone(0.85, 0.05), eq: eq(0, 0.2), hall: hall(0.4, 0.7, 0.45, 0.02) } },
  },
  extra: {
    ...UPRIGHT.extra,
    pad: { instrument: 'strings_section_chords', lo: 64, hi: 84, vel: 0.3, count: 3, legato: true, roles: { Contrast: 'pad', Refrain: 'pad' } },
    drums: { instrument: 'drums_soft_perc', vel: 0.3, roles: { Refrain: 'percussion:brush' } },
  },
  sections: brush(UPRIGHT.sections),
};
UPRIGHT_V2.cues = lofi(UPRIGHT_V2, UPRIGHT.cues, 'pad-3', 0.3);

const MALLETS_V2 = {
  name: 'Watercolor B2: mallets and warm pad',
  tracks: {
    keys: { ...MALLETS.tracks.keys, gain: 0.75,
      effects: { soften: soften(0.75), tone: tone(0.9, 0.05), eq: eq(0.3, 0.45), hall: hall(0.26, 0.55, 0.45, 0.015) } },
    'keys-2': { ...MALLETS.tracks['keys-2'], legato: true,
      effects: { tone: tone(0.86, 0), eq: eq(0, 0.2), hall: hall(0.36, 0.65, 0.45, 0.025) } },
    'keys-3': { ...MALLETS.tracks['keys-3'],
      effects: { soften: soften(0.5), tone: tone(0.62, 0), eq: eq(0, 0), hall: hall(0.42, 0.7, 0.45, 0.02) } },
    'keys-4': { ...MALLETS.tracks['keys-4'], gain: 0.6,
      effects: { soften: soften(0.5), tone: tone(0.88, 0), eq: eq(0.3, 0.3), hall: hall(0.38, 0.7, 0.45, 0.02) } },
    pad: { instrument: 'analog_pad', gain: 0.8, lo: 52, hi: 72, vel: 0.35, legato: true,
      effects: { tone: tone(0.66, 0.1), eq: eq(0, 0.45), hall: hall(0.32, 0.65, 0.45, 0.02) } },
    'pad-2': { ...MALLETS.tracks['pad-2'], instrument: 'strings_section_chords', legato: true,
      effects: { tone: tone(0.85, 0.05), eq: eq(0.35, 0.35), hall: hall(0.38, 0.72, 0.45, 0.03) } },
    bass: { ...MALLETS.tracks.bass, gain: 0.62,
      effects: { soften: soften(0.45), tone: tone(0.7, 0.2), eq: eq(0.2, 0.35), hall: hall(0.15, 0.45, 0.5, 0.01) } },
    drums: { instrument: 'drums_soft_perc', gain: 0.4, vel: 0.38,
      effects: { tone: tone(0.85, 0.05), eq: eq(0, 0.2), hall: hall(0.4, 0.7, 0.45, 0.02) } },
  },
  extra: {
    ...MALLETS.extra,
    pad: { instrument: 'strings_section_chords', lo: 64, hi: 84, vel: 0.3, count: 3, legato: true, roles: { Contrast: 'pad', Refrain: 'pad' } },
    drums: { instrument: 'drums_soft_perc', vel: 0.3, roles: { Refrain: 'percussion:brush' } },
  },
  sections: brush(MALLETS.sections),
};
MALLETS_V2.cues = lofi(MALLETS_V2, MALLETS.cues, 'pad-2', 0.3);

export const CUE_PROFILES = { watercolor_a: UPRIGHT, watercolor_b: MALLETS, watercolor_a2: UPRIGHT_V2, watercolor_b2: MALLETS_V2 };
