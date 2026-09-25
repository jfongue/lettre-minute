import type { InputHTMLAttributes } from 'react'

interface InitialLockedProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange'> {
  value: string
  onChange(value: string): void
}

/**
 * A respelling field whose first letter stays put: a word was proposed for a
 * letter, and fixing its spelling must not move it to another one.
 */
export function InitialLocked({ value, onChange, className, ...input }: InitialLockedProps) {
  const [first = '', ...rest] = Array.from(value)
  return (
    <span className={`initial-locked${className ? ` ${className}` : ''}`}>
      <span className="initial-locked-letter" aria-hidden="true">
        {first}
      </span>
      <input {...input} value={rest.join('')} onChange={(event) => onChange(first + event.target.value)} />
    </span>
  )
}
