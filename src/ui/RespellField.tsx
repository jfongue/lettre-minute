import type { InputHTMLAttributes } from 'react'
import { initialOf } from '../domain/text'
import { useT } from '../i18n'

interface RespellFieldProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange'> {
  value: string
  onChange(value: string): void
  /** The word as it was proposed: its letter is the one it was proposed for. */
  original: string
}

/**
 * A word was proposed for a letter: a respelling may change every character
 * but must stay on it. Only the letter is judged — accents and case are free.
 */
export function respellValid(draft: string, original: string): boolean {
  return draft.trim() !== '' && initialOf(draft) === initialOf(original)
}

export function RespellField({ value, onChange, original, className, ...input }: RespellFieldProps) {
  const t = useT()
  const moved = value.trim() !== '' && !respellValid(value, original)
  return (
    <span className={`respell-field${className ? ` ${className}` : ''}`}>
      <input {...input} value={value} aria-invalid={moved} onChange={(event) => onChange(event.target.value)} />
      {moved && <span className="note note--warn">{t.requests.sameLetter(initialOf(original))}</span>}
    </span>
  )
}
