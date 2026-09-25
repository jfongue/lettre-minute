import { useState, type FormEvent } from 'react'
import { useT } from '../i18n'
import { googleSignInSupported } from '../lib/native'

export interface AccountActions {
  /** Each answers null once done, or the sentence to show the player. */
  onRegister(name: string, email: string, password: string): Promise<string | null>
  onLogIn(email: string, password: string): Promise<string | null>
  /** Also null when the player closed the Google picker. */
  onGoogle(): Promise<string | null>
  onRequestReset(email: string): Promise<string | null>
  onResetPassword(email: string, code: string, password: string): Promise<string | null>
  onChooseName(name: string): Promise<string | null>
}

interface AccountPanelProps extends AccountActions {
  title: string
  lead: string
  /** Signed in with Google but still unnamed: only the name is left to ask. */
  needsName?: boolean
  /** The tab it opens on: « Se connecter » when that is the button that brought the player here. */
  initialMode?: AccountMode
}

export type AccountMode = 'register' | 'login'
type Mode = AccountMode | 'reset'

/** Three fields to register, two to sign in: nothing else stands between a run and the account. */
export function AccountPanel({ title, lead, needsName = false, initialMode = 'register', ...actions }: AccountPanelProps) {
  const t = useT()
  const [mode, setMode] = useState<Mode>(initialMode)
  // The recovery code is asked for once the mail has gone.
  const [codeSent, setCodeSent] = useState(false)
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [code, setCode] = useState('')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<string | null>(null)

  const run = async (work: () => Promise<string | null>) => {
    setBusy(true)
    setMessage(null)
    const answer = await work()
    setBusy(false)
    setMessage(answer)
    return answer
  }

  const switchTo = (next: Mode) => {
    setMode(next)
    setCodeSent(false)
    setCode('')
    setMessage(null)
  }

  const send = async (event: FormEvent) => {
    event.preventDefault()
    if (needsName) return run(() => actions.onChooseName(name))
    if (mode === 'register') return run(() => actions.onRegister(name, email, password))
    if (mode === 'login') return run(() => actions.onLogIn(email, password))
    if (codeSent) return run(() => actions.onResetPassword(email, code, password))
    const refused = await run(() => actions.onRequestReset(email))
    if (refused === null) {
      setCodeSent(true)
      setPassword('')
    }
  }

  if (needsName) {
    return (
      <section className="panel account">
        <p className="section-title">{title}</p>
        <p className="note">{t.account.nameLead}</p>
        <form className="account-form" onSubmit={send}>
          <label className="field">
            <span>{t.account.name}</span>
            <input value={name} onChange={(event) => setName(event.target.value)} autoComplete="username" maxLength={24} required />
          </label>
          {message && <p className="note note--warn">{message}</p>}
          <button type="submit" className="btn btn--block" disabled={busy}>
            {busy ? t.wait : t.account.submitName}
          </button>
        </form>
      </section>
    )
  }

  const submitLabel =
    mode === 'register'
      ? t.account.submitRegister
      : mode === 'login'
        ? t.account.submitLogIn
        : codeSent
          ? t.account.submitReset
          : t.account.sendCode

  return (
    <section className="panel account">
      <p className="section-title">{title}</p>
      <p className="note">{lead}</p>

      {googleSignInSupported() && mode !== 'reset' && (
        <>
          <button type="button" className="btn btn--block btn--google" disabled={busy} onClick={() => run(actions.onGoogle)}>
            <GoogleMark />
            {t.account.google}
          </button>
          <p className="account-or">{t.account.or}</p>
        </>
      )}

      {mode !== 'reset' && (
        <div className="layer-tabs" role="tablist">
          {(
            [
              ['register', t.account.register],
              ['login', t.account.logIn],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={mode === id}
              className={`layer-tab${mode === id ? ' layer-tab--on' : ''}`}
              onClick={() => switchTo(id)}
            >
              {label}
            </button>
          ))}
        </div>
      )}

      {mode === 'reset' && <p className="note">{codeSent ? t.account.codeSent(email.trim()) : t.account.resetLead}</p>}

      <form className="account-form" onSubmit={send}>
        {mode === 'register' && (
          <label className="field">
            <span>{t.account.name}</span>
            <input
              value={name}
              onChange={(event) => setName(event.target.value)}
              autoComplete="username"
              maxLength={24}
              required
            />
          </label>
        )}
        <label className="field">
          <span>{t.account.email}</span>
          <input
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            autoComplete="email"
            inputMode="email"
            readOnly={codeSent}
            required
          />
        </label>
        {mode === 'reset' && codeSent && (
          <label className="field">
            <span>{t.account.code}</span>
            <input
              value={code}
              onChange={(event) => setCode(event.target.value)}
              autoComplete="one-time-code"
              inputMode="numeric"
              maxLength={12}
              required
            />
          </label>
        )}
        {(mode !== 'reset' || codeSent) && (
          <label className="field">
            <span>{mode === 'reset' ? t.account.newPassword : t.account.password}</span>
            <input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
              minLength={6}
              required
            />
          </label>
        )}
        {message && <p className="note note--warn">{message}</p>}
        <button type="submit" className="btn btn--block" disabled={busy}>
          {busy ? t.wait : submitLabel}
        </button>
        {mode === 'login' && (
          <button type="button" className="btn btn--quiet" onClick={() => switchTo('reset')}>
            {t.account.forgot}
          </button>
        )}
        {mode === 'reset' && (
          <button type="button" className="btn btn--quiet" onClick={() => switchTo('login')}>
            {t.account.backToLogIn}
          </button>
        )}
      </form>
    </section>
  )
}

/** Google's own four-colour mark: its brand rules forbid recolouring it to the theme. */
function GoogleMark() {
  return (
    <svg className="google-mark" viewBox="0 0 48 48" aria-hidden="true">
      <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
      <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
      <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
      <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
    </svg>
  )
}
