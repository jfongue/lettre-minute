/**
 * The game's sound: every cue is synthesised on the spot with Web Audio, so
 * there is no file to license and nothing added to the bundle. Everything is
 * tuned to one scale (C major pentatonic): cues that follow each other fast,
 * a burst of found words, turn into a tune instead of clashing.
 *
 * Like `cloud.ts` and `native.ts`, nothing here may throw into the game: a
 * browser without Web Audio, or a context the system refuses, costs a sound,
 * never a run.
 */

import type { PowerId } from '../domain/powers'
import type { RarityTier } from '../domain/rarity'
import { onAppActive } from './native'

/** Each channel's volume, from 0 (off) to 1. */
export interface SoundPrefs {
  /** Scales every channel below: one slider to turn the whole game down. */
  master: number
  effects: number
  /** The keyboard clicks, which some players want quieter than the rest. */
  keys: number
  /** The loop under the home, menu and end screens, and the pulse under the run. */
  music: number
  /** The web's quick mute: silences everything, and leaves the choices above as they were. */
  muted: boolean
}

export type MusicMode = 'menu' | 'pulse' | null
export type SoundTier = 0 | 1 | 2 | 3
type Out = AudioNode

const TONIC = 261.63
const SCALE = [0, 2, 4, 7, 9]
const THIRD = 4
/** The note climbs with each word of a prompt, up to this step, then holds. */
const TOP_STEP = 10
const ROOM = 0.28
/** The Silence filter, open and closed. */
const OPEN_HZ = 20000
const HUSHED_HZ = 480

let prefs: SoundPrefs = { master: 1, effects: 0.8, keys: 0.6, music: 0, muted: false }
let ctx: AudioContext | null = null
let masterNode: GainNode
let sfx: GainNode
let keysNode: GainNode
let music: GainNode
let duckNode: GainNode
let hushNode: BiquadFilterNode
let noise: AudioBuffer

function deg(step: number, octave = 0): number {
  const n = SCALE.length
  const i = ((step % n) + n) % n
  return TONIC * 2 ** (octave + Math.floor(step / n) + SCALE[i] / 12)
}
const semi = (f: number, n: number) => f * 2 ** (n / 12)
const triad = (f: number, third = THIRD) => [f, semi(f, third), semi(f, 7)]

function safely(work: () => void): void {
  try {
    work()
  } catch {
    /* no sound this time */
  }
}

function context(): AudioContext | null {
  if (ctx) return ctx
  const Ctor =
    window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
  if (!Ctor) return null
  const c = new Ctor()
  const comp = c.createDynamicsCompressor()
  comp.threshold.value = -12
  comp.ratio.value = 3
  const master = c.createGain()
  masterNode = master
  // Wide open, until Silence closes it: everything the game plays goes through.
  hushNode = c.createBiquadFilter()
  hushNode.type = 'lowpass'
  hushNode.frequency.value = OPEN_HZ
  hushNode.Q.value = 0.9
  master.connect(hushNode)
  hushNode.connect(comp)
  comp.connect(c.destination)

  const length = c.sampleRate * 2.4
  const impulse = c.createBuffer(2, length, c.sampleRate)
  for (let channel = 0; channel < 2; channel++) {
    const data = impulse.getChannelData(channel)
    for (let i = 0; i < length; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / length) ** 3.2
  }
  const verb = c.createConvolver()
  verb.buffer = impulse
  const send = c.createGain()
  send.gain.value = ROOM * 0.9
  send.connect(verb)
  verb.connect(master)

  noise = c.createBuffer(1, c.sampleRate * 2, c.sampleRate)
  const data = noise.getChannelData(0)
  for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1

  sfx = c.createGain()
  sfx.connect(master)
  sfx.connect(send)
  keysNode = c.createGain()
  keysNode.connect(master)
  music = c.createGain()
  duckNode = c.createGain()
  music.connect(duckNode)
  duckNode.connect(master)
  duckNode.connect(send)
  ctx = c
  applyLevels()
  return c
}

/** The loudest a channel gets: the effects sit above the music, the keys well under both. */
const CEILING = { effects: 0.9, keys: 0.9, music: 0.6 }

function applyLevels(): void {
  if (!ctx) return
  const on = prefs.muted ? 0 : 1
  const t = ctx.currentTime
  masterNode.gain.setTargetAtTime(on * prefs.master * 0.9, t, 0.03)
  sfx.gain.setTargetAtTime(on * prefs.effects * CEILING.effects, t, 0.03)
  keysNode.gain.setTargetAtTime(on * prefs.keys * CEILING.keys, t, 0.03)
  music.gain.setTargetAtTime(on * prefs.music * CEILING.music, t, 0.03)
}

/** The context, awake, or null: a cue asked for before the first touch is simply dropped. */
function live(): AudioContext | null {
  const c = ctx
  if (!c || c.state !== 'running') return null
  return c
}

function env(param: AudioParam, t: number, attack: number, peak: number, dur: number): void {
  param.setValueAtTime(0.0001, t)
  param.exponentialRampToValueAtTime(Math.max(peak, 0.0002), t + attack)
  param.exponentialRampToValueAtTime(0.0001, t + attack + dur)
}

function tone(c: AudioContext, type: OscillatorType, f: number, t: number, dur: number, out: Out, peak: number, attack = 0.002, glideTo?: number): void {
  const osc = c.createOscillator()
  const gain = c.createGain()
  osc.type = type
  osc.frequency.setValueAtTime(f, t)
  if (glideTo) osc.frequency.exponentialRampToValueAtTime(glideTo, t + dur)
  env(gain.gain, t, attack, peak, dur)
  osc.connect(gain)
  gain.connect(out)
  osc.start(t)
  osc.stop(t + attack + dur + 0.05)
}

function hiss(c: AudioContext, t: number, dur: number, out: Out, peak: number, type: BiquadFilterType, f: number, q = 1, sweepTo?: number, attack = 0.001): void {
  const source = c.createBufferSource()
  const filter = c.createBiquadFilter()
  const gain = c.createGain()
  source.buffer = noise
  filter.type = type
  filter.Q.value = q
  filter.frequency.setValueAtTime(f, t)
  if (sweepTo) filter.frequency.exponentialRampToValueAtTime(sweepTo, t + dur)
  env(gain.gain, t, attack, peak, dur)
  source.connect(filter)
  filter.connect(gain)
  gain.connect(out)
  source.start(t, Math.random() * 1.5)
  source.stop(t + attack + dur + 0.05)
}

// ---------- Instruments ----------

function marimba(c: AudioContext, f: number, t: number, v: number, out: Out): void {
  tone(c, 'sine', f, t, 0.7, out, 0.45 * v)
  tone(c, 'sine', f * 3.93, t, 0.07, out, 0.1 * v, 0.001)
  hiss(c, t, 0.008, out, 0.05 * v, 'bandpass', Math.min(f * 4, 9000), 2)
}

function wood(c: AudioContext, f: number, t: number, v: number, out: Out): void {
  tone(c, 'sine', f * 2, t, 0.09, out, 0.4 * v, 0.001, f * 1.85)
  tone(c, 'triangle', f * 5.4, t, 0.025, out, 0.08 * v, 0.001)
  hiss(c, t, 0.02, out, 0.18 * v, 'bandpass', Math.min(f * 2, 8000), 8)
}

function glass(c: AudioContext, f: number, t: number, v: number, out: Out): void {
  tone(c, 'sine', f, t, 2.0, out, 0.22 * v, 0.003)
  tone(c, 'sine', f * 2.76, t, 1.1, out, 0.08 * v, 0.003)
  tone(c, 'sine', f * 5.4, t, 0.5, out, 0.035 * v, 0.003)
}

function piano(c: AudioContext, f: number, t: number, v: number, out: Out, dur = 1.6): void {
  const lowpass = c.createBiquadFilter()
  lowpass.type = 'lowpass'
  lowpass.frequency.setValueAtTime(2400, t)
  lowpass.frequency.exponentialRampToValueAtTime(500, t + dur)
  lowpass.connect(out)
  tone(c, 'sine', f, t, dur, lowpass, 0.32 * v, 0.006)
  tone(c, 'sine', f * 2, t, dur * 0.6, lowpass, 0.12 * v, 0.006)
  tone(c, 'triangle', f * 3, t, dur * 0.3, lowpass, 0.04 * v, 0.006)
  hiss(c, t, 0.03, lowpass, 0.05 * v, 'lowpass', 500, 0.7)
}

function glock(c: AudioContext, f: number, t: number, v: number, out: Out): void {
  tone(c, 'sine', f, t, 0.8, out, 0.24 * v, 0.001)
  tone(c, 'sine', f * 2.76, t, 0.14, out, 0.06 * v, 0.001)
}

function bell(c: AudioContext, f: number, t: number, v: number, out: Out, dur = 1.8, ratio = 3.5): void {
  const carrier = c.createOscillator()
  const modulator = c.createOscillator()
  const depth = c.createGain()
  const gain = c.createGain()
  carrier.frequency.value = f
  modulator.frequency.value = f * ratio
  depth.gain.setValueAtTime(f * 2.2, t)
  depth.gain.exponentialRampToValueAtTime(f * 0.04, t + dur * 0.6)
  modulator.connect(depth)
  depth.connect(carrier.frequency)
  env(gain.gain, t, 0.002, 0.2 * v, dur)
  carrier.connect(gain)
  gain.connect(out)
  carrier.start(t)
  modulator.start(t)
  carrier.stop(t + dur + 0.1)
  modulator.stop(t + dur + 0.1)
}

function pizz(c: AudioContext, f: number, t: number, v: number, out: Out): void {
  const lowpass = c.createBiquadFilter()
  lowpass.type = 'lowpass'
  lowpass.Q.value = 3
  lowpass.frequency.setValueAtTime(f * 8, t)
  lowpass.frequency.exponentialRampToValueAtTime(f * 1.5, t + 0.25)
  lowpass.connect(out)
  tone(c, 'sawtooth', f, t, 0.42, lowpass, 0.22 * v, 0.004)
  tone(c, 'sine', f, t, 0.5, out, 0.3 * v, 0.004)
}

/** Effects push the music down for a moment, so a find is never drowned. */
function duck(t: number): void {
  const gain = duckNode.gain
  gain.cancelScheduledValues(t)
  gain.setTargetAtTime(0.35, t, 0.02)
  gain.setTargetAtTime(1, t + 0.3, 0.3)
}

/** A found word's note: the same note at every tier, only richer. */
function wordNote(c: AudioContext, step: number, t: number, tier: SoundTier, v = 1): void {
  const f = deg(Math.min(step, TOP_STEP))
  marimba(c, f, t, 0.85 * v, sfx)
  if (tier >= 1) bell(c, f * 1.5, t + 0.04, 0.55 * v, sfx, 1.4)
  if (tier >= 2) glass(c, f * 2, t + 0.08, 0.45 * v, sfx)
  if (tier >= 3) {
    ;[1, 2, 3, 4].forEach((k, i) =>
      glock(c, f * 2 * 2 ** (SCALE[k % SCALE.length] / 12), t + 0.14 + i * 0.06, (0.5 - i * 0.07) * v, sfx),
    )
  }
  duck(t)
}

function tick(c: AudioContext, t: number, alt: boolean, urgent: boolean, v = 1): void {
  const f = alt ? 2300 : 3100
  hiss(c, t, 0.028, sfx, (urgent ? 0.32 : 0.22) * v, 'bandpass', urgent ? f * 1.15 : f, 7)
  tone(c, 'sine', alt ? 1150 : 1550, t, 0.02, sfx, 0.05 * v)
}

/** Runs a cue now, if effects are on and the context is awake. */
function cue(work: (c: AudioContext, t: number) => void, level = prefs.effects): void {
  if (level <= 0 || prefs.master <= 0 || prefs.muted) return
  safely(() => {
    const c = live()
    if (c) work(c, c.currentTime + 0.01)
  })
}

export type Timbre = 'marimba' | 'wood' | 'glass'

/**
 * Each power's signature: one gesture per power, heard when its card is shown
 * and again whenever it acts in a run, so the ear learns which one just fired.
 */
const SIGNATURES: Record<PowerId, (c: AudioContext, t: number, v: number) => void> = {
  // Two notes trading places.
  permutation(c, t, v) {
    tone(c, 'sine', deg(2), t, 0.3, sfx, 0.22 * v, 0.01, deg(7))
    tone(c, 'sine', deg(7), t, 0.3, sfx, 0.18 * v, 0.01, deg(2))
    wood(c, deg(7), t + 0.3, 0.45 * v, sfx)
    wood(c, deg(2), t + 0.42, 0.4 * v, sfx)
  },
  // A sly chromatic slide, off the scale on purpose, then a wink.
  joker(c, t, v) {
    ;[7, 6, 5].forEach((n, i) => pizz(c, semi(TONIC, n - 12), t + i * 0.11, 0.6 * v, sfx))
    glock(c, deg(7, 1), t + 0.4, 0.55 * v, sfx)
  },
  // A dash of air, rising.
  dodge(c, t, v) {
    hiss(c, t, 0.2, sfx, 0.3 * v, 'bandpass', 900, 2.5, 7000, 0.02)
    tone(c, 'sine', deg(0), t, 0.16, sfx, 0.1 * v, 0.01, deg(9, 1))
  },
  // Sparkles climbing.
  magic(c, t, v) {
    ;[0, 2, 4, 5, 7, 9].forEach((step, i) => glock(c, deg(step, 1), t + i * 0.045, (0.45 - i * 0.03) * v, sfx))
    glass(c, deg(12, 1), t + 0.3, 0.35 * v, sfx)
  },
  // A long breath out, and the floor of the room.
  hush(c, t, v) {
    hiss(c, t, 1.1, sfx, 0.2 * v, 'lowpass', 1400, 0.7, 300, 0.3)
    piano(c, TONIC / 2, t + 0.05, 0.6 * v, sfx, 2.4)
  },
  // One note that cannot settle on its pitch.
  dyslexia(c, t, v) {
    tone(c, 'triangle', deg(5), t, 0.18, sfx, 0.16 * v, 0.004, semi(deg(5), -1.2))
    tone(c, 'triangle', semi(deg(4), 0.6), t + 0.16, 0.22, sfx, 0.14 * v, 0.004, deg(4))
    wood(c, deg(4), t + 0.16, 0.3 * v, sfx)
  },
  // A bell tuned between the notes, far away.
  divination(c, t, v) {
    bell(c, deg(9, 1), t, 0.45 * v, sfx, 2.2, 1.41)
    glass(c, deg(4, 1), t + 0.12, 0.25 * v, sfx)
  },
  // Weight under the note: a low fifth.
  complication(c, t, v) {
    piano(c, TONIC / 2, t, 0.7 * v, sfx, 1.2)
    piano(c, semi(TONIC / 2, 7), t + 0.06, 0.55 * v, sfx, 1.2)
    bell(c, TONIC * 2, t + 0.06, 0.3 * v, sfx, 1, 2)
  },
  // A zip, straight up.
  celerity(c, t, v) {
    tone(c, 'sine', 420, t, 0.12, sfx, 0.16 * v, 0.003, 2600)
    glock(c, deg(9, 1), t + 0.1, 0.45 * v, sfx)
  },
  // A throat cleared on the piano, then the answer whispered.
  professor(c, t, v) {
    piano(c, deg(4), t, 0.55 * v, sfx, 0.5)
    piano(c, deg(2), t + 0.16, 0.5 * v, sfx, 0.7)
    hiss(c, t + 0.34, 0.5, sfx, 0.12 * v, 'bandpass', 3200, 1.2, 1800, 0.12)
    glass(c, deg(7, 1), t + 0.4, 0.25 * v, sfx)
  },
  // Three quick notes, like the three dots that cast it.
  chatter(c, t, v) {
    piano(c, deg(4), t, 0.45 * v, sfx, 0.25)
    piano(c, deg(5), t + 0.09, 0.45 * v, sfx, 0.25)
    piano(c, deg(7), t + 0.18, 0.5 * v, sfx, 0.4)
  },
}

export const sound = {
  key(deleting = false): void {
    cue((c, t) => {
      const v = deleting ? 0.6 : 1
      hiss(c, t, 0.016 + Math.random() * 0.012, keysNode, 0.14 * v, 'bandpass', 2400 + Math.random() * 2000, 1.3)
      tone(c, 'sine', 1500 + Math.random() * 500, t, 0.012, keysNode, 0.025 * v)
    }, prefs.keys)
  },
  /** The field names the word: it says nothing the screen does not already say. */
  recognized(): void {
    cue((c, t) => wood(c, deg(7), t, 0.55, sfx))
  },
  oneLetterOff(): void {
    cue((c, t) => {
      wood(c, deg(5), t, 0.42, sfx)
      wood(c, deg(4), t + 0.13, 0.32, sfx)
    })
  },
  refused(): void {
    cue((c, t) => {
      tone(c, 'sine', 150, t, 0.2, sfx, 0.55, 0.003, 55)
      hiss(c, t, 0.07, sfx, 0.25, 'lowpass', 400, 0.8)
    })
  },
  skipped(): void {
    cue((c, t) => {
      tone(c, 'triangle', deg(7), t, 0.38, sfx, 0.12, 0.01, deg(0, -1))
      hiss(c, t, 0.4, sfx, 0.22, 'bandpass', 5000, 1.4, 700, 0.04)
    })
  },
  /** `step` is the word's place in the current prompt, from 0: the note climbs with it. */
  found(tier: SoundTier, step: number): void {
    cue((c, t) => wordNote(c, step, t, tier))
  },
  /** One note for a dealt category, in the timbre of its shape, `delay` seconds from now. */
  tile(timbre: Timbre, step: number, delay = 0): void {
    cue((c, t) => {
      const f = deg(step)
      if (timbre === 'wood') wood(c, f, t + delay, 0.6, sfx)
      else if (timbre === 'glass') glass(c, f, t + delay, 0.45, sfx)
      else marimba(c, f, t + delay, 0.6, sfx)
    })
  },
  beat(): void {
    cue((c, t) => wood(c, deg(3), t, 0.75, sfx))
  },
  go(): void {
    cue((c, t) => {
      triad(TONIC).forEach((f, i) => marimba(c, f, t + i * 0.012, 0.7, sfx))
      piano(c, TONIC / 2, t, 0.8, sfx)
      glock(c, deg(5), t + 0.02, 0.6, sfx)
      duck(t)
    })
  },
  /** The last seconds: a clock that doubles its tick over the final three. */
  tick(secondsLeft: number): void {
    cue((c, t) => {
      const urgent = secondsLeft <= 3
      tick(c, t, secondsLeft % 2 === 0, urgent)
      if (urgent) tick(c, t + 0.5, secondsLeft % 2 !== 0, true, 0.6)
    })
  },
  timeUp(): void {
    cue((c, t) => {
      bell(c, TONIC * 8, t, 1.2, sfx, 2.8, 1.41)
      glass(c, TONIC * 4, t + 0.005, 0.5, sfx)
      duck(t)
    })
  },
  /** The end screen replays each find, lighter than when it was played. */
  recap(tier: SoundTier, step: number): void {
    cue((c, t) => wordNote(c, step, t, tier, 0.75))
  },
  /** An arpeggio that follows the XP counter's ease-out, note for note. */
  xp(durationS: number, delayS: number): void {
    cue((c, t) => {
      const notes = 16
      for (let i = 0; i < notes; i++) {
        // The counter eases out as 1 - (1 - x)³: each note lands where it passes i/notes.
        const x = 1 - (1 - i / notes) ** (1 / 3)
        glock(c, deg(i), t + delayS + x * durationS, 0.5, sfx)
      }
      glass(c, deg(notes), t + delayS + durationS + 0.05, 0.55, sfx)
    })
  },
  levelUp(): void {
    cue((c, t) => {
      const hit = (f: number, at: number, v: number) => {
        triad(f).forEach((n) => marimba(c, n, at, v, sfx))
        glock(c, f * 2, at, v * 0.6, sfx)
      }
      hit(TONIC, t, 0.55)
      hit(TONIC, t + 0.14, 0.5)
      hit(semi(TONIC, 2), t + 0.28, 0.55)
      hit(semi(TONIC, 7), t + 0.56, 0.75)
      bell(c, semi(TONIC, 7) * 4, t + 0.56, 0.6, sfx, 2.4)
      piano(c, semi(TONIC, 7) / 2, t + 0.56, 0.8, sfx, 2.2)
      duck(t)
    })
  },
  /** The reveal counter passes the old record: a quick rising run, then a bell. */
  record(): void {
    cue((c, t) => {
      ;[0, 2, 4, 7].forEach((step, i) => glock(c, deg(step, 1), t + i * 0.06, 0.5, sfx))
      bell(c, deg(7, 2), t + 0.26, 0.55, sfx, 1.6)
      glass(c, deg(9, 1), t + 0.26, 0.4, sfx)
    })
  },
  /** A power's signature; `v` below 1 for the quiet reminders of a power always on. */
  power(id: PowerId, v = 1): void {
    cue((c, t) => {
      SIGNATURES[id](c, t, v)
      duck(t)
    })
  },
  /** Silence lets go: the room opens back up on a rising glass. */
  unhush(): void {
    cue((c, t) => {
      glass(c, deg(4), t + 0.2, 0.3, sfx)
      glass(c, deg(9), t + 0.35, 0.25, sfx)
    })
  },
  click(): void {
    cue((c, t) => {
      hiss(c, t, 0.012, sfx, 0.12, 'highpass', 4000, 0.7)
      tone(c, 'sine', 1400, t, 0.02, sfx, 0.035)
    })
  },
}

// ---------- Music ----------

/** Root and third of each chord, two bars each: I – vi – IV – V. */
const PROGRESSION: readonly (readonly [number, number])[] = [[0, 4], [-3, 3], [-7, 4], [-5, 4]]
const OSTINATO = [0, 2, 4, 2, 5, 4, 2, 4, 0, 2, 4, 2, 6, 4, 3, 4]
const MENU_STEP_S = 60 / 92 / 2
const PULSE_STEP_S = 60 / 120 / 4
const LOOKAHEAD_S = 0.15

let wanted: MusicMode = null
let playing: MusicMode = null
let bus: GainNode | null = null
let timer: ReturnType<typeof setInterval> | null = null
let step = 0
let next = 0
let pulseStage = 0

function menuStep(c: AudioContext, n: number, t: number, out: Out): void {
  const bar = Math.floor(n / 8)
  const inBar = n % 8
  const [root, third] = PROGRESSION[Math.floor(bar / 2) % PROGRESSION.length]
  const bass = semi(TONIC, root - 24)
  if (inBar === 0) pizz(c, bass, t, 0.8, out)
  if (inBar === 3) pizz(c, semi(bass, 7), t, 0.5, out)
  if (inBar === 6) pizz(c, bass * 2, t, 0.4, out)
  if (Math.random() > 0.12) marimba(c, deg(OSTINATO[n % 16]), t, inBar % 2 ? 0.26 : 0.36, out)
  // A second voice, an octave up and three steps behind, drifts in every other phrase.
  if (bar % 8 >= 4) marimba(c, deg(OSTINATO[(n + 3) % 16], 1), t, 0.14, out)
  if (n % 16 === 0) triad(semi(TONIC, root), third).forEach((f, i) => piano(c, f, t + i * 0.025, 0.28, out, 2.4))
  if (n % 32 === 12) piano(c, deg(7), t, 0.22, out)
}

function pulseStep(c: AudioContext, n: number, t: number, out: Out): void {
  const quarter = n % 4
  const bass = semi(TONIC, [0, 0, -5, -3][Math.floor(n / 16) % 4] - 24)
  if (quarter === 0) pizz(c, bass, t, 0.7, out)
  if (pulseStage >= 1) {
    if (n % 8 === 7) pizz(c, bass, t, 0.4, out)
    if (quarter === 2) hiss(c, t, 0.04, out, 0.12, 'highpass', 6500, 0.8)
  }
  if (pulseStage >= 2) {
    if (quarter !== 2) hiss(c, t, 0.025, out, quarter === 0 ? 0.07 : 0.04, 'highpass', 7500, 0.8)
    if (quarter === 0) wood(c, deg(7), t, 0.18, out)
    if (n % 8 === 6) pizz(c, bass * 2, t, 0.35, out)
  }
}

function pump(): void {
  safely(() => {
    const c = live()
    if (!c || !bus || !playing) return
    const stepS = playing === 'menu' ? MENU_STEP_S : PULSE_STEP_S
    // After a stall (a hidden tab throttles timers), start again from now
    // rather than firing every missed step at once.
    if (next < c.currentTime) next = c.currentTime + 0.05
    while (next < c.currentTime + LOOKAHEAD_S) {
      ;(playing === 'menu' ? menuStep : pulseStep)(c, step, next, bus)
      step++
      next += stepS
    }
  })
}

function stopPlaying(): void {
  if (timer) clearInterval(timer)
  timer = null
  const old = bus
  bus = null
  playing = null
  if (old && ctx) {
    old.gain.setTargetAtTime(0, ctx.currentTime, 0.12)
    setTimeout(() => safely(() => old.disconnect()), 1200)
  }
}

/** Plays what is wanted, if the preferences allow it and the context is awake. */
function syncMusic(): void {
  safely(() => {
    const target = prefs.muted || prefs.master <= 0 || !inForeground()
      ? null
      : wanted === 'menu' && prefs.music > 0
        ? 'menu'
        : wanted === 'pulse' && prefs.music > 0
          ? 'pulse'
          : null
    if (target === playing) return applyLevels()
    stopPlaying()
    const c = live()
    if (!target || !c) return
    playing = target
    applyLevels()
    step = 0
    next = c.currentTime + 0.1
    bus = c.createGain()
    bus.connect(music)
    timer = setInterval(pump, 25)
  })
}

export function setMusic(mode: MusicMode): void {
  wanted = mode
  syncMusic()
}

/** Silence muffles everything the game plays, music included, until it lets go. */
export function setHush(on: boolean): void {
  safely(() => {
    if (!ctx) return
    hushNode.frequency.setTargetAtTime(on ? HUSHED_HZ : OPEN_HZ, ctx.currentTime, on ? 0.25 : 0.5)
  })
}

/** 0, 1 or 2: the pulse thickens as the run's clock runs down. */
export function setPulseStage(stage: number): void {
  pulseStage = stage
}

export function configureSound(next: SoundPrefs): void {
  prefs = next
  applyLevels()
  syncMusic()
}

let armed = false
// Each reason the game is out of sight; the music plays only when none holds.
const away = { hidden: false, blurred: false, native: false }

function inForeground(): boolean {
  return !away.hidden && !away.blurred && !away.native
}

function setAway(reason: keyof typeof away, on: boolean): void {
  if (away[reason] === on) return
  away[reason] = on
  safely(() => {
    if (!ctx) return
    if (!inForeground()) {
      stopPlaying()
      ctx.suspend().catch(() => {})
    } else {
      ctx.resume().then(syncMusic, () => {})
    }
  })
}

/**
 * Browsers only let sound start from a gesture: the context is created, or
 * woken, on the first touch or key. The music waits for it, and stops
 * whenever the game is not in front: hidden tab, another window, the app in
 * the background or an ad over it.
 */
export function armSound(): void {
  if (armed || typeof window === 'undefined') return
  armed = true
  away.hidden = document.hidden
  const wake = () => {
    // A touch or a key means the game is in front, whatever blur said.
    away.blurred = false
    safely(() => {
      if (!inForeground()) return
      const c = context()
      if (!c) return
      if (c.state === 'running') syncMusic()
      else c.resume().then(syncMusic, () => {})
    })
  }
  window.addEventListener('pointerdown', wake, true)
  window.addEventListener('keydown', wake, true)
  document.addEventListener('visibilitychange', () => setAway('hidden', document.hidden))
  window.addEventListener('pagehide', () => setAway('hidden', true))
  window.addEventListener('pageshow', () => setAway('hidden', document.hidden))
  window.addEventListener('blur', () => setAway('blurred', true))
  window.addEventListener('focus', () => setAway('blurred', false))
  onAppActive((active) => setAway('native', !active))
}

export function tierSound(tier: RarityTier, approximate: boolean): SoundTier {
  // A corrected answer is paid at the base rate: it sounds like one too.
  if (approximate) return 0
  return tier === 'peu commun' ? 1 : tier === 'rare' ? 2 : tier === 'très rare' ? 3 : 0
}
