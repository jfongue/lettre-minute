import { isNativeApp } from '../lib/native'
import type { SoundPrefs } from '../lib/sound'

const SOUND_KEY = 'lettre-minute.sound.v1'
// The pulse had its own slider until it joined the music: a stored `pulse` is ignored.
const CHANNELS = ['master', 'effects', 'keys', 'music'] as const
const ON_VOLUME = 0.6

/** On a phone the music starts off: the game is often played where others can hear. */
function defaults(): SoundPrefs {
  return { master: 1, effects: 0.8, keys: ON_VOLUME, music: isNativeApp() ? 0 : ON_VOLUME, muted: false }
}

export function loadSoundPrefs(): SoundPrefs {
  const prefs = defaults()
  try {
    const stored: unknown = JSON.parse(localStorage.getItem(SOUND_KEY) ?? 'null')
    if (!stored || typeof stored !== 'object') return prefs
    const saved = stored as Record<string, unknown>
    for (const channel of CHANNELS) {
      const value = saved[channel]
      if (typeof value === 'number' && value >= 0 && value <= 1) prefs[channel] = value
      // The first release stored switches: off stays off, on keeps the default volume.
      else if (value === false) prefs[channel] = 0
      else if (value === true && prefs[channel] === 0) prefs[channel] = ON_VOLUME
    }
    if (typeof saved.muted === 'boolean') prefs.muted = saved.muted
    return prefs
  } catch {
    return prefs
  }
}

export function saveSoundPrefs(prefs: SoundPrefs): void {
  try {
    localStorage.setItem(SOUND_KEY, JSON.stringify(prefs))
  } catch {
    /* the choice lasts until the app closes */
  }
}
