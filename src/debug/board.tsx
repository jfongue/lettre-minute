import type { ReactNode } from 'react'

/*
 * Les morceaux communs aux deux planches chiffrées du mode débug : le tableau
 * de bord (cinq tapes sur « Classements ») et le tableau des mots (cinq tapes
 * sur « Mes catégories »). Mêmes classes CSS, même français — ce sont des
 * outils de développeur, donc hors de l'i18n. Les chiffres sont dans
 * `format.ts`, pour ne laisser ici que des composants.
 */

/* ------------------------------------------------------------ morceaux */

export function Kpi({ label, value, children }: { label: string; value: string; children: ReactNode }) {
  return (
    <div className="dashboard-kpi">
      <span className="dashboard-kpi-label">{label}</span>
      <span className="dashboard-kpi-value">{value}</span>
      <span className="note">{children}</span>
    </div>
  )
}

export function Section({
  title,
  mark,
  round = false,
  aside,
  children,
}: {
  title: string
  mark: string
  round?: boolean
  aside?: ReactNode
  children: ReactNode
}) {
  return (
    <section className="dashboard-section">
      <div className="dashboard-section-head">
        <h2>
          <span className="dashboard-mark" style={{ background: mark, borderRadius: round ? '50%' : 0 }} aria-hidden="true" />
          {title}
        </h2>
        {aside}
      </div>
      {children}
    </section>
  )
}

export function Card({ title, tag, note, children }: { title: string; tag?: string; note?: string; children: ReactNode }) {
  return (
    <div className="dashboard-card">
      <h3>
        {title} {tag && <span className="dashboard-tag">{tag}</span>}
      </h3>
      {note && <p className="note">{note}</p>}
      {children}
    </div>
  )
}

export function Stat({ value, label }: { value: string; label: string }) {
  return (
    <div className="dashboard-stat">
      <b>{value}</b>
      <span>{label}</span>
    </div>
  )
}

export function Legend({ items }: { items: { label: string; color: string }[] }) {
  return (
    <div className="dashboard-legend">
      {items.map((item) => (
        <span key={item.label}>
          <i style={{ background: item.color }} />
          {item.label}
        </span>
      ))}
    </div>
  )
}

/** Un titre de colonne, ou son alignement explicite quand ce n'est pas un nombre. */
export type HeadCell = string | { label: string; n: boolean }

export function Table({ head, children }: { head: readonly HeadCell[]; children: ReactNode }) {
  // Les tableaux du tableau de bord ne portent que des chiffres après la
  // première colonne ; « Inscrit » et « Dernière » sont les deux exceptions.
  // Ailleurs, l'alignement se dit sur le titre.
  const align = (cell: HeadCell, index: number) =>
    typeof cell === 'string' ? index > 0 && cell !== 'Inscrit' && cell !== 'Dernière' : cell.n
  return (
    <div className="dashboard-table">
      <table>
        <thead>
          <tr>
            {head.map((cell, index) => {
              const label = typeof cell === 'string' ? cell : cell.label
              return (
                <th key={label} className={align(cell, index) ? 'n' : undefined}>
                  {label}
                </th>
              )
            })}
          </tr>
        </thead>
        <tbody>{children}</tbody>
      </table>
    </div>
  )
}
