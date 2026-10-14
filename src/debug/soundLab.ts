// Le labo son du serveur de dev (/src/debug/sound-lab.html) : hors build, pour écouter la musique et le bilan.
import { armSound, configureSound, setMusic, setPulseStage, sound, type SoundTier } from '../lib/sound'

armSound()
configureSound({ master: 1, effects: 0.8, keys: 0.6, music: 0.8, muted: false })

const now = document.getElementById('now')!
const say = (text: string) => (now.textContent = text)
let timers: ReturnType<typeof setTimeout>[] = []
const clear = () => {
  timers.forEach(clearTimeout)
  timers = []
}

function button(parent: string, label: string, run: () => void): void {
  const b = document.createElement('button')
  b.textContent = label
  // Le contexte audio s'éveille au pointerdown : on joue au clic, juste après.
  b.addEventListener('click', run)
  document.getElementById(parent)!.append(b)
}

;[
  ['A · thème', 0],
  ['A′ · deuxième voix', 8],
  ['B · variation haute', 16],
  ['C · passage léger', 24],
].forEach(([label, bar]) =>
  button('menu', label as string, () => {
    setMusic('menu', bar as number)
    say(`Menu depuis la mesure ${bar}`)
  }),
)
;[0, 1, 2].forEach((stage) =>
  button('pulse', `Palier ${stage}`, () => {
    setPulseStage(stage)
    setMusic('pulse', 0)
    say(`Pulsation, palier ${stage}`)
  }),
)

// Même cadence que Reveal.tsx : 3,6 s pour la liste, entre 170 et 480 ms par mot.
const TIER_WEIGHT = [1, 1.25, 1.7, 2.4]
function recap(words: number): void {
  clear()
  setMusic(null)
  const step = Math.min(480, Math.max(170, 3600 / words))
  let at = 0
  for (let i = 0; i < words; i++) {
    const tier: SoundTier = i % 11 === 6 ? 2 : i % 7 === 3 ? 1 : i === 25 ? 3 : 0
    timers.push(
      setTimeout(() => {
        sound.recap(tier, i)
        say(`Mot ${i + 1} / ${words}`)
        if (i === words - 1) sound.recapEnd(words, (step * TIER_WEIGHT[tier]) / 1000)
      }, at),
    )
    at += step * TIER_WEIGHT[tier]
  }
}
;[5, 8, 12, 20, 30, 40].forEach((n) => button('recap', `${n} mots`, () => recap(n)))

document.getElementById('stop')!.addEventListener('click', () => {
  clear()
  setMusic(null)
  say('')
})
