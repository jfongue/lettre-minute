import type { Verdict } from '../domain/moderation'

/** The verdicts as glyphs: a tick, a question mark, a cross, and a flag for the special case. */
export function VerdictMark({ verdict }: { verdict: Verdict }) {
  return (
    <svg className="mark-glyph" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round">
      {verdict === 'correct' && <path d="M4.5 12.5l5 5L19.5 7" />}
      {verdict === 'incorrect' && <path d="M6 6l12 12M18 6L6 18" />}
      {verdict === 'unsure' && (
        <>
          <path d="M8.6 8.8a3.6 3.6 0 1 1 5.2 3.2c-1.1.6-1.8 1.4-1.8 2.7v.6" />
          <circle cx="12" cy="19.2" r="0.6" fill="currentColor" />
        </>
      )}
      {verdict === 'special' && <path d="M6 21V4M6 4h11l-2.5 4L17 12H6" />}
    </svg>
  )
}

export function Pencil() {
  return (
    <svg className="mark-glyph" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 20l1-4.5L16.5 4a2.1 2.1 0 0 1 3 3L8 18.5 4 20z" />
    </svg>
  )
}
