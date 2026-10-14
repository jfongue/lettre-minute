import { useState } from 'react'
import { achievementIcon, achievementProgress, achievementReward, type AchievementId, type Family } from '../domain/achievements'
import { PALETTE, inGround, type AvatarChoice } from '../domain/avatar'
import type { Profile } from '../domain/progression'
import { useT } from '../i18n'
import { Avatar } from './Avatar'
import { achievementText } from './achievementText'

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
 * Les succès du joueur. Chacun montre ce qu'il débloque, et c'est tout ce qu'il
 * y a à gagner : la case de la grille qu'il ouvre, ou la couleur qu'il pose sur
 * la palette. Un barreau de la grille porte son jalon pour nom — l'i18n de
 * l'avatar sait déjà le dire —, les autres ont le leur dans celle des succès.
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
                // Le compteur s'arrête à l'objectif : 553 mots trouvés sur 100 se
                // lit 100 / 100, la barre étant déjà pleine.
                const reached = Math.min(value, achievement.goal.at)
                const { name, desc } = achievementText(t, achievement)
                const { design, colour } = achievementReward(achievement)
                // Un exploit sans case à lui se montre sur l'avatar porté, peint
                // de sa couleur : l'icône du succès est une tuile qu'il n'ouvre
                // pas, et s'y lirait comme gagnée.
                const tile =
                  design !== null
                    ? { ...avatar, design }
                    : colour
                      ? inGround(avatar, colour.id)
                      : achievementIcon(achievement.id)
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
                        <Avatar choice={tile} locked={!done} />
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
                              <span className="ach-count">{t.ach.count(reached, achievement.goal.at)}</span>
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
