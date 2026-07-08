/**
 * Web Audio API sound effects for Dou Di Zhu
 * All sounds are generated programmatically — no external files needed.
 */

let audioCtx: AudioContext | null = null

function getCtx(): AudioContext {
  if (!audioCtx) {
    audioCtx = new AudioContext()
  }
  return audioCtx
}

function playTone(freq: number, duration: number, type: OscillatorType = 'sine', volume = 0.15) {
  try {
    const ctx = getCtx()
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.type = type
    osc.frequency.setValueAtTime(freq, ctx.currentTime)
    gain.gain.setValueAtTime(volume, ctx.currentTime)
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration)
    osc.connect(gain)
    gain.connect(ctx.destination)
    osc.start(ctx.currentTime)
    osc.stop(ctx.currentTime + duration)
  } catch {
    // Audio not available
  }
}

function playNoise(duration: number, volume = 0.08) {
  try {
    const ctx = getCtx()
    const bufferSize = ctx.sampleRate * duration
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate)
    const data = buffer.getChannelData(0)
    for (let i = 0; i < bufferSize; i++) {
      data[i] = (Math.random() * 2 - 1) * 0.5
    }
    const source = ctx.createBufferSource()
    source.buffer = buffer
    const gain = ctx.createGain()
    gain.gain.setValueAtTime(volume, ctx.currentTime)
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration)
    const filter = ctx.createBiquadFilter()
    filter.type = 'highpass'
    filter.frequency.setValueAtTime(2000, ctx.currentTime)
    source.connect(filter)
    filter.connect(gain)
    gain.connect(ctx.destination)
    source.start(ctx.currentTime)
  } catch {
    // Audio not available
  }
}

export const SoundEffects = {
  /** Card click / selection */
  select() {
    playTone(800, 0.08, 'square', 0.06)
  },

  /** Card deselect */
  deselect() {
    playTone(500, 0.06, 'square', 0.05)
  },

  /** Deal card — soft thwip */
  deal() {
    playTone(300, 0.05, 'triangle', 0.1)
  },

  /** Play a card — sharp snap */
  playCard() {
    playNoise(0.06, 0.1)
    playTone(600, 0.08, 'square', 0.08)
  },

  /** Pass — low tone */
  pass() {
    playTone(220, 0.2, 'sine', 0.1)
  },

  /** Invalid play — error buzz */
  invalid() {
    playTone(150, 0.3, 'sawtooth', 0.12)
  },

  /** Bid — escalating tone */
  bid() {
    playTone(440, 0.1, 'sine', 0.12)
    setTimeout(() => playTone(660, 0.12, 'sine', 0.12), 100)
  },

  /** Win — triumphant chime */
  win() {
    const notes = [523, 659, 784, 1047]
    notes.forEach((freq, i) => {
      setTimeout(() => playTone(freq, 0.3, 'sine', 0.15), i * 150)
    })
  },

  /** Lose — descending tone */
  lose() {
    const notes = [440, 349, 294, 220]
    notes.forEach((freq, i) => {
      setTimeout(() => playTone(freq, 0.35, 'sine', 0.12), i * 200)
    })
  },

  /** Bomb / rocket — dramatic boom */
  bomb() {
    playTone(120, 0.4, 'sawtooth', 0.18)
    setTimeout(() => playTone(80, 0.5, 'sawtooth', 0.12), 100)
  },

  /** Game start — shuffle sound */
  shuffle() {
    for (let i = 0; i < 6; i++) {
      setTimeout(() => playNoise(0.03, 0.06 + Math.random() * 0.04), i * 50)
    }
  },

  /** Button click */
  click() {
    playTone(1000, 0.04, 'square', 0.05)
  },
}
