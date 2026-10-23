import { tickSample } from './song.js';

const ranges = {
  delay: { mix: [0, 1], beats: [0.125, 2], feedback: [0, 0.75], damp: [0, 1] },
  reverb: { mix: [0, 1], size: [0.2, 1], damp: [0, 1] },
  crush: { mix: [0, 1], bits: [4, 16], rate: [1, 16] },
  tone: { mix: [0, 1], cut: [0, 1], warmth: [0, 1] },
  hall: { mix: [0, 1], size: [0, 1], damp: [0, 1], predelay: [0, 0.12] },
  soften: { mix: [0, 1], amount: [0, 1] },
  eq: { mix: [0, 1], air: [0, 1], mud: [0, 1] },
  tape: { mix: [0, 1], width: [0, 1], drive: [0, 1], wow: [0, 1], squash: [0, 1] },
  pump: { mix: [0, 1], beats: [0.25, 2], release: [0.1, 1] },
  wide: { mix: [0, 1], depth: [0, 1] },
};

const HALL_LINES = [31.3, 37.9, 41.1, 47.3, 53.9, 59.3, 67.1, 73.7];

export const hallSeconds = hall => 0.9 + 4.6 * hall.size;
export const toneHz = tone => 300 * 2 ** (tone.cut * Math.log2(16000 / 300));

export function validEffects(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  return Object.entries(value).every(([name, settings]) => {
    if (!Object.hasOwn(ranges, name) || !settings || typeof settings !== 'object' || Array.isArray(settings)) return false;
    return Object.keys(settings).length === Object.keys(ranges[name]).length && Object.entries(settings).every(([key, n]) => {
      const range = ranges[name][key];
      return range && Number.isFinite(n) && n >= range[0] && n <= range[1] && (!['bits', 'rate'].includes(key) || Number.isInteger(n));
    });
  });
}

export function effectTail(song) {
  let seconds = 1.4;
  for (const { effects = {} } of song.tracks) {
    if (effects.delay?.mix) {
      const repeats = effects.delay.feedback ? Math.ceil(Math.log(0.00001) / Math.log(effects.delay.feedback)) : 1;
      seconds = Math.max(seconds, Math.min(6, repeats * effects.delay.beats * 60 / song.tempo));
    }
    if (effects.reverb?.mix) seconds = Math.max(seconds, 2 + 4 * effects.reverb.size);
    if (effects.hall?.mix) seconds = Math.max(seconds, Math.min(8, effects.hall.predelay + hallSeconds(effects.hall)));
  }
  return seconds;
}

export function effectFrames(song) {
  return tickSample(song, song.bars * 4 * song.ppq) + (song.form === 'loop' ? 0 : Math.round(song.output.sampleRate * effectTail(song)));
}

function shelf(hz, db, sr) {
  const a = 10 ** (db / 40), w = 2 * Math.PI * hz / sr, cos = Math.cos(w);
  const alpha = Math.sin(w) / 2 * Math.sqrt((a + 1 / a) * (1 / 0.8 - 1) + 2), root = 2 * Math.sqrt(a) * alpha;
  const a0 = (a + 1) - (a - 1) * cos + root;
  return [a * ((a + 1) + (a - 1) * cos + root), -2 * a * ((a - 1) + (a + 1) * cos), a * ((a + 1) + (a - 1) * cos - root),
    2 * ((a - 1) - (a + 1) * cos), (a + 1) - (a - 1) * cos - root].map(n => n / a0);
}

function bell(hz, db, q, sr) {
  const a = 10 ** (db / 40), w = 2 * Math.PI * hz / sr, alpha = Math.sin(w) / (2 * q), a0 = 1 + alpha / a;
  return [1 + alpha * a, -2 * Math.cos(w), 1 - alpha * a, -2 * Math.cos(w), 1 - alpha / a].map(n => n / a0);
}

function biquad(k, state, x) {
  const y = k[0] * x + k[1] * state[0] + k[2] * state[1] - k[3] * state[2] - k[4] * state[3];
  state[1] = state[0]; state[0] = x; state[3] = state[2]; state[2] = y;
  return y;
}

function lagged(state, lag) {
  const back = state.at - 1 - lag + state.data.length * 2;
  const at = Math.floor(back), fraction = back - at;
  const a = state.data[at % state.data.length], b = state.data[(at + 1) % state.data.length];
  return a + (b - a) * fraction;
}

function line(frames) {
  return { data: new Float32Array(Math.max(1, Math.round(frames))), at: 0, low: 0 };
}

function tap(state, value) {
  const old = state.data[state.at];
  state.data[state.at] = value;
  if (++state.at === state.data.length) state.at = 0;
  return old;
}

export function createSongEffects(effects = {}, sr, tempo) {
  const crush = effects.crush?.mix ? effects.crush : null;
  const delay = effects.delay?.mix ? effects.delay : null;
  const reverb = effects.reverb?.mix ? effects.reverb : null;
  const tone = effects.tone?.mix ? effects.tone : null;
  const hall = effects.hall?.mix ? effects.hall : null;
  const soften = effects.soften?.mix ? effects.soften : null;
  const eq = effects.eq?.mix ? effects.eq : null;
  const tape = effects.tape?.mix ? effects.tape : null;
  const pump = effects.pump?.mix ? effects.pump : null;
  const wide = effects.wide?.mix ? effects.wide : null;
  const choruses = wide ? [line(sr * 0.03), line(sr * 0.03)] : [];
  const sweep = [0, 0];
  const follow = seconds => 1 - Math.exp(-1 / (sr * seconds));
  const envelope = { fast: 0, slow: 0, attack: follow(0.0008), swell: follow(0.03), fall: follow(0.08) };
  const airK = eq ? shelf(Math.min(6500, sr * 0.4), 9 * eq.air, sr) : null, mudK = eq ? bell(330, -6 * eq.mud, 0.8, sr) : null;
  const eqState = [0, 1].map(() => [[0, 0, 0, 0], [0, 0, 0, 0]]);
  const reels = tape ? [line(sr * 0.02), line(sr * 0.02)] : [];
  const reel = [0, 0];
  const bar = sr * 240 / tempo;
  const drive = tape ? 1 + tape.drive * 12 : 1;
  const squash = { level: 0, attack: follow(0.002), fall: follow(0.25) };
  const toneCoef = tone ? 1 - Math.exp(-2 * Math.PI * toneHz(tone) / sr) : 0;
  const warmCoef = 1 - Math.exp(-2 * Math.PI * 220 / sr);
  const toneState = [[0, 0, 0], [0, 0, 0]];
  const pre = hall ? line(sr * hall.predelay + 1) : null;
  const lines = hall ? HALL_LINES.map(ms => line(sr * ms / 1000 * (0.55 + 1.5 * hall.size))) : [];
  const gains = hall ? lines.map(l => 10 ** (-3 * l.data.length / (sr * hallSeconds(hall)))) : [];
  const hallDiffusers = hall ? [0.0047, 0.0071, 0.0113].map(t => line(sr * t)) : [];
  const hallDamp = hall ? 1 - hall.damp * 0.85 : 0;
  const taps = new Float64Array(8);
  const delays = delay ? [line(sr * 60 / tempo * delay.beats), line(sr * 60 / tempo * delay.beats)] : [];
  const combs = reverb ? [0, 1].map(c => [0.0297, 0.0371, 0.0411, 0.0437].map(t => line(sr * t * (0.5 + reverb.size) + c * 23))) : [];
  const diffusers = reverb ? [0, 1].map(c => [0.005, 0.0017].map(t => line(sr * t + c * 11))) : [];
  const held = [0, 0];
  const values = [0, 0];
  const echoes = [0, 0];
  let clock = 0;
  let tapeClock = 0;
  let pumpClock = 0;
  let wideClock = 0;
  const pumpFrames = pump ? sr * 60 / tempo * pump.beats : 0;
  const pumpAttack = sr * 0.003;
  const process = channels => {
    if (!crush && !delay && !reverb && !tone && !hall && !soften && !eq && !tape && !pump && !wide) return channels;
    const steps = crush ? 2 ** (crush.bits - 1) : 0;
    const delayDamp = delay ? 1 - delay.damp * 0.95 : 0;
    const reverbDamp = reverb ? 1 - reverb.damp * 0.92 : 0;
    const reverbFeedback = reverb ? 0.68 + reverb.size * 0.17 : 0;
    for (let i = 0; i < channels[0].length; i++) {
      values[0] = channels[0][i];
      values[1] = channels[1][i];
      if (soften) {
        const level = Math.max(Math.abs(values[0]), Math.abs(values[1]));
        envelope.fast += (level - envelope.fast) * (level > envelope.fast ? envelope.attack : envelope.fall);
        envelope.slow += (level - envelope.slow) * (level > envelope.slow ? envelope.swell : envelope.fall);
        const ratio = Math.min(1, (envelope.slow + 1e-6) / (envelope.fast + 1e-6));
        const gain = 1 + (Math.max(0.25, ratio ** (1.5 * soften.amount)) - 1) * soften.mix;
        values[0] *= gain;
        values[1] *= gain;
      }
      if (crush) {
        for (let c = 0; c < 2; c++) {
          if (!clock) held[c] = Math.round(values[c] * steps) / steps;
          values[c] += (held[c] - values[c]) * crush.mix;
        }
        if (++clock === crush.rate) clock = 0;
      }
      if (tone) {
        for (let c = 0; c < 2; c++) {
          const state = toneState[c];
          state[0] += (values[c] - state[0]) * toneCoef;
          state[1] += (state[0] - state[1]) * toneCoef;
          state[2] += (values[c] - state[2]) * warmCoef;
          values[c] += (state[1] + state[2] * tone.warmth - values[c]) * tone.mix;
        }
      }
      if (eq) {
        for (let c = 0; c < 2; c++) {
          const wet = biquad(mudK, eqState[c][1], biquad(airK, eqState[c][0], values[c]));
          values[c] += (wet - values[c]) * eq.mix;
        }
      }
      if (wide) {
        const phase = 2 * Math.PI * wideClock / bar, mono = (values[0] + values[1]) * 0.5;
        for (let c = 0; c < 2; c++) {
          tap(choruses[c], mono);
          sweep[c] = lagged(choruses[c], sr * (c ? 0.011 : 0.007) * (1 + wide.depth * 0.35 * Math.sin(phase + c * Math.PI)));
        }
        values[0] += (sweep[0] - 0.6 * sweep[1]) * 0.6 * wide.mix;
        values[1] += (sweep[1] - 0.6 * sweep[0]) * 0.6 * wide.mix;
        if (++wideClock >= bar) wideClock -= bar;
      }
      if (delay) {
        echoes[0] = delays[0].data[delays[0].at];
        echoes[1] = delays[1].data[delays[1].at];
        for (let c = 0; c < 2; c++) {
          const state = delays[c];
          state.low += (echoes[1 - c] - state.low) * delayDamp;
          tap(state, values[c] + state.low * delay.feedback);
          values[c] += echoes[c] * delay.mix;
        }
      }
      if (reverb) {
        for (let c = 0; c < 2; c++) {
          let wet = 0;
          for (const state of combs[c]) {
            const old = state.data[state.at];
            state.low += (old - state.low) * reverbDamp;
            tap(state, values[c] + state.low * reverbFeedback);
            wet += old * 0.25;
          }
          for (const state of diffusers[c]) {
            const old = state.data[state.at];
            tap(state, wet + old * 0.5);
            wet = old - wet * 0.5;
          }
          values[c] += wet * reverb.mix;
        }
      }
      if (hall) {
        let wet = tap(pre, (values[0] + values[1]) * 0.5);
        for (const state of hallDiffusers) {
          const old = state.data[state.at];
          tap(state, wet + old * 0.6);
          wet = old - wet * 0.6;
        }
        let sum = 0;
        for (let n = 0; n < 8; n++) {
          const state = lines[n];
          state.low += (state.data[state.at] - state.low) * hallDamp;
          taps[n] = state.low * gains[n];
          sum += taps[n];
        }
        sum *= 0.25;
        let left = 0, right = 0;
        for (let n = 0; n < 8; n++) {
          tap(lines[n], taps[n] - sum + (n % 2 ? -wet : wet));
          if (n % 2) right += taps[n] * (n & 2 ? -1 : 1);
          else left += taps[n] * (n & 4 ? -1 : 1);
        }
        values[0] += (left + right * 0.4) * 0.3 * hall.mix;
        values[1] += (right + left * 0.4) * 0.3 * hall.mix;
      }
      if (tape) {
        const phase = 2 * Math.PI * tapeClock / bar;
        const lag = sr * (0.006 + tape.wow * (0.0016 * Math.sin(phase) + 0.00012 * Math.sin(16 * phase)));
        for (let c = 0; c < 2; c++) {
          const state = reels[c];
          tap(state, values[c]);
          const back = state.at - 1 - lag + state.data.length * 2;
          const at = Math.floor(back), fraction = back - at;
          const a = state.data[at % state.data.length], b = state.data[(at + 1) % state.data.length];
          reel[c] = Math.tanh(drive * (a + (b - a) * fraction)) / drive;
        }
        const power = Math.max(reel[0] * reel[0], reel[1] * reel[1]);
        squash.level += (power - squash.level) * (power > squash.level ? squash.attack : squash.fall);
        const over = 10 * Math.log10(squash.level + 1e-12) + 20 + 32 * tape.squash;
        const gain = over > 0 ? 10 ** (-over * (1 - 1 / (1 + 3 * tape.squash)) / 20) : 1;
        const mid = (reel[0] + reel[1]) * 0.5 * gain, side = (reel[0] - reel[1]) * 0.5 * gain * tape.width;
        values[0] += (mid + side - values[0]) * tape.mix;
        values[1] += (mid - side - values[1]) * tape.mix;
        if (++tapeClock >= bar) tapeClock -= bar;
      }
      if (pump) {
        const x = Math.min(1, pumpClock / (pumpFrames * pump.release));
        const gain = 1 - pump.mix * Math.min(1, pumpClock / pumpAttack) * (1 - x) ** 2;
        values[0] *= gain;
        values[1] *= gain;
        if (++pumpClock >= pumpFrames) pumpClock -= pumpFrames;
      }
      channels[0][i] = values[0];
      channels[1][i] = values[1];
    }
    return channels;
  };
  process.resetCycle = () => { clock = 0; tapeClock = 0; pumpClock = 0; wideClock = 0; };
  return process;
}
