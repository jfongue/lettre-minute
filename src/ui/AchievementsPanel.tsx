import { useState } from 'react'
import { achievementIcon, achievementProgress, achievementReward, type AchievementId, type Family } from '../domain/achievements'
import { PALETTE, type AvatarChoice } from '../domain/avatar'
import type { Profile } from '../domain/progression'
import { useT } from '../i18n'
import { Avatar } from './Avatar'

interface AchievementsPanelProps {
  profile: Profile
  /** L'avatar porté : les tuiles gagnées s'y dessinent, comme dans la grille. */
  avatar: AvatarChoice
  /** Ce que le serveur a compté comme découvertes, s'il a répondu. */
  discoveries?: number
}

/** Les trois rayons, dans l'ordre où la page les montre. */
const FAMILIES: readonly Family[] = ['progress', 'exploit', 'explore']

/**
 * Les succès du joueur. Chaque succès de palier montre ce que son jalon
 * débloque — la tuile de la grille, et la couleur quand la palette pose la même
 * borne. Un exploit ne débloque rien de tel : il garde son icône, qui raconte
 * ce qu'il est, et sa barre se remplit comme les autres.
 */
export function AchievementsPanel({ profile, avatar, discoveries }: AchievementsPanelProps) {
  const t = useT()
  // Le succès dont la condition est dépliée : la ligne entière l'ouvre.
  const [open, setOpen] = useState<AchievementId | null>(null)
  // Le rang sert à la fois de couleur de barre et de clé de rendu : la même
  // barre garde la même teinte d'un rendu à l'autre.
  const rows = achievementProgress(profile, discoveries).map((row, rank) => ({ row, rank }))
  const earned = rows.filter(({ row }) => row.ratio >= 1).length

  return (
    <>
      <header className="ach-head">
        <h2 className="section-title">{t.ach.title}</h2>
        <p className="note">{t.ach.count(earned, rows.length)}</p>
      </header>

      {FAMILIES.map((family) => (
        <section className="ach-section" key={family}>
          <h3 className="section-title ach-title">{t.ach.families[family]}</h3>
          <ul className="ach-list">
            {rows
              .filter(({ row }) => row.achievement.family === family)
              .map(({ row, rank }) => {
                const { achievement, value, ratio } = row
                const done = ratio >= 1
                const { name, desc } = t.ach[achievement.id]
                const { design, colour } = achievementReward(achievement)
                return (
                  <li key={achievement.id}>
                    <button
                      type="button"
                      className={`ach-row${done ? ' ach-row--done' : ''}`}
                      aria-expanded={open === achievement.id}
                      title={`${t.ach.howTitle} · ${t.ach.how(achievement.goal)}`}
                      onClick={() => setOpen(open === achievement.id ? null : achievement.id)}
                    >
                      <span className="ach-reward">
                        {design !== null ? (
                          <Avatar choice={{ ...avatar, design }} locked={!done} />
                        ) : (
                          <Avatar choice={achievementIcon(achievement.id)} locked={!done} />
                        )}
                        {colour && (
                          <span
                            className={`ach-colour${done ? '' : ' ach-colour--locked'}`}
                            style={done ? { background: colour.hex } : undefined}
                            title={t.colours[colour.id] ?? colour.label}
                          />
                        )}
                      </span>
                      <span className="ach-body">
                        <span className="ach-name">
                          {name}
                          {achievement.play !== undefined && <span className="ach-play">{t.ach.play}</span>}
                        </span>
                        <span className="ach-desc">{desc}</span>
                        {(achievement.family !== 'exploit' || done) && (
                          <span className="ach-meter">
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
                          </span>
                        )}
                        {/* La condition, dite avec son unité : ce que la barre ne montre pas. */}
                        {open === achievement.id && (
                          <span className="ach-how">
                            <span className="ach-how-title">{t.ach.howTitle}</span>
                            {t.ach.how(achievement.goal)}
                          </span>
                        )}
                      </span>
                    </button>
                  </li>
                )
              })}
          </ul>
        </section>
      ))}
    </>
  )
}
