import * as electronic from './song-palette-electronic.js';
import * as cozy from './song-palette-cozy.js';
import * as band from './song-palette-band.js';

import * as modern from './song-palette-modern.js';

import * as cinematic from './song-palette-cinematic.js';

import * as space from './song-palette-space.js';

import * as neon from './song-palette-neon.js';

import * as musicbox from './song-palette-musicbox.js';

const families = [electronic, cozy, band, modern, cinematic, space, neon, musicbox];
export const PALETTE = Object.assign({}, ...families.map(family => family.INSTRUMENTS));

export function paletteDuration(id, note, len) {
  return families.find(family => Object.hasOwn(family.INSTRUMENTS, id)).voiceDuration(id, note, len);
}

export function paletteVoice(id, note, len, sr, seed, beatSeconds, nodes) {
  return families.find(family => Object.hasOwn(family.INSTRUMENTS, id)).makeVoice(id, note, len, sr, seed, beatSeconds, nodes);
}
