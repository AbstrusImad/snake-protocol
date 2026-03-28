/**
 * SoundManager — Web Audio API sound synthesis for Snake Protocol
 * No external files needed; all sounds generated programmatically.
 */

let ctx: AudioContext | null = null;

function getCtx(): AudioContext {
  if (!ctx) ctx = new AudioContext();
  if (ctx.state === "suspended") ctx.resume();
  return ctx;
}

function beep(
  frequency: number,
  duration: number,
  volume: number = 0.3,
  type: OscillatorType = "square",
  fadeOut: boolean = true
) {
  try {
    const ac = getCtx();
    const osc = ac.createOscillator();
    const gain = ac.createGain();
    osc.connect(gain);
    gain.connect(ac.destination);
    osc.type = type;
    osc.frequency.setValueAtTime(frequency, ac.currentTime);
    gain.gain.setValueAtTime(volume, ac.currentTime);
    if (fadeOut) gain.gain.exponentialRampToValueAtTime(0.001, ac.currentTime + duration);
    osc.start(ac.currentTime);
    osc.stop(ac.currentTime + duration);
  } catch (_) {}
}

function sweep(
  freqStart: number,
  freqEnd: number,
  duration: number,
  volume: number = 0.3,
  type: OscillatorType = "square"
) {
  try {
    const ac = getCtx();
    const osc = ac.createOscillator();
    const gain = ac.createGain();
    osc.connect(gain);
    gain.connect(ac.destination);
    osc.type = type;
    osc.frequency.setValueAtTime(freqStart, ac.currentTime);
    osc.frequency.exponentialRampToValueAtTime(freqEnd, ac.currentTime + duration);
    gain.gain.setValueAtTime(volume, ac.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ac.currentTime + duration);
    osc.start(ac.currentTime);
    osc.stop(ac.currentTime + duration);
  } catch (_) {}
}

function noise(duration: number, volume: number = 0.2) {
  try {
    const ac = getCtx();
    const bufferSize = ac.sampleRate * duration;
    const buffer = ac.createBuffer(1, bufferSize, ac.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) data[i] = Math.random() * 2 - 1;
    const source = ac.createBufferSource();
    source.buffer = buffer;
    const gain = ac.createGain();
    source.connect(gain);
    gain.connect(ac.destination);
    gain.gain.setValueAtTime(volume, ac.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ac.currentTime + duration);
    source.start(ac.currentTime);
  } catch (_) {}
}

export const SoundManager = {
  /** Eat food — quick upward blip */
  eatFood() {
    beep(440, 0.06, 0.15, "square");
    setTimeout(() => beep(660, 0.06, 0.1, "square"), 50);
  },

  /** Pick up power-up — rising arpeggio */
  pickupPowerup() {
    beep(330, 0.08, 0.2, "square");
    setTimeout(() => beep(440, 0.08, 0.2, "square"), 70);
    setTimeout(() => beep(550, 0.08, 0.2, "square"), 140);
    setTimeout(() => beep(880, 0.15, 0.25, "square"), 210);
  },

  /** Shockwave launch — deep boom + noise */
  shockwave() {
    sweep(200, 60, 0.4, 0.3, "sawtooth");
    noise(0.3, 0.15);
  },

  /** Hit received (shockwave hit) — short harsh buzz */
  hitReceived() {
    sweep(300, 100, 0.15, 0.25, "sawtooth");
    noise(0.1, 0.1);
  },

  /** Snake dies — descending sweep + noise */
  death() {
    sweep(400, 80, 0.5, 0.3, "sawtooth");
    noise(0.4, 0.2);
    setTimeout(() => beep(80, 0.4, 0.2, "sine", true), 100);
  },

  /** Win — cheerful arpeggio */
  victory() {
    const notes = [523, 659, 784, 1047];
    notes.forEach((f, i) => setTimeout(() => beep(f, 0.15, 0.2, "square"), i * 120));
    setTimeout(() => beep(1047, 0.4, 0.25, "square"), notes.length * 120);
  },

  /** Countdown beep (3, 2, 1) */
  countdownTick() {
    beep(440, 0.1, 0.2, "square", false);
  },

  /** GO! beep */
  countdownGo() {
    beep(880, 0.08, 0.25, "square");
    setTimeout(() => beep(1100, 0.2, 0.25, "square"), 60);
  },

  /** Rival disconnected */
  disconnect() {
    sweep(440, 220, 0.3, 0.2, "sine");
  },

  /** SOLO button — clean single blip (sine) */
  clickSolo() {
    beep(520, 0.08, 0.18, "sine", true);
  },

  /** PVB button — two-tone robotic click */
  clickBot() {
    beep(300, 0.06, 0.15, "square", true);
    setTimeout(() => beep(420, 0.07, 0.15, "square", true), 60);
  },

  /** Weekly PVP button — punchy red alert */
  clickPvp() {
    beep(180, 0.05, 0.2, "sawtooth", true);
    setTimeout(() => beep(360, 0.1, 0.2, "square", true), 50);
  },

  /** Leaderboard button — rising soft chime */
  clickLeaderboard() {
    beep(660, 0.07, 0.15, "sine", true);
    setTimeout(() => beep(880, 0.1, 0.18, "sine", true), 70);
  },

  /** Generic back / cancel button */
  clickBack() {
    sweep(400, 250, 0.1, 0.15, "sine");
  },

  /** Generic confirm / start / join */
  clickConfirm() {
    beep(520, 0.06, 0.15, "sine", true);
    setTimeout(() => beep(780, 0.1, 0.2, "sine", true), 60);
  },
};
