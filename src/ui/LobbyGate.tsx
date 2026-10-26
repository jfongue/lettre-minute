import { useT } from '../i18n'
import '../duel.css'

/**
 * Where a link to a duel table lands before the table opens: the table being
 * fetched while the player's account answers, or — for a portal guest, who has
 * no account to sit at an online table with — the way to sign in. The portal
 * reloads the page once they have, and the link's table is still there to open.
 */
export function LobbyGate({ loading = false, onSignIn, onHome }: { loading?: boolean; onSignIn?(): void; onHome(): void }) {
  const t = useT()
  return (
    <main className="stage stage--duel">
      <div className="sheet duel-notice">
        <p className="eyebrow">{t.duel.title}</p>
        {!loading ? (
          <>
            <p className="note">{t.duel.loginLead}</p>
            {onSignIn ? (
              <button type="button" className="btn btn--blue btn--block" data-track="duel-sign-in" onClick={onSignIn}>
                {t.duel.signIn}
              </button>
            ) : null}
            <button type="button" className="btn btn--ghost btn--block" onClick={onHome}>
              {t.duel.loginHome}
            </button>
          </>
        ) : (
          <>
            <p className="note">{t.duel.connecting}</p>
            <span className="duel-notice__dots" aria-hidden="true">
              <i />
              <i />
              <i />
            </span>
          </>
        )}
      </div>
    </main>
  )
}
