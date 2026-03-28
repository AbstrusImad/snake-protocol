/**
 * MusicManager — Procedural background music via Web Audio API
 * No external files. All music generated with oscillators + sequencer.
 */

let ctx: AudioContext | null = null;
let masterGain: GainNode | null = null;
let schedulerTimer: ReturnType<typeof setInterval> | null = null;
let isActive = false;
let currentMode: string | null = null;
let nextNoteTime = 0;
let activeTrack: Track | null = null;
let seqStates: { step: number }[] = [];

const LOOKAHEAD = 0.12;    // seconds to schedule ahead
const TICK = 50;           // ms between scheduler runs

// ── Note frequencies ───────────────────────────────────────────────────────
const F: Record<string, number> = {
  REST: 0,
  C2: 65.41,  D2: 73.42,  E2: 82.41,  F2: 87.31,  G2: 98.00,  A2: 110.00, B2: 123.47,
  C3: 130.81, D3: 146.83, Eb3: 155.56,E3: 164.81, F3: 174.61, G3: 196.00, Ab3: 207.65,
  A3: 220.00, Bb3: 233.08,B3: 246.94,
  C4: 261.63, D4: 293.66, Eb4: 311.13,E4: 329.63, F4: 349.23, G4: 392.00, Ab4: 415.30,
  A4: 440.00, Bb4: 466.16,B4: 493.88,
  C5: 523.25, D5: 587.33, Eb5: 622.25,E5: 659.25, F5: 698.46, G5: 783.99, A5: 880.00,
};

type Sequence = { notes: string[]; type: OscillatorType; vol: number; dur: number };
type Track = { bpm: number; steps: number; seqs: Sequence[] };

// ── Tracks ─────────────────────────────────────────────────────────────────
const TRACKS: Record<string, Track> = {

  // MENU — ambient D minor arpeggios, slow & mysterious
  menu: {
    bpm: 72, steps: 2,
    seqs: [
      {
        notes: ['D4','F4','A4','C5','A4','F4','D4','REST','A3','C4','Eb4','G4','Eb4','C4','A3','REST'],
        type: 'sine', vol: 0.10, dur: 0.88,
      },
      {
        notes: ['D2','REST','REST','REST','REST','REST','REST','REST','A2','REST','REST','REST','REST','REST','REST','REST'],
        type: 'sine', vol: 0.07, dur: 3.5,
      },
      {
        notes: ['REST','REST','F3','REST','REST','REST','REST','REST','REST','REST','C4','REST','REST','REST','REST','REST'],
        type: 'sine', vol: 0.05, dur: 1.8,
      },
    ],
  },

  // SOLO — upbeat C major 8-bit, moderate tempo
  solo: {
    bpm: 126, steps: 4,
    seqs: [
      {
        notes: ['C2','REST','C2','REST','G2','REST','G2','REST','A2','REST','A2','REST','F2','REST','F2','REST'],
        type: 'square', vol: 0.09, dur: 0.38,
      },
      {
        notes: ['C4','E4','G4','E4','G4','C5','E5','REST','A4','C5','E5','C5','F4','A4','C5','REST'],
        type: 'square', vol: 0.07, dur: 0.28,
      },
      {
        notes: ['G4','REST','REST','REST','G4','REST','REST','G4','F4','REST','REST','REST','F4','REST','REST','F4'],
        type: 'square', vol: 0.04, dur: 0.10,
      },
    ],
  },

  // BOT — competitive E minor, medium-fast
  bot: {
    bpm: 138, steps: 4,
    seqs: [
      {
        notes: ['E2','REST','E2','G2','B2','REST','B2','REST','A2','REST','A2','C3','G2','REST','G2','REST'],
        type: 'square', vol: 0.09, dur: 0.33,
      },
      {
        notes: ['E4','G4','B4','G4','B4','E5','D5','REST','C5','B4','A4','G4','A4','B4','E4','REST'],
        type: 'square', vol: 0.07, dur: 0.26,
      },
      {
        notes: ['E5','REST','E5','REST','REST','E5','REST','E5','E5','REST','E5','REST','REST','E5','REST','E5'],
        type: 'square', vol: 0.03, dur: 0.08,
      },
    ],
  },

  // PVP — intense A minor, fast & driving
  pvp: {
    bpm: 160, steps: 4,
    seqs: [
      {
        notes: ['A2','A2','REST','A2','C3','REST','C3','REST','G2','G2','REST','G2','F2','REST','F2','F2'],
        type: 'sawtooth', vol: 0.08, dur: 0.28,
      },
      {
        notes: ['A4','C5','E5','C5','E5','A5','G5','E5','F5','E5','D5','C5','B4','A4','G4','REST'],
        type: 'square', vol: 0.08, dur: 0.23,
      },
      {
        notes: ['REST','REST','E4','REST','REST','REST','A4','REST','REST','REST','D4','REST','REST','REST','G4','REST'],
        type: 'square', vol: 0.05, dur: 0.18,
      },
      {
        notes: ['A2','REST','REST','A2','REST','A2','REST','REST','G2','REST','REST','G2','REST','G2','REST','REST'],
        type: 'sawtooth', vol: 0.06, dur: 0.14,
      },
    ],
  },
};

// ── Internals ───────────────────────────────────────────────────────────────
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

function scheduleNote(freq: number, time: number, dur: number, vol: number, type: OscillatorType) {
  if (freq === 0 || !masterGain) return;
  const ac = getCtx();
  const osc = ac.createOscillator();
  const gain = ac.createGain();
  osc.connect(gain);
  gain.connect(masterGain);
  osc.type = type;
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
      const freq = F[seq.notes[step]] ?? 0;
      scheduleNote(freq, nextNoteTime, stepDur * seq.dur, seq.vol, seq.type);
      seqStates[i].step++;
    });
    nextNoteTime += stepDur;
  }
}

// ── Public API ──────────────────────────────────────────────────────────────
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

  fadeOut(ms: number = 600) {
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
