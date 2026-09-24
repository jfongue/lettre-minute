import type { CSSProperties } from 'react'
import { LOCALES, type Locale } from '../i18n'
import { Shape } from './bauhaus'

/**
 * Shown once, before anything else, when the device speaks none of the game's
 * languages. Each language is written in itself: the player cannot be expected
 * to read the one the game would have guessed.
 */
export function LanguagePicker({ onPick }: { onPick(locale: Locale): void }) {
  return (
    <div className="sheet cascade language-picker">
      <header className="masthead">
        <h1 className="title">
          <span>Lettre</span>
          <span>Minute</span>
        </h1>
      </header>

      <ul className="language-choices">
        {LOCALES.map((entry, index) => (
          <li key={entry.id} style={{ '--i': index } as CSSProperties}>
            <button type="button" className="btn btn--ghost btn--block" lang={entry.id} onClick={() => onPick(entry.id)}>
              {entry.name}
            </button>
          </li>
        ))}
      </ul>

      <Shape kind="sun" tint="yellow" className="language-sun" />
    </div>
  )
}
