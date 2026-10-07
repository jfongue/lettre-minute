import { achievementIcon, achievementProgress, type Family } from '../domain/achievements'
import { PALETTE } from '../domain/avatar'
import type { Profile } from '../domain/progression'
import { useT } from '../i18n'
import { Avatar } from './Avatar'

interface AchievementsScreenProps {
  profile: Profile
  /** Ce que le serveur a compté comme découvertes, s’il a répondu. */
  discoveries?: number
  onClose(): void
}

/** Les trois rayons, dans l’ordre où l’écran les montre. */
const FAMILIES: readonly Family[] = ['progress', 'exploit', 'explore']

/**
 * Les succès du joueur : les statistiques se lisent en couleurs, les défis en
 * icônes. Un succès obtenu montre son état à la place de sa barre.
 */
export function AchievementsScreen({ profile, discoveries, onClose }: AchievementsScreenProps) {
  const t = useT()
  // Le rang sert à la fois de couleur de barre et de clé de rendu : la même
  // barre garde la même teinte d’un rendu à l’autre.
  const rows = achievementProgress(profile, discoveries).map((row, rank) => ({ row, rank }))
  const earned = rows.filter(({ row }) => row.ratio >= 1).length

  return (
    <div className="sheet cascade">
      <header className="ach-head">
        <h1 className="section-title">{t.ach.title}</h1>
        <p className="note">{t.ach.count(earned, rows.length)}</p>
      </header>

      {FAMILIES.map((family) => (
        <section className="ach-section" key={family}>
          <h2 className="section-title ach-title">{t.ach.families[family]}</h2>
          <ul className="ach-list">
            {rows
              .filter(({ row }) => row.achievement.family === family)
              .map(({ row, rank }) => {
                const { achievement, value, ratio } = row
                const done = ratio >= 1
                const { name, desc } = t.ach[achievement.id]
                return (
                  <li key={achievement.id} className={`ach-row${done ? ' ach-row--done' : ''}`}>
                    {achievement.family !== 'progress' && (
                      <span className="ach-tile">
                        <Avatar choice={achievementIcon(achievement.id)} locked={!done} />
                      </span>
                    )}
                    <div className="ach-body">
                      <p className="ach-name">
                        {name}
                        {achievement.play !== undefined && <span className="ach-play">{t.ach.play}</span>}
                      </p>
                      <p className="ach-desc">{desc}</p>
                      {(achievement.family !== 'exploit' || done) && (
                        <div className="ach-meter">
                          {achievement.family !== 'exploit' && !done && (
                            <span className="ach-bar">
                              <span
                                className="ach-fill"
                                style={{
                                  width: `${Math.round(ratio * 100)}%`,
                                  background: PALETTE[rank % PALETTE.length].hex,
                                }}
                              />
                            </span>
                          )}
                          {achievement.family !== 'exploit' && (
                            <span className="ach-count">{t.ach.count(value, achievement.goal.at)}</span>
                          )}
                          {done && <span className="ach-earned">{t.ach.earned}</span>}
                        </div>
                      )}
                    </div>
                  </li>
                )
              })}
          </ul>
        </section>
      ))}

      <button type="button" className="btn btn--ghost btn--block" onClick={onClose}>
        {t.menu.close}
      </button>
    </div>
  )
}
