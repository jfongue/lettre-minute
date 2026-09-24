import type { PointerEvent } from 'react'
import { useT } from '../i18n'

// Mid-run, a tap here must not take the focus from the answer field.
const keepFocus = (event: PointerEvent) => event.preventDefault()

/** The web's quick mute, in the corner of the window. The phone has its own volume keys. */
export function MuteButton({ muted, onToggle }: { muted: boolean; onToggle(): void }) {
  const t = useT()
  const label = muted ? t.options.unmute : t.options.mute
  return (
    <button
      type="button"
      className={`mute${muted ? ' mute--on' : ''}`}
      aria-pressed={muted}
      aria-label={label}
      title={label}
      onPointerDown={keepFocus}
      onClick={onToggle}
    >
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M3 9h4l5-4v14l-5-4H3z" />
        {muted ? (
          <path className="mute-stroke" d="M16 9l5 6M21 9l-5 6" />
        ) : (
          <path className="mute-stroke" d="M15.5 8.5a5 5 0 0 1 0 7M18 6a8.5 8.5 0 0 1 0 12" />
        )}
      </svg>
    </button>
  )
}
