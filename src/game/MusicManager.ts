/**
 * MusicManager — Procedural background music via Web Audio API
 * Real melodic themes per mode, drum machine, polyrhythmic layers.
 */

let ctx: AudioContext | null = null;
let masterGain: GainNode | null = null;
let schedulerTimer: ReturnType<typeof setInterval> | null = null;
let isActive = false;
let currentMode: string | null = null;
let nextNoteTime = 0;
let activeTrack: Track | null = null;
let seqStates: { step: number }[] = [];

const LOOKAHEAD = 0.12;
const TICK = 50;

// ── Frequencies ─────────────────────────────────────────────────────────────
const F: Record<string, number> = {
  REST: 0,
  C2: 65.41,  D2: 73.42,  E2: 82.41,  F2: 87.31,  G2: 98.00,  A2: 110.00, Bb2: 116.54, B2: 123.47,
  C3: 130.81, D3: 146.83, Eb3: 155.56, E3: 164.81, F3: 174.61, G3: 196.00, Ab3: 207.65,
  A3: 220.00, Bb3: 233.08, B3: 246.94,
  C4: 261.63, D4: 293.66, Eb4: 311.13, E4: 329.63, F4: 349.23,
  G4: 392.00, Ab4: 415.30, A4: 440.00, Bb4: 466.16, B4: 493.88,
  C5: 523.25, D5: 587.33, Eb5: 622.25, E5: 659.25, F5: 698.46,
  G5: 783.99, Ab5: 830.61, A5: 880.00, Bb5: 932.33, B5: 987.77,
  C6: 1046.50,
};

type SeqType = OscillatorType | 'drum';
type Sequence = { notes: string[]; type: SeqType; vol: number; dur: number };
type Track = { bpm: number; steps: number; seqs: Sequence[] };

// ── Drum synthesis ───────────────────────────────────────────────────────────
function scheduleDrum(token: string, time: number, vol: number, ac: AudioContext, out: GainNode) {
  if (token === 'KICK') {
    const osc = ac.createOscillator();
    const g = ac.createGain();
    osc.connect(g); g.connect(out);
    osc.type = 'sine';
    osc.frequency.setValueAtTime(160, time);
    osc.frequency.exponentialRampToValueAtTime(40, time + 0.12);
    g.gain.setValueAtTime(vol, time);
    g.gain.exponentialRampToValueAtTime(0.001, time + 0.18);
    osc.start(time); osc.stop(time + 0.18);
    // transient click
    const osc2 = ac.createOscillator();
    const g2 = ac.createGain();
    osc2.connect(g2); g2.connect(out);
    osc2.type = 'square';
    osc2.frequency.setValueAtTime(120, time);
    g2.gain.setValueAtTime(vol * 0.4, time);
    g2.gain.exponentialRampToValueAtTime(0.001, time + 0.025);
    osc2.start(time); osc2.stop(time + 0.025);
  } else if (token === 'SNARE') {
    const len = Math.floor(ac.sampleRate * 0.18);
    const buf = ac.createBuffer(1, len, ac.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    const src = ac.createBufferSource();
    src.buffer = buf;
    const flt = ac.createBiquadFilter();
    flt.type = 'bandpass'; flt.frequency.value = 900; flt.Q.value = 0.7;
    const g = ac.createGain();
    src.connect(flt); flt.connect(g); g.connect(out);
    g.gain.setValueAtTime(vol * 0.65, time);
    g.gain.exponentialRampToValueAtTime(0.001, time + 0.18);
    src.start(time);
  } else if (token === 'HH') {
    const len = Math.floor(ac.sampleRate * 0.04);
    const buf = ac.createBuffer(1, len, ac.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    const src = ac.createBufferSource();
    src.buffer = buf;
    const flt = ac.createBiquadFilter();
    flt.type = 'highpass'; flt.frequency.value = 9000;
    const g = ac.createGain();
    src.connect(flt); flt.connect(g); g.connect(out);
    g.gain.setValueAtTime(vol * 0.35, time);
    g.gain.exponentialRampToValueAtTime(0.001, time + 0.04);
    src.start(time);
  } else if (token === 'OHH') {
    const len = Math.floor(ac.sampleRate * 0.22);
    const buf = ac.createBuffer(1, len, ac.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    const src = ac.createBufferSource();
    src.buffer = buf;
    const flt = ac.createBiquadFilter();
    flt.type = 'highpass'; flt.frequency.value = 6000;
    const g = ac.createGain();
    src.connect(flt); flt.connect(g); g.connect(out);
    g.gain.setValueAtTime(vol * 0.45, time);
    g.gain.exponentialRampToValueAtTime(0.001, time + 0.22);
    src.start(time);
  }
}

// ── Tracks ───────────────────────────────────────────────────────────────────
const TRACKS: Record<string, Track> = {

  // ── MENU — D minor, mysterious & atmospheric, 68 BPM, no drums ──────────────
  menu: {
    bpm: 68, steps: 2,
    seqs: [
      // Deep bass pedal (8 steps = 2 bars)
      {
        notes: ['D2','REST','REST','REST','A2','REST','REST','REST'],
        type: 'sine', vol: 0.09, dur: 3.2,
      },
      // Arpeggio layer (16 steps = 4 bars) — creates inner motion
      {
        notes: [
          'D4','F4','A4','C5', 'A4','F4','D4','REST',
          'A3','C4','Eb4','G4', 'Eb4','C4','A3','REST',
        ],
        type: 'sine', vol: 0.07, dur: 0.82,
      },
      // Main melody (32 steps = 8 bars) — a proper D minor theme
      {
        notes: [
          'D5','REST','C5','REST', 'A4','REST','F4','REST',
          'Eb4','REST','F4','G4', 'A4','REST','C5','REST',
          'Bb4','REST','A4','G4', 'F4','REST','G4','REST',
          'A4','C5','Bb4','A4', 'G4','F4','D4','REST',
        ],
        type: 'sine', vol: 0.10, dur: 0.88,
      },
      // Counter-melody (20 steps ≠ 8/16/32 → polyrhythm = theme feels longer)
      {
        notes: [
          'F3','A3','C4','F4', 'Eb4','C4','A3','F3',
          'G3','Bb3','D4','G4', 'F4','Eb4','D4','C4',
          'A3','C4','Eb4','G4',
        ],
        type: 'sine', vol: 0.04, dur: 1.4,
      },
    ],
  },

  // ── SOLO — C major, 8-bit upbeat, 124 BPM ────────────────────────────────
  solo: {
    bpm: 124, steps: 2,
    seqs: [
      // Drums (16 steps = 2 bars)
      {
        notes: [
          'KICK','HH','SNARE','HH', 'KICK','HH','SNARE','HH',
          'KICK','HH','SNARE','HH', 'KICK','HH','SNARE','OHH',
        ],
        type: 'drum', vol: 0.55, dur: 1,
      },
      // Walking bass (16 steps = 2 bars)
      {
        notes: [
          'C2','REST','C2','REST', 'C2','REST','G2','REST',
          'A2','REST','A2','REST', 'F2','REST','G2','REST',
        ],
        type: 'square', vol: 0.10, dur: 0.55,
      },
      // Main melody (32 steps = 4 bars) — catchy C major theme
      {
        notes: [
          'C5','REST','E5','G5', 'C6','G5','E5','C5',
          'D5','F5','A5','F5', 'G5','E5','REST','REST',
          'E5','G5','C6','REST', 'B5','A5','G5','F5',
          'E5','D5','C5','B4', 'C5','REST','REST','REST',
        ],
        type: 'square', vol: 0.09, dur: 0.72,
      },
      // Counter-melody (24 steps ≠ 16/32 → extends perceived loop)
      {
        notes: [
          'E4','G4','C5','B4', 'A4','G4','F4','E4',
          'D4','F4','A4','G4', 'F4','E4','D4','C4',
          'E4','G4','B4','C5', 'D5','C5','B4','REST',
        ],
        type: 'square', vol: 0.04, dur: 0.60,
      },
    ],
  },

  // ── BOT — E minor, tense battle, 140 BPM ─────────────────────────────────
  bot: {
    bpm: 140, steps: 2,
    seqs: [
      // Drums (16 steps = 2 bars) — tighter, more urgent
      {
        notes: [
          'KICK','HH','SNARE','HH', 'KICK','KICK','SNARE','HH',
          'KICK','HH','SNARE','HH', 'KICK','HH','SNARE','OHH',
        ],
        type: 'drum', vol: 0.55, dur: 1,
      },
      // Driving bass (16 steps)
      {
        notes: [
          'E2','REST','E2','E2', 'B2','REST','B2','REST',
          'A2','REST','A2','A2', 'G2','REST','G2','REST',
        ],
        type: 'square', vol: 0.10, dur: 0.50,
      },
      // Main melody (32 steps = 4 bars) — E minor tense theme
      {
        notes: [
          'E5','REST','G5','REST', 'B5','A5','G5','E5',
          'D5','REST','F5','REST', 'E5','D5','B4','REST',
          'C5','REST','E5','REST', 'D5','C5','B4','A4',
          'G4','A4','B4','D5', 'E5','REST','REST','REST',
        ],
        type: 'square', vol: 0.09, dur: 0.72,
      },
      // Stab layer (12 steps ≠ 16/32 → polyrhythm)
      {
        notes: [
          'E3','REST','G3','REST', 'A3','REST','B3','REST', 'D4','REST','E4','REST',
        ],
        type: 'sawtooth', vol: 0.04, dur: 0.45,
      },
    ],
  },

  // ── PVP — A minor, intense & driving, 164 BPM ────────────────────────────
  pvp: {
    bpm: 164, steps: 2,
    seqs: [
      // Drums (16 steps) — relentless 4/4
      {
        notes: [
          'KICK','HH','SNARE','HH', 'KICK','HH','KICK','HH',
          'SNARE','HH','KICK','HH', 'SNARE','HH','KICK','OHH',
        ],
        type: 'drum', vol: 0.60, dur: 1,
      },
      // Aggressive bass (16 steps)
      {
        notes: [
          'A2','A2','REST','A2', 'C3','C3','REST','C3',
          'G2','G2','REST','G2', 'F2','F2','REST','F2',
        ],
        type: 'sawtooth', vol: 0.10, dur: 0.45,
      },
      // Main melody (32 steps = 4 bars) — A minor battle theme
      {
        notes: [
          'A5','REST','G5','E5', 'C5','REST','E5','REST',
          'A5','G5','E5','C5', 'B4','C5','D5','E5',
          'F5','REST','E5','D5', 'C5','REST','A4','B4',
          'C5','D5','E5','F5', 'G5','A5','REST','REST',
        ],
        type: 'square', vol: 0.09, dur: 0.72,
      },
      // Pulse layer (10 steps ≠ 16/32 → variation)
      {
        notes: [
          'A4','C5','E5','A5', 'G5','E5','C5','A4', 'E5','G5',
        ],
        type: 'square', vol: 0.04, dur: 0.30,
      },
    ],
  },
};

// ── Audio context ─────────────────────────────────────────────────────────────
function getCtx(): AudioContext {
  if (!ctx) {
    ctx = new AudioContext();
    masterGain = ctx.createGain();
    masterGain.gain.value = 0.28;
    masterGain.connect(ctx.destination);
  }
  if (ctx.state === 'suspended') ctx.resume();
  return ctx;
}

function scheduleNote(note: string, type: SeqType, time: number, dur: number, vol: number) {
  if (!masterGain || note === 'REST') return;
  const ac = getCtx();

  if (type === 'drum') {
    scheduleDrum(note, time, vol, ac, masterGain);
    return;
  }

  const freq = F[note] ?? 0;
  if (freq === 0) return;

  const osc = ac.createOscillator();
  const gain = ac.createGain();
  osc.connect(gain);
  gain.connect(masterGain);
  osc.type = type as OscillatorType;
  osc.frequency.setValueAtTime(freq, time);
  gain.gain.setValueAtTime(vol, time);
  gain.gain.exponentialRampToValueAtTime(0.001, time + dur * 0.88);
  osc.start(time);
  osc.stop(time + dur);
}

function scheduleAhead() {
  if (!activeTrack || !masterGain) return;
  const ac = getCtx();
  const stepDur = 60 / (activeTrack.bpm * activeTrack.steps);

  while (nextNoteTime < ac.currentTime + LOOKAHEAD) {
    activeTrack.seqs.forEach((seq, i) => {
      const step = seqStates[i].step % seq.notes.length;
      scheduleNote(seq.notes[step], seq.type, nextNoteTime, stepDur * seq.dur, seq.vol);
      seqStates[i].step++;
    });
    nextNoteTime += stepDur;
  }
}

// ── Public API ────────────────────────────────────────────────────────────────
export const MusicManager = {
  play(mode: 'menu' | 'solo' | 'pvp' | 'bot') {
    if (currentMode === mode && isActive) return;
    this.stop();

    const track = TRACKS[mode];
    if (!track) return;

    try {
      const ac = getCtx();
      activeTrack = track;
      seqStates = track.seqs.map(() => ({ step: 0 }));
      nextNoteTime = ac.currentTime + 0.05;
      currentMode = mode;
      isActive = true;

      scheduleAhead();
      schedulerTimer = setInterval(scheduleAhead, TICK);
    } catch (_) {}
  },

  stop() {
    if (schedulerTimer !== null) { clearInterval(schedulerTimer); schedulerTimer = null; }
    isActive = false;
    currentMode = null;
    activeTrack = null;
  },

  fadeOut(ms: number = 700) {
    if (!masterGain || !ctx) { this.stop(); return; }
    const gain = masterGain;
    const ac = ctx;
    gain.gain.setTargetAtTime(0.001, ac.currentTime, ms / 1000 / 3);
    setTimeout(() => {
      this.stop();
      gain.gain.setValueAtTime(0.28, ac.currentTime);
    }, ms);
  },

  setVolume(vol: number) {
    if (masterGain && ctx) masterGain.gain.setTargetAtTime(vol, ctx.currentTime, 0.1);
  },
};
