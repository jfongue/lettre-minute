import { useEffect, useRef, useState, type FormEvent } from 'react'
import type { AvatarChoice } from '../domain/avatar'
import { levelFor, levelProgress, type Profile } from '../domain/progression'
import {
  fetchFriends,
  removeFriend,
  requestFriend,
  respondFriend,
  type Account,
  type Friend,
} from '../lib/cloud'
import { adPrivacyOptionsRequired, showAdPrivacyOptions } from '../lib/native'
import { formatNumber, LOCALES, useT, type Locale } from '../i18n'
import type { SoundPrefs } from '../lib/sound'
import type { Theme } from '../state/theme'
import { AccountPanel, type AccountActions } from './AccountPanel'
import { Avatar } from './Avatar'

export type MenuPane = 'profile' | 'social' | 'options'

const PANES: readonly MenuPane[] = ['profile', 'social', 'options']

// A published app must link its privacy policy. Inside the phone shell a
// relative link would navigate the game's own view away, hence a full URL.
const PRIVACY_URL = import.meta.env.VITE_PRIVACY_URL || '/confidentialite.html'

interface MenuProps {
  profile: Profile
  avatar: AvatarChoice
  /** Null while the game runs without a server: the player has no account, only an avatar. */
  account: Account | null
  accountActions: AccountActions
  theme: Theme
  onTheme(theme: Theme): void
  locale: Locale
  onLocale(locale: Locale): void
  sound: SoundPrefs
  onSound(sound: SoundPrefs): void
  onAvatar(): void
  onLogOut(): void
  /** Answers false when the server could not erase the account. */
  onErase(): Promise<boolean>
  onClose(): void
}

export function Menu({ onClose, ...props }: MenuProps) {
  const t = useT()
  const [pane, setPane] = useState<MenuPane>('profile')
  const drawer = useRef<HTMLElement>(null)

  useEffect(() => {
    drawer.current?.focus()
    const close = (event: KeyboardEvent) => event.key === 'Escape' && onClose()
    window.addEventListener('keydown', close)
    // The home screen behind must not scroll under the player's thumb.
    const overflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', close)
      document.body.style.overflow = overflow
    }
  }, [onClose])

  return (
    <div className="menu-layer">
      <div className="menu-scrim" onClick={onClose} />
      <aside className="menu" role="dialog" aria-modal="true" aria-label={t.menu.title} tabIndex={-1} ref={drawer}>
        <div className="spread">
          <p className="section-title">{t.menu.title}</p>
          <button type="button" className="btn btn--quiet" onClick={onClose}>
            {t.menu.close}
          </button>
        </div>

        <div className="layer-tabs" role="tablist">
          {PANES.map((id) => (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={pane === id}
              className={`layer-tab${pane === id ? ' layer-tab--on' : ''}`}
              onClick={() => setPane(id)}
            >
              {t.menu.panes[id]}
            </button>
          ))}
        </div>

        <div className="menu-body">
          {pane === 'profile' && <ProfilePane {...props} />}
          {pane === 'social' && <SocialPane account={props.account} onProfile={() => setPane('profile')} />}
          {pane === 'options' && (
            <OptionsPane
              theme={props.theme}
              onTheme={props.onTheme}
              locale={props.locale}
              onLocale={props.onLocale}
              sound={props.sound}
              onSound={props.onSound}
            />
          )}
        </div>
      </aside>
    </div>
  )
}

function ProfilePane({
  profile,
  avatar,
  account,
  accountActions,
  onAvatar,
  onLogOut,
  onErase,
}: Omit<MenuProps, 'onClose' | 'theme' | 'onTheme' | 'locale' | 'onLocale' | 'sound' | 'onSound'>) {
  const t = useT()
  const named = account && !account.anonymous

  return (
    <>
      <section className="player">
        <button type="button" className="player-avatar" onClick={onAvatar} aria-label={t.menu.editAvatarLabel}>
          <Avatar choice={avatar} size="md" />
        </button>
        <div className="player-id">
          <strong>{named ? account.name : t.menu.anonymous}</strong>
          <span className="note">
            {t.menu.standing(levelProgress(profile.xp).level, formatNumber(t, profile.bestScore))}
          </span>
          <button type="button" className="btn btn--quiet" onClick={onAvatar}>
            {t.menu.editAvatar}
          </button>
        </div>
      </section>

      {named && (
        <div className="stack">
          {account.email && <p className="note">{t.menu.signedInAs(account.email)}</p>}
          <button type="button" className="btn btn--quiet btn--muted menu-start" onClick={onLogOut}>
            {t.menu.logOut}
          </button>
        </div>
      )}

      {account?.anonymous && (
        <AccountPanel
          title={t.menu.accountTitle}
          lead={t.menu.accountLead}
          {...accountActions}
        />
      )}

      {!account && <p className="note">{t.menu.offline}</p>}

      <div className="menu-foot">
        <EraseData onErase={onErase} />
      </div>
    </>
  )
}

function SocialPane({ account, onProfile }: { account: Account | null; onProfile(): void }) {
  const t = useT()
  const [friends, setFriends] = useState<Friend[] | null | 'loading'>('loading')
  const [name, setName] = useState('')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const named = account && !account.anonymous

  const refresh = () => fetchFriends().then(setFriends)

  useEffect(() => {
    if (named) refresh()
  }, [named, account?.name])

  if (!account) {
    return <p className="note">{t.social.noServer}</p>
  }

  if (!named) {
    return (
      <div className="stack">
        <p className="note">{t.social.needAccount}</p>
        <button type="button" className="btn btn--block" onClick={onProfile}>
          {t.social.createAccount}
        </button>
      </div>
    )
  }

  const send = async (event: FormEvent) => {
    event.preventDefault()
    const wanted = name.trim()
    if (wanted === '') return
    setBusy(true)
    const outcome = await requestFriend(wanted)
    setBusy(false)
    setMessage(t.social.requests[outcome](wanted))
    if (outcome === 'sent' || outcome === 'accepted') {
      setName('')
      refresh()
    }
  }

  const act = async (work: Promise<boolean>) => {
    if (!(await work)) setMessage(t.social.requests.unreachable(''))
    refresh()
  }

  const list = friends === 'loading' || friends === null ? [] : friends
  const incoming = list.filter((friend) => friend.relation === 'incoming')
  const accepted = list
    .filter((friend) => friend.relation === 'friend')
    .sort((a, b) => b.weekBest - a.weekBest || b.xp - a.xp)
  const outgoing = list.filter((friend) => friend.relation === 'outgoing')

  return (
    <>
      <form className="account-form" onSubmit={send}>
        <label className="field">
          <span>{t.social.add}</span>
          <input
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder={t.social.addPlaceholder}
            autoComplete="off"
            autoCapitalize="off"
            maxLength={24}
          />
        </label>
        {message && <p className="note">{message}</p>}
        <button type="submit" className="btn btn--block" disabled={busy || name.trim() === ''}>
          {busy ? t.wait : t.social.send}
        </button>
        <p className="note">
          {t.social.yourName[0]}
          <strong>{account.name}</strong>
          {t.social.yourName[1]}
        </p>
      </form>

      {friends === 'loading' && <p className="note">{t.loading}</p>}
      {friends === null && <p className="note note--warn">{t.social.loadFailed}</p>}

      {incoming.length > 0 && (
        <section className="stack">
          <p className="section-title">{t.social.incoming}</p>
          <ul className="friends">
            {incoming.map((friend) => (
              <li key={friend.id} className="friend">
                <Avatar choice={friend.avatar} size="sm" />
                <span className="friend-name">{friend.name}</span>
                <span className="friend-actions">
                  <button type="button" className="btn btn--quiet" onClick={() => act(respondFriend(friend.id, true))}>
                    {t.social.accept}
                  </button>
                  <button
                    type="button"
                    className="btn btn--quiet btn--muted"
                    onClick={() => act(respondFriend(friend.id, false))}
                  >
                    {t.social.decline}
                  </button>
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {friends !== 'loading' && friends !== null && (
        <section className="stack">
          <div className="spread">
            <p className="section-title">{t.social.friends}</p>
            <p className="note">{accepted.length}</p>
          </div>
          {accepted.length === 0 ? (
            <p className="note">{t.social.none}</p>
          ) : (
            <ul className="friends">
              {accepted.map((friend) => (
                <FriendRow key={friend.id} friend={friend} onRemove={() => act(removeFriend(friend.id))} />
              ))}
            </ul>
          )}
        </section>
      )}

      {outgoing.length > 0 && (
        <section className="stack">
          <p className="section-title">{t.social.outgoing}</p>
          <ul className="friends">
            {outgoing.map((friend) => (
              <li key={friend.id} className="friend">
                <Avatar choice={friend.avatar} size="sm" />
                <span className="friend-name">{friend.name}</span>
                <span className="friend-actions">
                  <button type="button" className="btn btn--quiet btn--muted" onClick={() => act(removeFriend(friend.id))}>
                    {t.cancel}
                  </button>
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </>
  )
}

/** Removing a friend takes a second tap: a stray one would cost a request and a wait. */
function FriendRow({ friend, onRemove }: { friend: Friend; onRemove(): void }) {
  const t = useT()
  const [confirming, setConfirming] = useState(false)

  return (
    <li className="friend">
      <Avatar choice={friend.avatar} size="sm" />
      <span className="friend-name">
        {friend.name}
        <span className="note">
          {t.social.stats(levelFor(friend.xp), formatNumber(t, friend.weekBest), formatNumber(t, friend.bestScore))}
        </span>
      </span>
      <span className="friend-actions">
        {confirming ? (
          <>
            <button type="button" className="btn btn--quiet" onClick={onRemove}>
              {t.social.remove}
            </button>
            <button type="button" className="btn btn--quiet btn--muted" onClick={() => setConfirming(false)}>
              {t.social.keep}
            </button>
          </>
        ) : (
          <button type="button" className="btn btn--quiet btn--muted" onClick={() => setConfirming(true)}>
            {t.social.remove}
          </button>
        )}
      </span>
    </li>
  )
}

const THEMES: readonly Theme[] = ['system', 'light', 'dark']
const SOUND_SWITCHES = ['effects', 'keys', 'music', 'pulse'] as const

interface OptionsPaneProps {
  theme: Theme
  onTheme(theme: Theme): void
  locale: Locale
  onLocale(locale: Locale): void
  sound: SoundPrefs
  onSound(sound: SoundPrefs): void
}

function OptionsPane({ theme, onTheme, locale, onLocale, sound, onSound }: OptionsPaneProps) {
  const t = useT()
  // Once an ad has asked for consent, EU law requires a way back to that form.
  const [adChoices, setAdChoices] = useState(false)
  useEffect(() => {
    let live = true
    adPrivacyOptionsRequired().then((required) => live && setAdChoices(required))
    return () => {
      live = false
    }
  }, [])
  return (
    <>
      <section className="stack">
        <p className="section-title">{t.options.theme}</p>
        <div className="layer-tabs" role="radiogroup" aria-label={t.options.theme}>
          {THEMES.map((id) => (
            <button
              key={id}
              type="button"
              role="radio"
              aria-checked={theme === id}
              className={`layer-tab${theme === id ? ' layer-tab--on' : ''}`}
              onClick={() => onTheme(id)}
            >
              {t.options.themes[id]}
            </button>
          ))}
        </div>
        <p className="note">{t.options.themeNote}</p>
      </section>

      <section className="stack">
        <p className="section-title">{t.options.sound}</p>
        <div className="language-list">
          {SOUND_SWITCHES.map((id) => (
            <button
              key={id}
              type="button"
              role="switch"
              aria-checked={sound[id]}
              // Keys only click when effects play at all.
              disabled={id === 'keys' && !sound.effects}
              className={`layer-tab${sound[id] ? ' layer-tab--on' : ''}`}
              onClick={() => onSound({ ...sound, [id]: !sound[id], muted: false })}
            >
              {t.options.sounds[id]}
            </button>
          ))}
        </div>
        <p className="note">{t.options.soundNote}</p>
      </section>

      <section className="stack">
        <p className="section-title">{t.options.language}</p>
        <div className="language-list" role="radiogroup" aria-label={t.options.language}>
          {LOCALES.map((entry) => (
            <button
              key={entry.id}
              type="button"
              role="radio"
              aria-checked={locale === entry.id}
              lang={entry.id}
              className={`layer-tab${locale === entry.id ? ' layer-tab--on' : ''}`}
              onClick={() => onLocale(entry.id)}
            >
              {entry.name}
            </button>
          ))}
        </div>
      </section>

      <div className="menu-foot">
        <a className="btn btn--quiet menu-start" href={PRIVACY_URL} target="_blank" rel="noopener noreferrer">
          {t.options.privacy}
        </a>
        {adChoices && (
          <button type="button" className="btn btn--quiet menu-start" onClick={showAdPrivacyOptions}>
            {t.options.adPrivacy}
          </button>
        )}
      </div>
    </>
  )
}

/** Erasing is irreversible, so it takes a second, explicit tap. */
function EraseData({ onErase }: { onErase(): Promise<boolean> }) {
  const t = useT()
  const [step, setStep] = useState<'idle' | 'confirm' | 'erasing' | 'failed' | 'done'>('idle')

  const erase = async () => {
    setStep('erasing')
    setStep((await onErase()) ? 'done' : 'failed')
  }

  switch (step) {
    case 'idle':
      return (
        <button type="button" className="btn btn--quiet btn--muted menu-start" onClick={() => setStep('confirm')}>
          {t.options.erase}
        </button>
      )
    case 'confirm':
    case 'erasing':
      return (
        <p className="erase-confirm">
          <span className="note">{t.options.eraseWarning}</span>
          <button type="button" className="btn btn--quiet" onClick={erase} disabled={step === 'erasing'}>
            {step === 'erasing' ? t.options.erasing : t.options.eraseAll}
          </button>
          <button type="button" className="btn btn--quiet btn--muted" onClick={() => setStep('idle')}>
            {t.cancel}
          </button>
        </p>
      )
    case 'failed':
      return (
        <p className="erase-confirm">
          <span className="note note--warn">{t.options.eraseFailed}</span>
          <button type="button" className="btn btn--quiet" onClick={erase}>
            {t.options.retry}
          </button>
        </p>
      )
    case 'done':
      return <p className="note">{t.options.erased}</p>
  }
}
