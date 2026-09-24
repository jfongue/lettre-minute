import { useState, type FormEvent } from 'react'
import { useT } from '../i18n'

export interface AccountActions {
  /** Each answers null once done, or the sentence to show the player. */
  onRegister(name: string, email: string, password: string): Promise<string | null>
  onLogIn(email: string, password: string): Promise<string | null>
}

interface AccountPanelProps extends AccountActions {
  title: string
  lead: string
}

/** Three fields to register, two to sign in: nothing else stands between a run and the account. */
export function AccountPanel({ title, lead, onRegister, onLogIn }: AccountPanelProps) {
  const t = useT()
  const [mode, setMode] = useState<'register' | 'login'>('register')
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<string | null>(null)

  const send = async (event: FormEvent) => {
    event.preventDefault()
    setBusy(true)
    setMessage(null)
    const answer = mode === 'register' ? await onRegister(name, email, password) : await onLogIn(email, password)
    setBusy(false)
    setMessage(answer)
  }

  return (
    <section className="panel account">
      <p className="section-title">{title}</p>
      <p className="note">{lead}</p>

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
            onClick={() => {
              setMode(id)
              setMessage(null)
            }}
          >
            {label}
          </button>
        ))}
      </div>

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
            required
          />
        </label>
        <label className="field">
          <span>{t.account.password}</span>
          <input
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            autoComplete={mode === 'register' ? 'new-password' : 'current-password'}
            minLength={6}
            required
          />
        </label>
        {message && <p className="note note--warn">{message}</p>}
        <button type="submit" className="btn btn--block" disabled={busy}>
          {busy ? t.wait : mode === 'register' ? t.account.submitRegister : t.account.submitLogIn}
        </button>
      </form>
    </section>
  )
}
