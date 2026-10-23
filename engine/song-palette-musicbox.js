import * as cozy from './song-palette-cozy.js';

export const INSTRUMENTS = {
  tine_box_chords: { name: 'Soft tine music box chords', part: 'pad', level: 0.3, pan: 0.12 },
  tine_box_bass: { name: 'Soft tine music box bass', part: 'bass', level: 0.27, pan: -0.06 },
};

export function voiceDuration(id, note, len) {
  return cozy.voiceDuration('tine_box', note, len);
}

export function makeVoice(id, note, len, sr, seed, beatSeconds, nodes) {
  return cozy.makeVoice('tine_box', note, len, sr, seed, beatSeconds, nodes);
}
