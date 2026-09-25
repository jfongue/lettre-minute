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
          <button type="button" className="btn btn--block btn--ghost" disabled={busy} onClick={() => run(actions.onGoogle)}>
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
