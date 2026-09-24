import { isNativeApp } from '../lib/native'
import type { SoundPrefs } from '../lib/sound'

const SOUND_KEY = 'lettre-minute.sound.v1'

/** On a phone the music starts off: the game is often played where others can hear. */
function defaults(): SoundPrefs {
  return { effects: true, keys: true, music: !isNativeApp(), pulse: false, muted: false }
}

export function loadSoundPrefs(): SoundPrefs {
  const base = defaults()
  try {
    const stored: unknown = JSON.parse(localStorage.getItem(SOUND_KEY) ?? 'null')
    if (!stored || typeof stored !== 'object') return base
    const read = (key: keyof SoundPrefs) => {
      const value = (stored as Record<string, unknown>)[key]
      return typeof value === 'boolean' ? value : base[key]
    }
    return {
      effects: read('effects'),
      keys: read('keys'),
      music: read('music'),
      pulse: read('pulse'),
      muted: read('muted'),
    }
  } catch {
    return base
  }
}

export function saveSoundPrefs(prefs: SoundPrefs): void {
  try {
    localStorage.setItem(SOUND_KEY, JSON.stringify(prefs))
  } catch {
    /* the choice lasts until the app closes */
  }
}
