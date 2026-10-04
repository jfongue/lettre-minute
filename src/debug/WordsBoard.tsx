import { useCallback, useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { availableCategoryIds, loadPack } from '../data/packs'
import { CATALOGUE } from '../domain/catalogue'
import { letterShares } from '../domain/run'
import { normalizeWord, initialOf } from '../domain/text'
import type { WordPack } from '../domain/words'
import { LOCALES, categoryText, useT } from '../i18n'
import { fetchAdminWords, proposeBan, proposeWord, type BanOutcome } from '../lib/cloud'
import { FlagWordCard, type FlagWord } from '../ui/StatsPage'
import { useBackDismiss } from '../ui/useBackDismiss'
import { useLongPress } from '../ui/useLongPress'
import { Kpi, Section, Table, type HeadCell } from './board'
import { ago, fmt, share } from './format'
import type { PairStat, PendingWord, RemovedWord, WordsReport } from './words'

/*
 * Le tableau des mots : cinq tapes sur « Mes catégories » l'ouvrent, comme
 * cinq tapes sur « Classements » ouvrent le tableau de bord. Il confronte ce
 * que le tirage a donné — `prompt_stats` — aux dictionnaires embarqués, qui
 * seuls savent ce qu'une catégorie pouvait donner : d'où la théorie, que le
 * serveur ne peut pas calculer, et le réel, qu'il est seul à compter.
 *
 * Un outil de développeur : libellés français hors de l'i18n, comme la
 * planche, avec les noms de catégories de l'interface. Les mots s'y bannissent
 * et s'y proposent par les mêmes portes que partout ailleurs — `propose_ban` et
 * la file des propositions —, donc sans rien court-circuiter.
 */

export type LoadWords = (lang: string, category: string | null) => Promise<WordsReport | null>
export type BanWords = (lang: string, word: FlagWord, reason: string) => Promise<BanOutcome>
export type AddWord = (lang: string, categoryId: string, word: string) => Promise<boolean>

const banDefault: BanWords = (lang, word, reason) => proposeBan(lang, word.categoryId, word.word, word.display, reason)

/** Le chargeur, posé sur `body` : le tiroir du menu est trop étroit pour ses tableaux. */
export function WordsBoard({
  lang,
  onClose,
  load = fetchAdminWords,
  onBan = banDefault,
  onAdd = proposeWord,
}: {
  lang: string
  onClose(): void
  load?: LoadWords
  onBan?: BanWords
  onAdd?: AddWord
}) {
  useEffect(() => {
    const close = (event: KeyboardEvent) => event.key === 'Escape' && onClose()
    window.addEventListener('keydown', close)
    return () => window.removeEventListener('keydown', close)
  }, [onClose])

  return createPortal(
    <div className="dashboard dashboard--overlay" data-no-swipe role="dialog" aria-label="Tableau des mots">
      <WordsBoardView lang={lang} load={load} onBan={onBan} onAdd={onAdd} onClose={onClose} />
    </div>,
    document.body,
  )
}

/* ------------------------------------------------------------------ filtres */

const LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('')
const EMPTY = ''

/** L'ordre du catalogue, puis les catégories que la base connaît sans lui. */
const CATALOGUE_ORDER = CATALOGUE.map((category) => category.id)
function catalogueRank(id: string): number {
  const at = CATALOGUE_ORDER.indexOf(id)
  return at === -1 ? CATALOGUE_ORDER.length : at
}

/** Les tirages d'un couple, à ce que le serveur en a compté. */
function pairDealt(pairs: readonly PairStat[], category: string, letter: string): number {
  return pairs.find((pair) => pair.category === category && pair.letter === letter)?.dealt ?? 0
}

/**
 * Les dictionnaires d'une langue, ou celui d'une seule catégorie. Chargés à
 * part du relevé : la langue entière pèse des mégaoctets, et l'écran s'affiche
 * sans eux, la colonne « théorique » se remplissant ensuite.
 */
function useDictionaries(lang: string, category: string | null): Map<string, WordPack> | null {
  const key = `${lang}\u0000${category ?? ''}`
  const [held, setHeld] = useState<{ key: string; packs: Map<string, WordPack> } | null>(null)
  useEffect(() => {
    let live = true
    const ids = category ? [category] : availableCategoryIds(lang)
    Promise.all(ids.map((id) => loadPack(lang, id).catch(() => null))).then((found) => {
      if (!live) return
      setHeld({ key, packs: new Map(found.flatMap((pack) => (pack ? [[pack.categoryId, pack] as const] : []))) })
    })
    return () => {
      live = false
    }
  }, [lang, category, key])
  // Un filtre qu'on vient de changer n'affiche pas les dictionnaires de l'ancien.
  return held?.key === key ? held.packs : null
}

/** Un mot du dictionnaire confronté à ce que le serveur en sait. */
interface WordRow {
  word: string
  display: string
  category: string
  uses: number
  approx: number
  last: string | null
  /** Faux pour un mot que les dictionnaires livrés ne portent plus (banni, ou pas encore importé). */
  shipped: boolean
}

/** Un trousseau de colonnes : les titres de texte disent leur alignement. */
const text = (label: string): HeadCell => ({ label, n: false })

/* --------------------------------------------------------------------- vue */

export function WordsBoardView({
  lang: language,
  load,
  onBan,
  onAdd,
  onClose,
}: {
  lang: string
  load: LoadWords
  onBan: BanWords
  onAdd: AddWord
  onClose?(): void
}) {
  const t = useT()
  const [lang, setLang] = useState(language)
  const [category, setCategory] = useState(EMPTY)
  const [letter, setLetter] = useState(EMPTY)
  const [search, setSearch] = useState(EMPTY)
  const [attempt, setAttempt] = useState(0)
  const key = `${lang}\u0000${category}\u0000${attempt}`
  const [answer, setAnswer] = useState<{ key: string; data: WordsReport | null } | null>(null)
  const [flagged, setFlagged] = useState<FlagWord | null>(null)
  const [adding, setAdding] = useState(false)

  useEffect(() => {
    let live = true
    load(lang, category || null).then((found) => live && setAnswer({ key, data: found }))
    return () => {
      live = false
    }
  }, [load, lang, category, key])

  /** `undefined` : le relevé arrive ; `null` : pas administrateur, ou serveur muet. */
  const report: WordsReport | null | undefined = answer?.key === key ? answer.data : undefined

  const packs = useDictionaries(lang, category || null)
  const playable = availableCategoryIds(lang).length
  const press = useLongPress<FlagWord>((word) => setFlagged(word))

  // La théorie d'un couple : la part de sa lettre dans sa catégorie, sur
  // autant de catégories jouables que la langue en compte. Le verrou de la
  // partie précédente et les catégories qu'un joueur possède n'y sont pas :
  // c'est la part que le tirage donne, pas une prévision.
  const theory = useMemo(() => {
    if (!packs || playable === 0) return null
    return new Map([...packs].map(([id, pack]) => [id, letterShares(pack)]))
  }, [packs, playable])
  const theoryOf = useCallback(
    (id: string, one: string): number | null => {
      const part = theory?.get(id)?.get(one)
      return part === undefined || playable === 0 ? null : part / playable
    },
    [theory, playable],
  )

  const categories = useMemo(() => {
    const ids = new Set<string>(availableCategoryIds(lang))
    for (const list of [report?.pairs, report?.words, report?.added, report?.removed, report?.pending]) {
      for (const row of list ?? []) ids.add(row.category)
    }
    return [...ids].sort((one, other) => catalogueRank(one) - catalogueRank(other) || one.localeCompare(other))
  }, [lang, report])

  const pairs = useMemo<PairRow[]>(() => {
    const rows: PairRow[] = (report?.pairs ?? []).map((pair) => ({ ...pair, theory: theoryOf(pair.category, pair.letter) }))
    // Le dictionnaire chargé, les couples que personne n'a encore tirés
    // existent quand même : c'est là qu'un tirage mort se voit.
    const only = category ? theory?.get(category) : undefined
    if (only) {
      const dealt = new Set(rows.map((row) => row.letter))
      for (const one of only.keys()) {
        if (!dealt.has(one)) rows.push({ category, letter: one, dealt: 0, passed: 0, words: 0, points: 0, theory: theoryOf(category, one) })
      }
    }
    return rows
  }, [report, theory, theoryOf, category])

  const words = useMemo<WordRow[]>(() => {
    const counted = new Map((report?.words ?? []).map((use) => [`${use.category}\u0000${use.word}`, use]))
    const rows = new Map<string, WordRow>()
    const pack = category ? packs?.get(category) : null
    if (pack) {
      // Un mot n'entre qu'une fois : ses formes fléchies portent la clé de leur
      // base, et c'est sous elle que le serveur compte les usages.
      for (const entry of pack.entries.values()) {
        if (rows.has(entry.key)) continue
        const use = counted.get(`${category}\u0000${entry.key}`)
        rows.set(entry.key, {
          word: entry.key,
          display: entry.display,
          category,
          uses: use?.uses ?? 0,
          approx: use?.approx ?? 0,
          last: use?.last ?? null,
          shipped: true,
        })
      }
    }
    for (const use of report?.words ?? []) {
      if (category && use.category !== category) continue
      if (rows.has(use.word)) continue
      rows.set(use.word, {
        word: use.word,
        display: use.word,
        category: use.category,
        uses: use.uses,
        approx: use.approx,
        last: use.last,
        shipped: !pack,
      })
    }
    return [...rows.values()]
  }, [report, packs, category])

  const wanted = useCallback(
    (word: string) => {
      const term = normalizeWord(search.trim())
      return (
        (letter === EMPTY || initialOf(word) === letter) &&
        (term === EMPTY || normalizeWord(word).includes(term))
      )
    },
    [letter, search],
  )

  const shownPairs = useMemo(
    () =>
      pairs
        .filter((pair) => letter === EMPTY || pair.letter === letter)
        .sort(
          (one, other) =>
            other.dealt - one.dealt ||
            catalogueRank(one.category) - catalogueRank(other.category) ||
            one.letter.localeCompare(other.letter),
        ),
    [pairs, letter],
  )
  const shownWords = useMemo(
    () => words.filter((row) => wanted(row.word)).sort((one, other) => other.uses - one.uses || one.word.localeCompare(other.word)),
    [words, wanted],
  )
  const shownAdded = useMemo(
    () => (report?.added ?? []).filter((row) => wanted(row.word)).sort((one, other) => other.at.localeCompare(one.at)),
    [report, wanted],
  )
  const shownRemoved = useMemo(
    () => (report?.removed ?? []).filter((row) => wanted(row.word)).sort((one, other) => other.at.localeCompare(one.at)),
    [report, wanted],
  )
  const shownPending = useMemo(
    () => (report?.pending ?? []).filter((row) => wanted(row.word)).sort((one, other) => other.at.localeCompare(one.at)),
    [report, wanted],
  )

  const dealt = shownPairs.reduce((total, pair) => total + pair.dealt, 0)
  const passed = shownPairs.reduce((total, pair) => total + pair.passed, 0)
  const never = shownPairs.filter((pair) => pair.dealt === 0).length
  const untouched = shownWords.filter((row) => row.uses === 0).length

  return (
    <div className="dashboard-wrap">
      <header className="dashboard-head">
        {onClose && (
          <button type="button" className="btn btn--quiet btn--muted dashboard-close" onClick={onClose}>
            ← Fermer
          </button>
        )}
        <div className="dashboard-tiles" aria-hidden="true">
          <span className="a" />
          <span className="b" />
          <span className="c" />
          <span className="d" />
          <span className="e" />
        </div>
        <div className="dashboard-headline">
          <h1>
            Les mots
            <br />
            du <em>dictionnaire</em>
          </h1>
          {report && (
            <div className="dashboard-stamp">
              <span className="dashboard-pill">
                <i />
                Relevé {ago(report.generated_at)}
              </span>
              <button
                type="button"
                className="btn btn--quiet"
                onClick={() => setAttempt(attempt + 1)}
              >
                Rafraîchir
              </button>
            </div>
          )}
        </div>
      </header>

      <div className="words-filters">
        <label>
          <span className="note">Langue</span>
          <select
            value={lang}
            onChange={(event) => {
              setLang(event.target.value)
              setCategory(EMPTY)
            }}
          >
            {LOCALES.map((locale) => (
              <option key={locale.id} value={locale.id}>
                {locale.name} · {availableCategoryIds(locale.id).length} catégories
              </option>
            ))}
          </select>
        </label>
        <label>
          <span className="note">Catégorie</span>
          <select value={category} onChange={(event) => setCategory(event.target.value)}>
            <option value="">Toutes les catégories</option>
            {categories.map((id) => (
              <option key={id} value={id}>
                {categoryText(t, id).label}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span className="note">Lettre</span>
          <select value={letter} onChange={(event) => setLetter(event.target.value)}>
            <option value="">Toutes les lettres</option>
            {LETTERS.map((one) => (
              <option key={one} value={one}>
                {one}
              </option>
            ))}
          </select>
        </label>
        <label className="words-find">
          <span className="note">Chercher un mot</span>
          <input
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="les premières lettres…"
          />
        </label>
      </div>

      {report === undefined ? (
        <div className="dashboard-state">
          <div className="home-loader" aria-hidden="true">
            <span />
            <span />
            <span />
          </div>
          <p>Lecture des compteurs du dictionnaire…</p>
        </div>
      ) : report === null ? (
        <div className="dashboard-state">
          <p>Réservé à l’administrateur (ou serveur injoignable).</p>
          <button type="button" className="btn btn--quiet" onClick={() => setAttempt(attempt + 1)}>
            Réessayer
          </button>
        </div>
      ) : (
        <>
          <div className="dashboard-kpis">
            <Kpi label="Tirages" value={fmt(dealt)}>
              {category ? categoryText(t, category).label : 'toutes catégories'} · <b>{fmt(report.dealt)}</b> pour la langue
            </Kpi>
            <Kpi label="Taux de passe" value={dealt ? share(passed, dealt) : '—'}>
              {fmt(passed)} couples quittés sans mot
            </Kpi>
            <Kpi label="Couples" value={fmt(shownPairs.length)}>
              {never ? `${fmt(never)} jamais tirés` : 'tous déjà tirés'}
            </Kpi>
            <Kpi label="Mots" value={fmt(shownWords.length)}>
              {untouched ? `${fmt(untouched)} jamais écrits` : 'tous déjà écrits'}
            </Kpi>
            <Kpi label="Ajoutés" value={fmt(shownAdded.length)}>
              entrés par la modération
            </Kpi>
            <Kpi label="En modération" value={fmt(shownPending.length)}>
              {fmt(shownRemoved.length)} mots retirés
            </Kpi>
          </div>

          <Section
            title="Couples lettre + catégorie"
            mark="var(--yellow)"
            aside={<p className="note">{category ? categoryText(t, category).label : 'toutes catégories'}{letter ? ` · lettre ${letter}` : ''}</p>}
          >
            {theory === null && (
              <div className="dashboard-empty">
                {category
                  ? 'Lecture du dictionnaire de cette catégorie… la colonne « théorique » arrive.'
                  : `Lecture des ${fmt(playable)} dictionnaires de la langue… la colonne « théorique » arrive.`}
              </div>
            )}
            {shownPairs.length ? (
              <Table
                head={[
                  'Couple',
                  'Tirages',
                  'Théorique',
                  'Réel',
                  'Écart',
                  'Passés',
                  'Taux de passe',
                  { label: 'Mots / tirage', n: true },
                ]}
              >
                {shownPairs.slice(0, 40).map((pair) => {
                  const real = report.dealt ? pair.dealt / report.dealt : 0
                  const gap = pair.theory !== null && pair.theory > 0 && real > 0 ? real / pair.theory : null
                  return (
                    <tr key={`${pair.category}:${pair.letter}`}>
                      <td>
                        <b className="dashboard-letter">{pair.letter}</b> {categoryText(t, pair.category).label}
                      </td>
                      <td className="n">{fmt(pair.dealt)}</td>
                      <td className="n">{pair.theory === null ? '…' : share(pair.theory, 1)}</td>
                      <td className="n">{pair.dealt ? share(pair.dealt, report.dealt) : '—'}</td>
                      <td className="n">
                        <Gap value={gap} />
                      </td>
                      <td className="n">{fmt(pair.passed)}</td>
                      <td className="n">
                        <span
                          className="dashboard-cell"
                          style={{
                            background: `color-mix(in srgb, var(--red) ${pair.dealt ? Math.round((pair.passed / pair.dealt) * 60) : 0}%, transparent)`,
                          }}
                        >
                          {pair.dealt ? share(pair.passed, pair.dealt) : '—'}
                        </span>
                      </td>
                      <td className="n">{pair.dealt ? (pair.words / pair.dealt).toFixed(1).replace('.', ',') : '—'}</td>
                    </tr>
                  )
                })}
              </Table>
            ) : (
              <div className="dashboard-empty">Aucun couple tiré pour ce filtre.</div>
            )}
            <p className="note">
              « Théorique » : la part du tirage que le dictionnaire de la catégorie donne à cette lettre, sur les {fmt(playable)}{' '}
              catégories jouables de la langue — verrou de la partie précédente et catégories possédées non comptés. « Réel » : sa part
              des {fmt(report.dealt)} tirages de la langue. « Écart » : le réel sur le théorique, ×1 quand le tirage tient sa promesse.
            </p>
          </Section>

          <Section
            title="Mots du dictionnaire"
            mark="var(--blue)"
            aside={
              <button type="button" className="btn btn--blue" onClick={() => setAdding(true)}>
                Ajouter un mot
              </button>
            }
          >
            {shownWords.length ? (
              <Table head={['Mot', text('Catégorie'), 'Utilisations', 'Mal écrit', 'Utilisation', text('Dernière')]}>
                {shownWords.slice(0, 120).map((row) => (
                  <tr key={`${row.category}:${row.word}`} {...press({ categoryId: row.category, word: row.word, display: row.display })}>
                    <td>
                      {row.display}
                      {!row.shipped && <span className="dashboard-tag">hors dictionnaire</span>}
                    </td>
                    <td>{category ? '' : categoryText(t, row.category).label}</td>
                    <td className="n">{fmt(row.uses)}</td>
                    <td className="n">{row.approx ? fmt(row.approx) : '—'}</td>
                    <td className="n">{share(row.uses, pairDealt(report.pairs, row.category, initialOf(row.word)))}</td>
                    <td>{row.last ? ago(row.last) : 'jamais'}</td>
                  </tr>
                ))}
              </Table>
            ) : (
              <div className="dashboard-empty">
                {category
                  ? 'Aucun mot pour ce filtre.'
                  : 'Toutes catégories : seuls les mots déjà écrits par quelqu’un apparaissent. Choisissez une catégorie pour lister tout son dictionnaire.'}
              </div>
            )}
            {shownWords.length > 120 && (
              <p className="note">
                Les {fmt(120)} mots les plus écrits, sur {fmt(shownWords.length)} : cherchez un mot, ou prenez une lettre.
              </p>
            )}
            <p className="note">
              « Utilisation » : part des tirages de son couple — sa catégorie et sa lettre — où ce mot est sorti. « Mal écrit » :
              accepté à une lettre près, payé au tarif plat. Appui long sur une ligne : signaler le mot pour le retirer, ce qui passe
              par la modération comme les autres signalements.
            </p>
          </Section>

          <Section title="Mots ajoutés" mark="var(--green)" round>
            {shownAdded.length ? (
              <Table
                head={[
                  'Mot',
                  text('Demandé par'),
                  text('Ajouté'),
                  text('Modérateurs'),
                  'Depuis',
                  { label: 'Utilisation', n: true },
                  { label: 'Mal écrit', n: true },
                ]}
              >
                {shownAdded.slice(0, 120).map((row) => (
                  <tr key={`${row.category}:${row.word}`} {...press({ categoryId: row.category, word: row.word, display: row.display })}>
                    <td>
                      {row.display}
                      {!category && <span className="dashboard-tag">{categoryText(t, row.category).label}</span>}
                    </td>
                    <td>{names(row.requesters)}</td>
                    <td>{row.at ? ago(row.at) : '—'}</td>
                    <td>{names(row.moderators)}</td>
                    <td className="n">
                      {fmt(row.uses_since)} / {fmt(row.parties_since)}
                      {row.uses > row.uses_since && <span className="dashboard-tag">{fmt(row.uses)} en tout</span>}
                    </td>
                    <td className="n">{share(row.uses_since, row.parties_since)}</td>
                    <td className="n">{row.approx ? fmt(row.approx) : '—'}</td>
                  </tr>
                ))}
              </Table>
            ) : (
              <div className="dashboard-empty">Aucun mot ajouté par la modération pour ce filtre.</div>
            )}
            <p className="note">
              « Depuis » : les fois où le mot a été écrit depuis son entrée au dictionnaire, et les parties de la langue depuis ce
              moment — le taux d’utilisation se lit sur ces deux-là. Les compteurs du tirage, eux, n’ont pas de date.
            </p>
          </Section>

          <Section title="Mots retirés" mark="var(--red)" round>
            {shownRemoved.length ? (
              <Table
                head={['Mot', text('Retiré'), text('Retiré par'), text('Motif'), { label: 'Utilisation avant', n: true }, { label: 'Mal écrit', n: true }]}
              >
                {shownRemoved.map((row) => (
                  <tr key={`${row.category}:${row.word}`} {...press({ categoryId: row.category, word: row.word, display: row.display })}>
                    <td>
                      {row.display}
                      {!category && <span className="dashboard-tag">{categoryText(t, row.category).label}</span>}
                    </td>
                    <td>{row.at ? ago(row.at) : '—'}</td>
                    <td>{names(row.moderators)}</td>
                    <td className="words-note">{flagNote(row) ?? '—'}</td>
                    <td className="n">{share(row.uses_before, row.parties_before)}</td>
                    <td className="n">{row.approx_before ? fmt(row.approx_before) : '—'}</td>
                  </tr>
                ))}
              </Table>
            ) : (
              <div className="dashboard-empty">Aucun mot retiré pour ce filtre.</div>
            )}
            <p className="note">
              Un mot signalé ne sort du jeu qu’au dictionnaire livré d’après : « utilisation avant » porte donc sur les parties d’avant
              le vote, rapportées aux parties de la langue de la même période.
            </p>
          </Section>

          <Section title="En modération" mark="var(--pink)" round>
            {shownPending.length ? (
              <Table head={['Mot', text('Genre'), text('Demandé'), text('Demandé par'), text('Votes')]}>
                {shownPending.map((row) => (
                  <tr key={row.id} {...press({ categoryId: row.category, word: row.word, display: row.display })}>
                    <td>
                      {row.display}
                      {!category && <span className="dashboard-tag">{categoryText(t, row.category).label}</span>}
                      {row.special && <span className="dashboard-tag">spécial</span>}
                      {row.respelled && <span className="dashboard-tag">orthographe corrigée</span>}
                    </td>
                    <td>
                      <span className={row.kind === 'ban' ? 'words-kind words-kind--out' : 'words-kind'}>
                        {row.kind === 'ban' ? 'retrait' : 'ajout'}
                      </span>
                    </td>
                    <td>{row.at ? ago(row.at) : '—'}</td>
                    <td>{names(row.proposers)}</td>
                    <td className="words-note">{tally(row)}</td>
                  </tr>
                ))}
              </Table>
            ) : (
              <div className="dashboard-empty">Rien à juger pour ce filtre.</div>
            )}
            <p className="note">
              La file telle qu’elle est : {fmt(shownPending.length)} mots, dont {fmt(shownPending.filter((row) => row.kind === 'ban').length)}{' '}
              signalement{shownPending.filter((row) => row.kind === 'ban').length > 1 ? 's' : ''} de retrait. Trois « correct » font entrer un mot, deux « incorrect » le refusent, deux « je ne sais pas » le
              rendent louche — les mêmes seuils que dans « Mes demandes ».
            </p>
          </Section>
        </>
      )}

      {flagged && (
        <FlagWordCard
          word={flagged}
          category={categoryText(t, flagged.categoryId).label}
          onFlag={(reason) => onBan(lang, flagged, reason)}
          onClose={() => setFlagged(null)}
        />
      )}
      {adding && (
        <AddWordCard lang={lang} categories={categories} category={category} onAdd={onAdd} onClose={() => setAdding(false)} />
      )}
    </div>
  )
}

/* ----------------------------------------------------------------- morceaux */

interface PairRow extends PairStat {
  theory: number | null
}

/** L'écart du réel au théorique, en fois : la couleur dit le sens. */
function Gap({ value }: { value: number | null }) {
  if (value === null) return <>—</>
  const tint = Math.min(70, Math.round(Math.abs(Math.log2(value)) * 45))
  const color = value < 1 ? 'var(--red)' : 'var(--blue)'
  return (
    <span className="dashboard-cell" style={{ background: `color-mix(in srgb, ${color} ${tint}%, transparent)` }}>
      {value < 10 ? value.toFixed(2).replace('.', ',') : String(Math.round(value))}×
    </span>
  )
}

/** Les noms d'une ligne, sans doublon : au-delà de trois, le reste se compte. */
function names(people: readonly { name: string }[]): string {
  const unique = [...new Set(people.map((one) => one.name))]
  if (unique.length === 0) return '—'
  return unique.length > 3 ? `${unique.slice(0, 3).join(', ')} +${unique.length - 3}` : unique.join(', ')
}

/** Le motif du signaleur : c'est son vote qui porte la note. */
function flagNote(word: RemovedWord): string | null {
  return word.moderators.find((vote) => vote.note)?.note ?? null
}

/** Les verdicts d'une revue : « 3 ✓ · 1 ✗ — Maxitoon, Terretciel ». */
function tally(word: PendingWord): string {
  const marks: Record<string, string> = { correct: '✓', incorrect: '✗', unsure: '?', special: '★' }
  const counted = new Map<string, number>()
  for (const vote of word.votes) counted.set(vote.verdict, (counted.get(vote.verdict) ?? 0) + 1)
  const said = [...counted].map(([verdict, count]) => `${count} ${marks[verdict] ?? verdict}`).join(' · ')
  const who = names(word.votes)
  if (said === '') {
    return word.kind === 'ban' ? 'aucun vote' : `${fmt(word.proposals)} demande${word.proposals > 1 ? 's' : ''}, aucun vote`
  }
  return who === '—' ? said : `${said} — ${who}`
}

/**
 * Le mot ajouté depuis l'écran des mots : il part à la modération comme une
 * proposition de joueur, sans vote ni passage en force.
 */
function AddWordCard({
  lang,
  category,
  categories,
  onAdd,
  onClose,
}: {
  lang: string
  category: string
  categories: readonly string[]
  onAdd: AddWord
  onClose(): void
}) {
  const t = useT()
  const [word, setWord] = useState(EMPTY)
  const [pick, setPick] = useState(category || categories[0] || EMPTY)
  const [step, setStep] = useState<'ask' | 'busy' | 'sent' | 'kept'>('ask')
  useBackDismiss(onClose)

  const confirm = async () => {
    setStep('busy')
    setStep((await onAdd(lang, pick, word)) ? 'sent' : 'kept')
  }

  return createPortal(
    <div className="offer-pop-layer" role="dialog" aria-modal="true" aria-labelledby="add-word-title">
      <div className="offer-pop-scrim" onClick={onClose} />
      <div className="offer-pop">
        <h2 id="add-word-title" className="offer-pop-title">
          Ajouter un mot
        </h2>
        {step === 'ask' || step === 'busy' ? (
          <>
            <p>
              Le mot entre dans la file de modération comme une proposition de joueur : il faudra les mêmes votes pour qu’il rejoigne le
              dictionnaire, et son entrée ne vaudra qu’au prochain import.
            </p>
            {!category && (
              <label className="flag-reason" htmlFor="add-word-category">
                <span className="note">Catégorie</span>
                <select id="add-word-category" value={pick} onChange={(event) => setPick(event.target.value)}>
                  {categories.map((id) => (
                    <option key={id} value={id}>
                      {categoryText(t, id).label}
                    </option>
                  ))}
                </select>
              </label>
            )}
            <label className="flag-reason" htmlFor="add-word-text">
              <span className="note">Mot, tel qu’il s’écrit</span>
              <input
                id="add-word-text"
                value={word}
                onChange={(event) => setWord(event.target.value)}
                placeholder="au singulier, sans faute"
                maxLength={60}
              />
            </label>
            <div className="offer-pop-actions">
              <button type="button" className="btn btn--ghost" onClick={onClose}>
                Annuler
              </button>
              <button
                type="button"
                className="btn btn--blue"
                onClick={confirm}
                disabled={step === 'busy' || !pick || word.trim().length < 2}
              >
                Proposer à la modération
              </button>
            </div>
          </>
        ) : (
          <>
            <p>
              {step === 'sent'
                ? 'Le mot attend les votes des modérateurs dans « Mes demandes » — rien n’est validé depuis cet écran.'
                : 'Gardé sur cet appareil : il partira à la prochaine connexion, et rejoindra alors la même file.'}
            </p>
            <button type="button" className="btn btn--ghost btn--block" onClick={onClose}>
              Fermer
            </button>
          </>
        )}
      </div>
    </div>,
    document.body,
  )
}
