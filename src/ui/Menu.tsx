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
  type FriendRequestOutcome,
} from '../lib/cloud'
import type { Theme } from '../state/theme'
import { AccountPanel, type AccountActions } from './AccountPanel'
import { Avatar } from './Avatar'

export type MenuPane = 'profile' | 'social' | 'options'

const PANES: readonly [MenuPane, string][] = [
  ['profile', 'Profil'],
  ['social', 'Social'],
  ['options', 'Options'],
]

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
  onAvatar(): void
  onLogOut(): void
  /** Answers false when the server could not erase the account. */
  onErase(): Promise<boolean>
  onClose(): void
}

export function Menu({ onClose, ...props }: MenuProps) {
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
      <aside className="menu" role="dialog" aria-modal="true" aria-label="Menu" tabIndex={-1} ref={drawer}>
        <div className="spread">
          <p className="section-title">Menu</p>
          <button type="button" className="btn btn--quiet" onClick={onClose}>
            Fermer
          </button>
        </div>

        <div className="layer-tabs" role="tablist">
          {PANES.map(([id, label]) => (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={pane === id}
              className={`layer-tab${pane === id ? ' layer-tab--on' : ''}`}
              onClick={() => setPane(id)}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="menu-body">
          {pane === 'profile' && <ProfilePane {...props} />}
          {pane === 'social' && <SocialPane account={props.account} onProfile={() => setPane('profile')} />}
          {pane === 'options' && <OptionsPane theme={props.theme} onTheme={props.onTheme} />}
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
}: Omit<MenuProps, 'onClose' | 'theme' | 'onTheme'>) {
  const named = account && !account.anonymous

  return (
    <>
      <section className="player">
        <button type="button" className="player-avatar" onClick={onAvatar} aria-label="Modifier mon avatar">
          <Avatar choice={avatar} size="md" />
        </button>
        <div className="player-id">
          <strong>{named ? account.name : 'Joueur anonyme'}</strong>
          <span className="note">
            Niveau {levelProgress(profile.xp).level} · record {profile.bestScore.toLocaleString('fr-FR')}
          </span>
          <button type="button" className="btn btn--quiet" onClick={onAvatar}>
            Modifier l’avatar
          </button>
        </div>
      </section>

      {named && (
        <div className="stack">
          {account.email && <p className="note">Connecté avec {account.email}</p>}
          <button type="button" className="btn btn--quiet btn--muted menu-start" onClick={onLogOut}>
            Se déconnecter
          </button>
        </div>
      )}

      {account?.anonymous && (
        <AccountPanel
          title="Ton compte"
          lead="Tes parties te suivent d’un appareil à l’autre, ton nom entre au classement et tes amis peuvent te trouver."
          {...accountActions}
        />
      )}

      {!account && <p className="note">Hors ligne : ta progression reste sur cet appareil.</p>}

      <div className="menu-foot">
        <EraseData onErase={onErase} />
      </div>
    </>
  )
}

const REQUEST_MESSAGES: Record<FriendRequestOutcome, (name: string) => string> = {
  sent: (name) => `Demande envoyée à ${name}.`,
  accepted: (name) => `${name} t’avait déjà demandé : vous êtes amis.`,
  already: () => 'Vous êtes déjà amis, ou ta demande attend sa réponse.',
  self: () => 'C’est ton propre nom.',
  unknown: () => 'Aucun compte à ce nom.',
  anonymous: () => 'Crée un compte pour ajouter des amis.',
  unreachable: () => 'Le serveur ne répond pas. Réessaie dans un instant.',
}

function SocialPane({ account, onProfile }: { account: Account | null; onProfile(): void }) {
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
    return <p className="note">Les amis demandent une connexion au serveur du jeu, absente pour l’instant.</p>
  }

  if (!named) {
    return (
      <div className="stack">
        <p className="note">
          Un ami te trouve par ton nom de compte : crée-le d’abord, tes parties déjà jouées te suivent.
        </p>
        <button type="button" className="btn btn--block" onClick={onProfile}>
          Créer mon compte
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
    setMessage(REQUEST_MESSAGES[outcome](wanted))
    if (outcome === 'sent' || outcome === 'accepted') {
      setName('')
      refresh()
    }
  }

  const act = async (work: Promise<boolean>) => {
    if (!(await work)) setMessage(REQUEST_MESSAGES.unreachable(''))
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
          <span>Ajouter un ami</span>
          <input
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="Son nom de compte"
            autoComplete="off"
            autoCapitalize="off"
            maxLength={24}
          />
        </label>
        {message && <p className="note">{message}</p>}
        <button type="submit" className="btn btn--block" disabled={busy || name.trim() === ''}>
          {busy ? 'Un instant…' : 'Envoyer la demande'}
        </button>
        <p className="note">
          Ton nom à donner : <strong>{account.name}</strong>
        </p>
      </form>

      {friends === 'loading' && <p className="note">Chargement…</p>}
      {friends === null && <p className="note note--warn">Impossible de charger tes amis pour l’instant.</p>}

      {incoming.length > 0 && (
        <section className="stack">
          <p className="section-title">Demandes reçues</p>
          <ul className="friends">
            {incoming.map((friend) => (
              <li key={friend.id} className="friend">
                <Avatar choice={friend.avatar} size="sm" />
                <span className="friend-name">{friend.name}</span>
                <span className="friend-actions">
                  <button type="button" className="btn btn--quiet" onClick={() => act(respondFriend(friend.id, true))}>
                    Accepter
                  </button>
                  <button
                    type="button"
                    className="btn btn--quiet btn--muted"
                    onClick={() => act(respondFriend(friend.id, false))}
                  >
                    Refuser
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
            <p className="section-title">Mes amis</p>
            <p className="note">{accepted.length}</p>
          </div>
          {accepted.length === 0 ? (
            <p className="note">Pas encore d’amis. Envoie une demande avec leur nom de compte.</p>
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
          <p className="section-title">En attente de réponse</p>
          <ul className="friends">
            {outgoing.map((friend) => (
              <li key={friend.id} className="friend">
                <Avatar choice={friend.avatar} size="sm" />
                <span className="friend-name">{friend.name}</span>
                <span className="friend-actions">
                  <button type="button" className="btn btn--quiet btn--muted" onClick={() => act(removeFriend(friend.id))}>
                    Annuler
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
  const [confirming, setConfirming] = useState(false)

  return (
    <li className="friend">
      <Avatar choice={friend.avatar} size="sm" />
      <span className="friend-name">
        {friend.name}
        <span className="note">
          Niv. {levelFor(friend.xp)} · semaine {friend.weekBest.toLocaleString('fr-FR')} · record{' '}
          {friend.bestScore.toLocaleString('fr-FR')}
        </span>
      </span>
      <span className="friend-actions">
        {confirming ? (
          <>
            <button type="button" className="btn btn--quiet" onClick={onRemove}>
              Retirer
            </button>
            <button type="button" className="btn btn--quiet btn--muted" onClick={() => setConfirming(false)}>
              Garder
            </button>
          </>
        ) : (
          <button type="button" className="btn btn--quiet btn--muted" onClick={() => setConfirming(true)}>
            Retirer
          </button>
        )}
      </span>
    </li>
  )
}

const THEMES: readonly [Theme, string][] = [
  ['system', 'Auto'],
  ['light', 'Clair'],
  ['dark', 'Sombre'],
]

function OptionsPane({ theme, onTheme }: { theme: Theme; onTheme(theme: Theme): void }) {
  return (
    <>
      <section className="stack">
        <p className="section-title">Thème</p>
        <div className="layer-tabs" role="radiogroup" aria-label="Thème">
          {THEMES.map(([id, label]) => (
            <button
              key={id}
              type="button"
              role="radio"
              aria-checked={theme === id}
              className={`layer-tab${theme === id ? ' layer-tab--on' : ''}`}
              onClick={() => onTheme(id)}
            >
              {label}
            </button>
          ))}
        </div>
        <p className="note">« Auto » suit le réglage du téléphone.</p>
      </section>

      <div className="menu-foot">
        <a className="btn btn--quiet menu-start" href={PRIVACY_URL} target="_blank" rel="noopener noreferrer">
          Confidentialité
        </a>
      </div>
    </>
  )
}

/** Erasing is irreversible, so it takes a second, explicit tap. */
function EraseData({ onErase }: { onErase(): Promise<boolean> }) {
  const [step, setStep] = useState<'idle' | 'confirm' | 'erasing' | 'failed' | 'done'>('idle')

  const erase = async () => {
    setStep('erasing')
    setStep((await onErase()) ? 'done' : 'failed')
  }

  switch (step) {
    case 'idle':
      return (
        <button type="button" className="btn btn--quiet btn--muted menu-start" onClick={() => setStep('confirm')}>
          Effacer mes données
        </button>
      )
    case 'confirm':
    case 'erasing':
      return (
        <p className="erase-confirm">
          <span className="note">Niveau, records, amis et mots proposés seront perdus.</span>
          <button type="button" className="btn btn--quiet" onClick={erase} disabled={step === 'erasing'}>
            {step === 'erasing' ? 'Effacement…' : 'Tout effacer'}
          </button>
          <button type="button" className="btn btn--quiet btn--muted" onClick={() => setStep('idle')}>
            Annuler
          </button>
        </p>
      )
    case 'failed':
      return (
        <p className="erase-confirm">
          <span className="note note--warn">Le serveur n’a pas répondu, rien n’a été effacé.</span>
          <button type="button" className="btn btn--quiet" onClick={erase}>
            Réessayer
          </button>
        </p>
      )
    case 'done':
      return <p className="note">Données effacées.</p>
  }
}
