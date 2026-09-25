import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { useT } from '../i18n'
import { DONATION_URL, donationFrameUrl } from '../lib/native'

/** The donation link: in a browser, the form opens over the page; on a phone, the full page in the system browser. */
export function DonateButton({ className, label }: { className: string; label: string }) {
  const t = useT()
  const frame = donationFrameUrl(t.support.frameDescription)
  const [donating, setDonating] = useState(false)
  return (
    <>
      <a
        className={className}
        href={DONATION_URL}
        target="_blank"
        rel="noopener noreferrer"
        onClick={(event) => {
          if (!frame) return
          event.preventDefault()
          setDonating(true)
        }}
      >
        {label}
      </a>
      {donating && frame && <DonationPop src={frame} onClose={() => setDonating(false)} />}
    </>
  )
}

function DonationPop({ src, onClose }: { src: string; onClose(): void }) {
  const t = useT()
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
        <iframe className="donation-frame" src={src} title={t.support.donate} allow="payment; publickey-credentials-get *" />
        <button type="button" className="btn btn--ghost btn--block" onClick={onClose}>
          {t.support.close}
        </button>
      </div>
    </div>,
    document.body,
  )
}
