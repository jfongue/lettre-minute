import { useState } from 'react'
import { DEFAULT_SETTINGS, DURATION_CHOICES, ROUND_CHOICES, type MatchSettings, type Player } from '../domain'

const MAX_PLAYERS = 8

interface SetupScreenProps {
  onStart(players: readonly Player[], settings: MatchSettings): void
}

export function SetupScreen({ onStart }: SetupScreenProps) {
  const [names, setNames] = useState<string[]>(['', ''])
  const [settings, setSettings] = useState<MatchSettings>(DEFAULT_SETTINGS)

  const rename = (index: number, value: string) =>
    setNames((current) => current.map((name, at) => (at === index ? value : name)))

  const start = () =>
    onStart(
      names.map((name, index) => ({ id: `p${index}`, name: name.trim() || `Joueur ${index + 1}` })),
      settings,
    )

  return (
    <div className="sheet enter">
      <header className="stack">
        <p className="eyebrow">Jeu de lettres pour une table</p>
        <h1 className="title">Lettrine</h1>
        <p className="lede">
          Une lettre, trois catégories, {settings.seconds} secondes. Un mot que personne d’autre n’a trouvé
          vaut le double.
        </p>
      </header>

      <section className="card stack">
        <p className="eyebrow">Joueurs</p>
        {names.map((name, index) => (
          <div className="row" key={index}>
            <div className="field" style={{ flex: 1 }}>
              <input
                value={name}
                placeholder={`Joueur ${index + 1}`}
                aria-label={`Nom du joueur ${index + 1}`}
                onChange={(event) => rename(index, event.target.value)}
              />
            </div>
            {names.length > 1 && (
              <button
                type="button"
                className="btn--icon"
                aria-label={`Retirer le joueur ${index + 1}`}
                onClick={() => setNames((current) => current.filter((_, at) => at !== index))}
              >
                −
              </button>
            )}
          </div>
        ))}
        {names.length < MAX_PLAYERS && (
          <button type="button" className="btn btn--quiet" onClick={() => setNames((current) => [...current, ''])}>
            + Ajouter un joueur
          </button>
        )}
      </section>

      <section className="card stack">
        <p className="eyebrow">Durée d’une manche</p>
        <div className="segmented">
          {DURATION_CHOICES.map((seconds) => (
            <button
              key={seconds}
              type="button"
              aria-pressed={settings.seconds === seconds}
              onClick={() => setSettings((current) => ({ ...current, seconds }))}
            >
              {seconds} s
            </button>
          ))}
        </div>

        <p className="eyebrow" style={{ marginTop: '0.5rem' }}>
          Nombre de manches
        </p>
        <div className="segmented">
          {ROUND_CHOICES.map((rounds) => (
            <button
              key={rounds}
              type="button"
              aria-pressed={settings.rounds === rounds}
              onClick={() => setSettings((current) => ({ ...current, rounds }))}
            >
              {rounds}
            </button>
          ))}
        </div>
      </section>

      <button type="button" className="btn btn--block" onClick={start}>
        Commencer la partie
      </button>
      <p className="note">
        Le téléphone tient la carte et le chrono ; chacun écrit sur sa feuille. Le dépouillement se fait ensemble, une
        catégorie à la fois.
      </p>
    </div>
  )
}
