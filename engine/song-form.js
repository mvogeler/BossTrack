import { addNote } from './song.js';
import { degree } from './kit/music.js';

export const FORMS = { sketch: 'Sketch (4 bars)', song: 'Song (A/B + ending)', loop: 'Loop (A/B)' };

export function arrangePart(song, track) {
  if (!song.form || song.form === 'sketch') return track;
  const first = track.notes.slice();
  if (track.id === 'keys' && song.sectionAnswer === 'phrased') repeatKeys(song, track, first);
  else if (track.id === 'keys' && ['developed', 'harmonic'].includes(song.sectionAnswer)) answerKeys(song, track, first);
  else if (track.id === 'pad' && song.sectionPad === 'entry') answerPad(song, track, first);
  else if (track.id === 'bass' && song.genre === 'space' && song.genreRevision === 2 && song.bass === 'auto') {
    for (const note of first) track.notes.push({ ...note, id: track.id + '-' + track.notes.length, tick: note.tick + 16 * song.ppq });
  }
  else if (track.id === 'bass' && song.sectionBass === 'response') answerBass(song, track, first);
  else if (track.id === 'drums' && song.sectionDrums === 'contrast') answerDrums(song, track, first);
  else first.forEach((note, i) => {
    if (track.id === 'keys' && i % 3 === 1 && i !== first.length - 1) return;
    const midi = track.id === 'keys' ? note.midi - 12 : note.midi;
    track.notes.push({ ...note, id: track.id + '-' + track.notes.length,
      tick: note.tick + 16 * song.ppq, midi, vel: note.vel * (track.id === 'drums' ? 0.85 : 1) });
  });
  if (song.form === 'song') {
    if (track.id === 'keys') addNote(track, 32, song.harmony.root + 12, 3.5, 0.65);
    if (track.id === 'pad') song.harmony.chords[0].notes.forEach((midi) => addNote(track, 32, midi, 3.5, 0.5));
    if (track.id === 'bass') addNote(track, 32, song.harmony.root - 24, 2.5, 0.7);
    if (track.id === 'drums') addNote(track, 32, 36, 0.2, 0.7);
  }
  return track;
}

function answerKeys(song, track, first) {
  for (let bar = 0; bar < 4; bar++) {
    const phrase = first.filter(n => Math.floor(n.tick / (4 * song.ppq)) === bar);
    const kept = phrase.filter((n, i) => i % 3 !== 1 || i === phrase.length - 1);
    const pitches = kept.map(n => n.midi).reverse();
    const answerStart = track.notes.length;
    kept.forEach((note, i) => {
      const start = (bar + 4) * 4 * song.ppq;
      const offset = note.tick - bar * 4 * song.ppq;
      const delay = bar % 2 === 0 ? song.ppq / 2 : 0;
      const tick = Math.round(start + delay + offset * (1 - delay / (4 * song.ppq)));
      const next = i + 1 < kept.length ? delay + (kept[i + 1].tick - bar * 4 * song.ppq) * (1 - delay / (4 * song.ppq)) : 4 * song.ppq;
      const midi = bar === 3 && i === kept.length - 1 ? note.midi : pitches[i];
      track.notes.push({ ...note, id: track.id + '-' + track.notes.length, tick, midi,
        len: Math.max(1, Math.round((next - (tick - start)) * 0.85)) });
    });
    if (song.sectionAnswer === 'harmonic') fitAnswer(song, bar, track.notes.slice(answerStart));
  }
}

function answerDrums(song, track, first) {
  for (let bar = 0; bar < 4; bar++) {
    const phrase = first.filter(n => Math.floor(n.tick / (4 * song.ppq)) === bar);
    const lastSnare = phrase.filter(n => n.midi === 38).at(-1);
    for (const note of phrase) {
      if (bar < 2 && note.midi === 42 && note.tick % (2 * song.ppq) !== 0) continue;
      if (bar < 2 && note.midi === 38 && note !== lastSnare) continue;
      track.notes.push({ ...note, id: track.id + '-' + track.notes.length,
        tick: note.tick + 16 * song.ppq, vel: note.vel * 0.85 });
    }
  }
}

function answerBass(song, track, first) {
  for (let bar = 0; bar < 4; bar++) {
    const phrase = first.filter(n => Math.floor(n.tick / (4 * song.ppq)) === bar);
    if (bar < 2) {
      const root = song.harmony.chords[bar].root - 24;
      addNote(track, (bar + 4) * 4, root, 2.25, phrase[0].vel);
      addNote(track, (bar + 4) * 4 + 3, degree(song.harmony.scale, song.harmony.steps[bar] + 4) - 24, 0.65, phrase[0].vel * 0.8);
    } else {
      phrase.forEach((note, i) => {
        const midi = bar === 2 && i === phrase.length - 1 ? degree(song.harmony.scale, song.harmony.steps[3] - 1) - 24 : note.midi;
        track.notes.push({ ...note, id: track.id + '-' + track.notes.length,
          tick: note.tick + 16 * song.ppq, midi });
      });
    }
  }
}

function fitAnswer(song, bar, notes) {
  const chord = song.harmony.chords[bar].notes;
  const nearest = midi => {
    const tones = chord.flatMap(n => [-12, 0, 12, 24, 36].map(shift => n + shift));
    return tones.reduce((best, n) => Math.abs(n - midi) < Math.abs(best - midi) ? n : best);
  };
  const anchor = notes.map((n, i) => i === 0 || i === notes.length - 1 || n.len >= 0.75 * song.ppq || n.vel >= 0.75);
  notes.forEach((note, i) => {
    if (anchor[i]) note.midi = nearest(note.midi);
  });
  for (let i = notes.length - 2; i > 0; i--) {
    if (!anchor[i] && Math.abs(notes[i].midi - notes[i + 1].midi) > 2) notes[i].midi = nearest(notes[i].midi);
  }
}

function repeatKeys(song, track, first) {
  for (const note of first) {
    const soft = note.tick < 8 * song.ppq;
    track.notes.push({ ...note, id: track.id + '-' + track.notes.length,
      tick: note.tick + 16 * song.ppq, len: soft ? Math.max(1, Math.round(note.len * 0.8)) : note.len,
      vel: note.vel * (soft ? 0.9 : 1) });
  }
}

function answerPad(song, track, first) {
  for (const note of first) {
    const bar = Math.floor(note.tick / (4 * song.ppq));
    const tick = note.tick + (16 + (bar < 2 ? 1 : 0)) * song.ppq;
    const end = (bar + 5) * 4 * song.ppq;
    if (tick >= end) continue;
    track.notes.push({ ...note, id: track.id + '-' + track.notes.length, tick,
      len: Math.min(note.len, end - tick) });
  }
}
