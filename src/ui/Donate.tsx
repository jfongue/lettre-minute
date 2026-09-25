import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import photo from '../assets/jeremy.jpg'
import { useT } from '../i18n'
import { DONATION_URL, donationFrameUrl } from '../lib/native'
import { reducedMotion } from './useCountUp'

/** The pace of the typing: fast enough to read along, slow enough to feel written. */
const TYPE_MS = 26

/** Opens the support sheet: a word from the creator, then the donation form or the link to it. */
export function DonateButton({ className, label }: { className: string; label: string }) {
  const [open, setOpen] = useState(false)
  return (
    <>
      <button type="button" className={className} onClick={() => setOpen(true)}>
        {label}
      </button>
      {open && <DonationPop onClose={() => setOpen(false)} />}
    </>
  )
}

function useTyped(text: string): string {
  const [shown, setShown] = useState(() => (reducedMotion() ? text.length : 0))
  useEffect(() => {
    if (shown >= text.length) return
    const timer = setTimeout(() => setShown((count) => count + 1), TYPE_MS)
    return () => clearTimeout(timer)
  }, [shown, text])
  return text.slice(0, shown)
}

function DonationPop({ onClose }: { onClose(): void }) {
  const t = useT()
  // A phone opens the full page in the system browser, where the wallet and saved cards are.
  const frame = donationFrameUrl(t.support.frameDescription)
  const typed = useTyped(t.support.hello)
  const talking = typed.length < t.support.hello.length
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => event.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])
  // Out of its parent: an animated ancestor would pin the layer to itself instead of the window.
  return createPortal(
    <div className="offer-pop-layer" role="dialog" aria-modal="true" aria-label={t.support.donate}>
      <div className="offer-pop-scrim" onClick={onClose} />
      <div className="offer-pop donation-pop">
        <div className="creator">
          <span className={`creator-photo${talking ? ' creator-photo--talking' : ''}`}>
            <img src={photo} alt={t.support.photo} width={96} height={96} />
          </span>
          <p className="creator-bubble" aria-label={t.support.hello}>
            <span aria-hidden="true">
              {typed}
              {talking && <span className="creator-caret" />}
            </span>
          </p>
        </div>
        {frame ? (
          <iframe className="donation-frame" src={frame} title={t.support.donate} allow="payment; publickey-credentials-get *" />
        ) : (
          <a className="btn btn--red btn--block" href={DONATION_URL} target="_blank" rel="noopener noreferrer">
            {t.support.donate}
          </a>
        )}
        <button type="button" className="btn btn--ghost btn--block" onClick={onClose}>
          {t.support.close}
        </button>
      </div>
    </div>,
    document.body,
  )
}
