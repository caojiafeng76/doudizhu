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

/**
 * Procedural background music — a gentle Chinese pentatonic loop.
 * Generated entirely with the Web Audio API; no external files needed.
 * Melody + bass over a I–vi–ii–V progression in C major pentatonic,
 * matching the "深夜牌馆" parlor aesthetic.
 */
class BackgroundMusicController {
  private masterGain: GainNode | null = null
  private timer: number | null = null
  private step = 0
  private variation = 0
  private playing = false

  // C major pentatonic across two octaves (Hz)
  private readonly scale = [
    261.63, 293.66, 329.63, 392.0, 440.0, // C4 D4 E4 G4 A4
    523.25, 587.33, 659.25, 783.99, 880.0, // C5 D5 E5 G5 A5
  ]
  // Bass roots per bar: I(C) vi(A) ii(D) V(G)
  private readonly bass = [130.81, 110.0, 146.83, 196.0]
  // Melody patterns (scale indices, -1 = rest). Two variations alternate
  // so the loop breathes instead of feeling mechanical.
  private readonly patterns: number[][] = [
    [5, 4, 3, 4, 7, 5, 4, 2, 4, 5, 7, 6, 5, 3, 2, -1],
    [5, 7, 9, 7, 7, 5, 4, 3, 6, 7, 6, 5, 4, 3, 2, -1],
  ]

  start() {
    if (this.playing) return
    try {
      const ctx = getCtx()
      if (ctx.state === 'suspended') void ctx.resume()
      this.masterGain = ctx.createGain()
      this.masterGain.gain.setValueAtTime(0.0001, ctx.currentTime)
      // gentle fade-in so the loop never cuts in abruptly
      this.masterGain.gain.exponentialRampToValueAtTime(
        0.05,
        ctx.currentTime + 1.5,
      )
      this.masterGain.connect(ctx.destination)
      this.playing = true
      this.step = 0
      this.variation = 0
      this.tick()
    } catch {
      // Audio not available
    }
  }

  private tick() {
    if (!this.playing) return
    const pattern = this.patterns[this.variation]
    const idx = pattern[this.step]
    if (idx >= 0 && idx < this.scale.length) {
      this.note(this.scale[idx], 0.34, 'triangle', 0.5)
    }
    // bass note on each bar downbeat
    if (this.step % 4 === 0) {
      const bar = Math.floor(this.step / 4) % this.bass.length
      this.note(this.bass[bar], 0.9, 'sine', 0.42)
    }
    this.step += 1
    if (this.step >= pattern.length) {
      this.step = 0
      this.variation = (this.variation + 1) % this.patterns.length
    }
    this.timer = window.setTimeout(() => this.tick(), 330)
  }

  private note(
    freq: number,
    duration: number,
    type: OscillatorType,
    level: number,
  ) {
    if (!this.masterGain) return
    try {
      const ctx = getCtx()
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.type = type
      osc.frequency.setValueAtTime(freq, ctx.currentTime)
      gain.gain.setValueAtTime(0.0001, ctx.currentTime)
      gain.gain.linearRampToValueAtTime(level, ctx.currentTime + 0.02)
      gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + duration)
      osc.connect(gain)
      gain.connect(this.masterGain)
      osc.start(ctx.currentTime)
      osc.stop(ctx.currentTime + duration + 0.05)
    } catch {
      // ignore
    }
  }

  stop() {
    this.playing = false
    if (this.timer !== null) {
      clearTimeout(this.timer)
      this.timer = null
    }
    if (this.masterGain) {
      try {
        const ctx = getCtx()
        const g = this.masterGain
        g.gain.cancelScheduledValues(ctx.currentTime)
        g.gain.setValueAtTime(g.gain.value, ctx.currentTime)
        g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.4)
        window.setTimeout(() => {
          try {
            g.disconnect()
          } catch {
            // ignore
          }
        }, 500)
      } catch {
        // ignore
      }
      this.masterGain = null
    }
  }

  isPlaying() {
    return this.playing
  }
}

export const BackgroundMusic = new BackgroundMusicController()
