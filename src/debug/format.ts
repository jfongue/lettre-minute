/*
 * Les chiffres du mode débug, mis en mots : mêmes arrondis pour le tableau de
 * bord et pour le tableau des mots. Séparés des composants (`board.tsx`) pour
 * que le rechargement à chaud ne se plaigne pas de fonctions exportées à côté
 * d'un composant.
 */

export const fmt = (value: number | null | undefined) => (value == null ? '—' : Number(value).toLocaleString('fr-FR'))

export const decimal = (value: number | null | undefined) => (value == null ? '—' : String(value).replace('.', ','))

export const pct = (part: number, whole: number) => (whole ? `${Math.round((part / whole) * 100)} %` : '—')

/** Sous le pour cent, deux décimales : « 0,07 % » dit quelque chose, « 0 % » rien. */
export const share = (part: number, whole: number) => {
  if (!whole) return '—'
  const ratio = (part / whole) * 100
  return `${ratio < 1 ? ratio.toFixed(2).replace('.', ',') : ratio.toFixed(1).replace('.', ',')} %`
}

export function ago(iso: string): string {
  const minutes = Math.round((Date.now() - Date.parse(iso)) / 60_000)
  if (minutes < 1) return 'à l’instant'
  if (minutes < 60) return `il y a ${minutes} min`
  const hours = Math.round(minutes / 60)
  return hours < 48 ? `il y a ${hours} h` : `il y a ${Math.round(hours / 24)} jours`
}
