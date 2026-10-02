// Renders the game's own sound module offline, on a clock the score drives.
import { armSound, configureSound, setMusic, setPulseStage, sound, type Timbre } from '../../../src/lib/sound'
import { categoryMotif } from '../../../src/ui/motifs'

const RATE = 48000
const LENGTH = 30.5
type Cue = [number, string, ...unknown[]]
declare global { interface Window { __t: number; __ctx: OfflineAudioContext; renderPromo(score: Cue[]): Promise<string> } }

class DrivenContext extends OfflineAudioContext {
  constructor() {
    super({ numberOfChannels: 2, length: Math.ceil(RATE * LENGTH), sampleRate: RATE })
    window.__ctx = this
  }
  override get currentTime(): number { return window.__t }
  override get state(): AudioContextState { return 'running' }
}
window.__t = 0
// Headless Chrome reports a hidden, unfocused page, for which the game holds its music.
Object.defineProperty(document, 'hidden', { get: () => false })
Object.defineProperty(document, 'visibilityState', { get: () => 'visible' })
for (const type of ['blur', 'pagehide', 'visibilitychange']) window.addEventListener(type, (event) => event.stopImmediatePropagation(), true)
;(window as unknown as { AudioContext: unknown }).AudioContext = DrivenContext
// An offline render plays the graph as it stands at the end: a bus the game
// unplugs once its fade is over would take all its music with it.
AudioNode.prototype.disconnect = function () {} as typeof AudioNode.prototype.disconnect

const timbreOf = (kind: string): Timbre => (kind === 'square' ? 'wood' : kind === 'triangle' ? 'glass' : 'marimba')
const sleep = (ms: number) => new Promise((done) => setTimeout(done, ms))

function play([, name, ...args]: Cue): void {
  const a = args as never[]
  if (name === 'music') return setMusic(a[0])
  if (name === 'stage') return setPulseStage(a[0])
  if (name === 'category') return sound.tile(timbreOf(categoryMotif(a[0]).kind), a[1], a[2])
  ;(sound as unknown as Record<string, (...x: unknown[]) => void>)[name](...a)
}

window.renderPromo = async (score) => {
  configureSound({ master: 1, effects: 0.8, keys: 0.6, music: 0.6, muted: false })
  armSound()
  window.dispatchEvent(new Event('pointerdown'))
  const cues = [...score].sort((a, b) => a[0] - b[0])
  let next = 0
  for (let t = 0; t <= LENGTH - 0.4; t = Math.round((t + 0.02) * 1000) / 1000) {
    window.__t = t
    while (next < cues.length && cues[next][0] <= t) play(cues[next++])
    await sleep(6)
  }
  setMusic(null)
  return wav(await window.__ctx.startRendering())
}

function wav(buffer: AudioBuffer): string {
  const [l, r] = [buffer.getChannelData(0), buffer.getChannelData(1)]
  const view = new DataView(new ArrayBuffer(44 + buffer.length * 4))
  const text = (at: number, s: string) => [...s].forEach((ch, i) => view.setUint8(at + i, ch.charCodeAt(0)))
  text(0, 'RIFF'); view.setUint32(4, 36 + buffer.length * 4, true); text(8, 'WAVEfmt ')
  view.setUint32(16, 16, true); view.setUint16(20, 1, true); view.setUint16(22, 2, true)
  view.setUint32(24, RATE, true); view.setUint32(28, RATE * 4, true); view.setUint16(32, 4, true); view.setUint16(34, 16, true)
  text(36, 'data'); view.setUint32(40, buffer.length * 4, true)
  for (let i = 0; i < buffer.length; i++) {
    view.setInt16(44 + i * 4, Math.max(-1, Math.min(1, l[i])) * 0x7fff, true)
    view.setInt16(46 + i * 4, Math.max(-1, Math.min(1, r[i])) * 0x7fff, true)
  }
  let binary = ''
  const raw = new Uint8Array(view.buffer)
  for (let i = 0; i < raw.length; i += 0x8000) binary += String.fromCharCode(...raw.subarray(i, i + 0x8000))
  return btoa(binary)
}
