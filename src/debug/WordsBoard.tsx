import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { availableCategoryIds, loadPack } from '../data/packs'
import { CATALOGUE } from '../domain/catalogue'
import { letterShares } from '../domain/run'
import { normalizeWord, initialOf } from '../domain/text'
import { acceptable } from '../domain/wordShape'
import type { WordPack } from '../domain/words'
import { LOCALES, categoryText, useT } from '../i18n'
import {
  addWordDirect,
  amendWord,
  fetchAdminWords,
  proposeBan,
  proposeWord,
  type AmendOutcome,
  type BanOutcome,
  type DirectWordOutcome,
} from '../lib/cloud'
import { FlagWordCard, type FlagWord } from '../ui/StatsPage'
import { useBackDismiss } from '../ui/useBackDismiss'
import { useLongPress } from '../ui/useLongPress'
import { Kpi, Section, Table, type HeadCell } from './board'
import { ago, fmt, share } from './format'
import type { PairStat, PendingWord, RemovedWord, WordsAnswer, WordsReport } from './words'

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
 * la file des propositions —, donc sans rien court-circuiter. Le super
 * modérateur a deux portes de plus, qui tranchent seules : ajouter un mot
 * d'office (`add_word_direct`) et corriger son orthographe (`amend_word`, notée
 * pour l'import). Le serveur les lui réserve ; l'écran ne fait que les montrer.
 */

export type LoadWords = (lang: string, category: string | null) => Promise<WordsAnswer>
export type BanWords = (lang: string, word: FlagWord, reason: string) => Promise<BanOutcome>
export type AddWord = (lang: string, categoryId: string, word: string) => Promise<boolean>
export type AddWordNow = (lang: string, categoryId: string, word: string) => Promise<DirectWordOutcome>
/** Le mot à corriger : sa catégorie, sa clé nue, l'orthographe qu'il a. */
export interface AmendTarget {
  categoryId: string
  key: string
  display: string
}
export type AmendWords = (lang: string, target: AmendTarget, to: string) => Promise<AmendOutcome>
// Un signalement rejoint la revue, et c'est la file qui décide (0059) : personne
// ne tranche seul, super modérateur compris.
const banDefault: BanWords = (lang, word, reason) =>
  proposeBan(lang, word.categoryId, word.word, word.display, reason)
const amendDefault: AmendWords = (lang, target, to) =>
  amendWord(lang, target.categoryId, target.key, target.display, to)

/** Le chargeur, posé sur `body` : le tiroir du menu est trop étroit pour ses tableaux. */
export function WordsBoard({
  lang,
  onClose,
  load = fetchAdminWords,
  onBan = banDefault,
  onAdd = proposeWord,
  onAddNow = addWordDirect,
  onAmend = amendDefault,
  superModerator = false,
}: {
  lang: string
  onClose(): void
  load?: LoadWords
  onBan?: BanWords
  onAdd?: AddWord
  onAddNow?: AddWordNow
  onAmend?: AmendWords
  superModerator?: boolean
}) {
  useEffect(() => {
    const close = (event: KeyboardEvent) => event.key === 'Escape' && onClose()
    window.addEventListener('keydown', close)
    return () => window.removeEventListener('keydown', close)
  }, [onClose])

  return createPortal(
    <div className="dashboard dashboard--overlay" data-no-swipe role="dialog" aria-label="Tableau des mots">
      <WordsBoardView
        lang={lang}
        load={load}
        onBan={onBan}
        onAdd={onAdd}
        onAddNow={onAddNow}
        onAmend={onAmend}
        superModerator={superModerator}
        onClose={onClose}
      />
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
    Promise.all(ids.map((id) => loadPack(lang, id).catch(() => null)))
      .then((found) => new Map(found.flatMap((pack) => (pack ? [[pack.categoryId, pack] as const] : []))))
      // Un dictionnaire qui ne vient pas laisse l'écran sans lui, pas à attendre.
      .catch(() => new Map<string, WordPack>())
      .then((packs) => live && setHeld({ key, packs }))
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
  /** Corrigé : `display` est la nouvelle orthographe, que l'import n'a pas encore livrée. */
  amended?: boolean
}

/** Un trousseau de colonnes : les titres de texte disent leur alignement. */
const text = (label: string): HeadCell => ({ label, n: false })

/* --------------------------------------------------------------------- vue */

export function WordsBoardView({
  lang: language,
  load,
  onBan,
  onAdd,
  onAddNow,
  onAmend,
  superModerator = false,
  onClose,
}: {
  lang: string
  load: LoadWords
  onBan: BanWords
  onAdd: AddWord
  onAddNow: AddWordNow
  onAmend: AmendWords
  superModerator?: boolean
  onClose?(): void
}) {
  const t = useT()
  const [lang, setLang] = useState(language)
  const [category, setCategory] = useState(EMPTY)
  const [letter, setLetter] = useState(EMPTY)
  const [search, setSearch] = useState(EMPTY)
  const [attempt, setAttempt] = useState(0)
  /** La portée du relevé : sa langue et son filtre. Un rafraîchissement ne la change pas. */
  const scope = `${lang}\u0000${category}`
  const [answer, setAnswer] = useState<{ scope: string; data: WordsAnswer } | null>(null)
  const [flagged, setFlagged] = useState<FlagWord | null>(null)
  const [adding, setAdding] = useState(false)
  const [amending, setAmending] = useState<AmendTarget | null>(null)
  /** Le relevé tarde : on le dit au bout d'un moment plutôt que de tourner en silence. */
  const [slowAt, setSlowAt] = useState<string | null>(null)
  const [wholePairs, setWholePairs] = useState(false)
  /** La section des mots : on y descend en cliquant un couple. */
  const wordsRef = useRef<HTMLDivElement>(null)

  /** Un couple cliqué filtre l'écran dessus — sa catégorie, sa lettre — et montre ses mots. */
  const pickPair = (one: { category: string; letter: string }) => {
    setCategory(one.category)
    setLetter(one.letter)
    wordsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  useEffect(() => {
    let live = true
    const patience = setTimeout(() => live && setSlowAt(`${scope}\u0000${attempt}`), 8_000)
    // Un relevé qui lève ou qui ne vient pas est une erreur à montrer, avec son
    // bouton « Réessayer » : jamais un écran qui attend pour toujours.
    load(lang, category || null)
      .catch((): WordsAnswer => 'error')
      .then((found) => live && setAnswer({ scope, data: found }))
    return () => {
      live = false
      clearTimeout(patience)
    }
  }, [load, lang, category, attempt, scope])

  // La carte de signalement se pose sur `body`, où le tableau des mots la
  // couvrirait : tant qu'il est ouvert, elle passe au-dessus.
  useEffect(() => {
    document.body.dataset.words = 'board'
    return () => {
      delete document.body.dataset.words
    }
  }, [])

  /** `undefined` : le relevé arrive ; `null` : il n'est pas venu, `failure` dit pourquoi. */
  const answered: WordsAnswer | undefined = answer?.scope === scope ? answer.data : undefined
  const report: WordsReport | null | undefined = answered === undefined ? undefined : typeof answered === 'object' ? answered : null
  const slow = slowAt === `${scope}\u0000${attempt}`
  const failure = typeof answered === 'string' ? answered : null

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
    for (const list of [report?.pairs, report?.words, report?.added, report?.removed, report?.pending, report?.amended]) {
      for (const row of list ?? []) ids.add(row.category)
    }
    return [...ids].sort((one, other) => catalogueRank(one) - catalogueRank(other) || one.localeCompare(other))
  }, [lang, report])

  const pairs = useMemo<PairRow[]>(() => {
    // Le dictionnaire d'abord : un couple que personne n'a encore tiré compte
    // aussi — sans quoi une langue que personne ne joue n'afficherait rien.
    const counted = new Map((report?.pairs ?? []).map((pair) => [`${pair.category}\u0000${pair.letter}`, pair]))
    const rows: PairRow[] = []
    for (const [id, shares] of theory ?? []) {
      if (category && id !== category) continue
      for (const one of shares.keys()) {
        const real = counted.get(`${id}\u0000${one}`)
        counted.delete(`${id}\u0000${one}`)
        rows.push({
          category: id,
          letter: one,
          dealt: real?.dealt ?? 0,
          passed: real?.passed ?? 0,
          words: real?.words ?? 0,
          points: real?.points ?? 0,
          theory: theoryOf(id, one),
        })
      }
    }
    // Puis ce que le serveur a compté sans que le dictionnaire le connaisse :
    // une catégorie hors catalogue, un dictionnaire d'une autre version.
    for (const left of counted.values()) rows.push({ ...left, theory: theoryOf(left.category, left.letter) })
    return rows
  }, [report, theory, theoryOf, category])

  const words = useMemo<WordRow[]>(() => {
    const counted = new Map((report?.words ?? []).map((use) => [`${use.category}\u0000${use.word}`, use]))
    const rows = new Map<string, WordRow>()
    const fixes = new Map((report?.amended ?? []).map((fix) => [`${fix.category}\u0000${fix.word}`, fix]))
    const pack = category ? packs?.get(category) : null
    if (pack) {
      // Un mot n'entre qu'une fois : ses formes fléchies portent la clé de leur
      // base, et c'est sous elle que le serveur compte les usages.
      for (const entry of pack.entries.values()) {
        if (rows.has(entry.key)) continue
        const use = counted.get(`${category}\u0000${entry.key}`)
        const fix = fixes.get(`${category}\u0000${entry.key}`)
        rows.set(entry.key, {
          word: entry.key,
          display: fix?.display ?? entry.display,
          amended: fix !== undefined,
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
      const fix = fixes.get(`${use.category}\u0000${use.word}`)
      rows.set(use.word, {
        word: use.word,
        display: fix?.display ?? use.word,
        amended: fix !== undefined,
        category: use.category,
        uses: use.uses,
        approx: use.approx,
        last: use.last,
        shipped: !pack,
      })
    }
    return [...rows.values()]
  }, [report, packs, category])

  /** Ce que chaque dictionnaire de la langue compte, formes fléchies repliées. */
  const sizes = useMemo(() => {
    if (!packs) return null
    const counts = new Map<string, number>()
    for (const [id, pack] of packs) {
      const keys = new Set<string>()
      for (const entry of pack.entries.values()) keys.add(entry.key)
      counts.set(id, keys.size)
    }
    return counts
  }, [packs])

  /**
   * Toutes catégories : ce que la langue a au dictionnaire et ce qu'on en a
   * écrit. Une langue que personne ne joue montre au moins son dictionnaire.
   */
  const summary = useMemo(() => {
    if (!sizes) return null
    const written = new Map<string, { words: number; uses: number }>()
    for (const use of report?.words ?? []) {
      const tally = written.get(use.category) ?? { words: 0, uses: 0 }
      written.set(use.category, { words: tally.words + 1, uses: tally.uses + use.uses })
    }
    const ids = [...sizes.keys()]
    for (const id of written.keys()) if (!sizes.has(id)) ids.push(id)
    return ids
      .sort((one, other) => catalogueRank(one) - catalogueRank(other) || one.localeCompare(other))
      .map((id) => ({
        category: id,
        words: sizes.get(id) ?? 0,
        written: written.get(id)?.words ?? 0,
        uses: written.get(id)?.uses ?? 0,
      }))
  }, [sizes, report])
  const dictionary = summary?.reduce(
    (total, row) => ({ words: total.words + row.words, written: total.written + row.written }),
    { words: 0, written: 0 },
  )

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
            (other.theory ?? 0) - (one.theory ?? 0) ||
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
  const shownAmended = useMemo(
    () => (report?.amended ?? []).filter((row) => wanted(row.word)),
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
          <select value={lang} onChange={(event) => setLang(event.target.value)}>
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
          <p>
            {slow
              ? 'Toujours en cours… le serveur est lent, la lecture est abandonnée au bout de 25 secondes.'
              : 'Lecture des compteurs du dictionnaire…'}
          </p>
        </div>
      ) : report === null ? (
        <div className="dashboard-state">
          <p>
            {failure === 'denied'
              ? 'Réservé à l’administrateur.'
              : 'Le serveur n’a pas répondu, ou trop lentement : le relevé n’est pas venu.'}
          </p>
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
            <Kpi label="Mots" value={fmt(dictionary ? dictionary.words : shownWords.length)}>
              {dictionary
                ? `${fmt(dictionary.written)} déjà écrits, ${fmt(Math.max(0, dictionary.words - dictionary.written))} jamais`
                : untouched
                  ? `${fmt(untouched)} jamais écrits`
                  : 'tous déjà écrits'}
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
            aside={
              <p className="note">
                {category ? categoryText(t, category).label : 'toutes catégories'}
                {letter ? ` · lettre ${letter}` : ''}
                {category && letter && (
                  <button
                    type="button"
                    className="words-pick"
                    onClick={() => {
                      setCategory(EMPTY)
                      setLetter(EMPTY)
                    }}
                  >
                    voir tous les couples
                  </button>
                )}
              </p>
            }
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
                {shownPairs.slice(0, wholePairs ? shownPairs.length : 40).map((pair) => {
                  const real = report.dealt ? pair.dealt / report.dealt : 0
                  const gap = pair.theory !== null && pair.theory > 0 && real > 0 ? real / pair.theory : null
                  return (
                    <tr key={`${pair.category}:${pair.letter}`} className="words-pair" onClick={() => pickPair(pair)}>
                      <td>
                        <button type="button" className="words-pick" onClick={() => pickPair(pair)}>
                          <b className="dashboard-letter">{pair.letter}</b> {categoryText(t, pair.category).label}
                        </button>
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
          {shownPairs.length > 40 && (
            <button type="button" className="btn btn--quiet dashboard-more" onClick={() => setWholePairs(!wholePairs)}>
              {wholePairs ? 'Voir moins' : `Voir les ${fmt(shownPairs.length)} couples`}
            </button>
          )}
            <p className="note">
              « Théorique » : la part du tirage que le dictionnaire de la catégorie donne à cette lettre, sur les {fmt(playable)}{' '}
              catégories jouables de la langue — verrou de la partie précédente et catégories possédées non comptés. « Réel » : sa part
              des {fmt(report.dealt)} tirages de la langue. « Écart » : le réel sur le théorique, ×1 quand le tirage tient sa promesse.
              Les couples que personne n’a encore tirés viennent du dictionnaire, avec zéro tirage : c’est ce qu’une langue que
              personne ne joue montre d’elle-même.
            </p>
          </Section>

          <div ref={wordsRef} className="words-words">
          <Section
            title="Mots du dictionnaire"
            mark="var(--blue)"
            aside={
              <button type="button" className="btn btn--blue" onClick={() => setAdding(true)}>
                Ajouter un mot
              </button>
            }
          >
            {!category &&
            (summary ? (
              <Table head={[text('Catégorie'), 'Mots au dictionnaire', 'Déjà écrits', 'Utilisations']}>
                {summary.map((row) => (
                  <tr key={row.category}>
                    <td>
                      <button type="button" className="words-pick" onClick={() => setCategory(row.category)}>
                        {categoryText(t, row.category).label}
                      </button>
                    </td>
                    <td className="n">{fmt(row.words)}</td>
                    <td className="n">{fmt(row.written)}</td>
                    <td className="n">{fmt(row.uses)}</td>
                  </tr>
                ))}
              </Table>
            ) : (
              <div className="dashboard-empty">Lecture des dictionnaires de la langue…</div>
            ))}
          {category && shownWords.length ? (
              <Table
                head={[
                  'Mot',
                  text('Catégorie'),
                  'Utilisations',
                  'Mal écrit',
                  'Utilisation',
                  text('Dernière'),
                  ...(superModerator ? [text('Corriger')] : []),
                ]}
              >
                {shownWords.slice(0, 120).map((row) => (
                  <tr key={`${row.category}:${row.word}`} {...press({ categoryId: row.category, word: row.word, display: row.display })}>
                    <td>
                      {row.display}
                      {!row.shipped && <span className="dashboard-tag">hors dictionnaire</span>}
                      {row.amended && <span className="dashboard-tag">corrigé, à l’import</span>}
                    </td>
                    <td>{category ? '' : categoryText(t, row.category).label}</td>
                    <td className="n">{fmt(row.uses)}</td>
                    <td className="n">{row.approx ? fmt(row.approx) : '—'}</td>
                    <td className="n">{share(row.uses, pairDealt(report.pairs, row.category, initialOf(row.word)))}</td>
                    <td>{row.last ? ago(row.last) : 'jamais'}</td>
                    {superModerator && (
                      <td>
                        <button
                          type="button"
                          className="btn btn--quiet"
                          onClick={() => setAmending({ categoryId: row.category, key: row.word, display: row.display })}
                        >
                          Corriger
                        </button>
                      </td>
                    )}
                  </tr>
                ))}
              </Table>
          ) : category ? (
            <div className="dashboard-empty">Aucun mot pour ce filtre.</div>
          ) : null}
            {shownWords.length > 120 && (
              <p className="note">
                Les {fmt(120)} mots les plus écrits, sur {fmt(shownWords.length)} : cherchez un mot, ou prenez une lettre.
              </p>
            )}
            {category ? (
            <p className="note">
              « Utilisation » : part des tirages de son couple — sa catégorie et sa lettre — où ce mot est sorti. « Mal écrit » :
              accepté à une lettre près, payé au tarif plat.
            </p>
          ) : (
            <p className="note">
              Le dictionnaire de chaque catégorie, et ce que les joueurs en ont écrit : touchez une catégorie pour son détail mot à
              mot, c’est là que la lettre et la recherche s’appliquent.
            </p>
          )}
          {superModerator && (
            <p className="note">
              Super modérateur : « Corriger » change l’orthographe d’un mot sans vote. La correction est gardée sur le serveur et
              appliquée à l’import suivant, qui remplace la ligne et ses formes ; d’ici là, la nouvelle orthographe se joue comme un mot
              de la communauté, en partie seule — jamais en défi, ni pour les robots, qui ne lisent que le dictionnaire livré.
            </p>
          )}
          <p className="note">
            Un appui long sur une ligne (un clic droit, sur ordinateur) ouvre le signalement : comme dans le récapitulatif d’une
            partie, le mot passe par la file de modération — cinq « correct » des autres — et ne sort du jeu qu’au dictionnaire livré
            d’après. Personne ne tranche seul, super modérateur compris.
          </p>
          </Section>

          </div>
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

          {shownAmended.length > 0 && (
            <Section title="Mots corrigés" mark="var(--blue)" round>
              <Table head={['Mot', text('Avant'), text('Corrigé')]}>
                {shownAmended.map((row) => (
                  <tr key={`${row.category}:${row.word}`}>
                    <td>
                      {row.display}
                      {!category && <span className="dashboard-tag">{categoryText(t, row.category).label}</span>}
                    </td>
                    <td>{row.old_display}</td>
                    <td>{row.at ? ago(row.at) : '—'}</td>
                  </tr>
                ))}
              </Table>
              <p className="note">
                Orthographes corrigées qui attendent le prochain import : il remplace la ligne du dictionnaire livré et ses formes
                fléchies (<code>scripts/amended-words.json</code>).
              </p>
            </Section>
          )}

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
          onFlag={async (reason) => {
            const outcome = await onBan(lang, flagged, reason)
            // Le signalement est passé : le relevé se relit pour que la revue
            // apparaisse dans la file, en bas de l'écran.
            if (outcome === 'sent' || outcome === 'accepted') setAttempt(attempt + 1)
            return outcome
          }}
          onClose={() => setFlagged(null)}
        />
      )}
      {adding && (
        <AddWordCard
          lang={lang}
          categories={categories}
          category={category}
          onAdd={onAdd}
          onAddNow={superModerator ? onAddNow : undefined}
          onDone={() => setAttempt(attempt + 1)}
          onClose={() => setAdding(false)}
        />
      )}
      {amending && (
        <EditWordCard
          lang={lang}
          target={amending}
          category={categoryText(t, amending.categoryId).label}
          onAmend={onAmend}
          onDone={() => setAttempt(attempt + 1)}
          onClose={() => setAmending(null)}
        />
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
 * Le mot ajouté depuis l'écran des mots. Par la modération, il part comme une
 * proposition de joueur, sans vote ni passage en force. Le super modérateur a
 * un second bouton qui l'ajoute d'office : la revue s'écrit acceptée avec sa
 * voix, et le mot entre au dictionnaire vivant tout de suite.
 */
function AddWordCard({
  lang,
  category,
  categories,
  onAdd,
  onAddNow,
  onDone,
  onClose,
}: {
  lang: string
  category: string
  categories: readonly string[]
  onAdd: AddWord
  onAddNow?: AddWordNow
  onDone(): void
  onClose(): void
}) {
  const t = useT()
  const [word, setWord] = useState(EMPTY)
  const [pick, setPick] = useState(category || categories[0] || EMPTY)
  const [step, setStep] = useState<'ask' | 'busy' | 'sent' | 'kept' | 'invalid' | 'added' | 'known' | 'refused' | 'unreachable'>('ask')
  useBackDismiss(onClose)

  const confirm = async () => {
    // Une forme que l'import jetterait — « M », « C&A » — serait refusée pour
    // toujours : elle ne doit pas coûter trois votes et 150 XP.
    if (!acceptable(word.trim())) {
      setStep('invalid')
      return
    }
    setStep('busy')
    setStep((await onAdd(lang, pick, word)) ? 'sent' : 'kept')
  }

  const addNow = async () => {
    if (!onAddNow) return
    if (!acceptable(word.trim())) {
      setStep('invalid')
      return
    }
    setStep('busy')
    const outcome = await onAddNow(lang, pick, word)
    if (outcome === 'added') onDone()
    setStep(
      outcome === 'added'
        ? 'added'
        : outcome === 'known'
          ? 'known'
          : outcome === 'invalid'
            ? 'invalid'
            : outcome === 'forbidden'
              ? 'refused'
              : 'unreachable',
    )
  }

  const messages: Record<string, string> = {
    sent: 'Le mot attend les votes des modérateurs dans « Mes demandes » — rien n’est validé depuis cet écran.',
    invalid:
      'Ce mot ne peut pas entrer au dictionnaire : deux lettres au moins, puis des lettres, un espace, un tiret ou une apostrophe — pas de chiffre, de parenthèse ni de ponctuation.',
    kept: 'Gardé sur cet appareil : il partira à la prochaine connexion, et rejoindra alors la même file.',
    added:
      'Le mot est au dictionnaire vivant : il se joue tout de suite en partie seule, et les dictionnaires livrés l’auront à l’import suivant.',
    known: 'Ce mot est déjà au dictionnaire vivant.',
    refused: 'Le serveur refuse : seul un super modérateur ajoute d’office.',
    unreachable: 'Le serveur n’a pas répondu : rien n’a été ajouté, vous pouvez réessayer.',
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
              « Proposer » met le mot dans la file de modération comme une proposition de joueur : il faudra les mêmes votes pour
              qu’il rejoigne le dictionnaire, et son entrée ne vaudra qu’au prochain import.
              {onAddNow && ' « Ajouter d’office » (super modérateur) l’accepte sans vote.'}
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
              {onAddNow && (
                <button
                  type="button"
                  className="btn btn--blue"
                  onClick={addNow}
                  disabled={step === 'busy' || !pick || word.trim().length < 2}
                >
                  Ajouter d’office
                </button>
              )}
              <button
                type="button"
                className={onAddNow ? 'btn btn--ghost' : 'btn btn--blue'}
                onClick={confirm}
                disabled={step === 'busy' || !pick || word.trim().length < 2}
              >
                Proposer à la modération
              </button>
            </div>
          </>
        ) : (
          <>
            <p>{messages[step]}</p>
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

/**
 * La correction d'orthographe d'un mot, réservée au super modérateur : sans
 * vote, notée sur le serveur pour l'import qui remplacera la ligne.
 */
function EditWordCard({
  lang,
  target,
  category,
  onAmend,
  onDone,
  onClose,
}: {
  lang: string
  target: AmendTarget
  category: string
  onAmend: AmendWords
  onDone(): void
  onClose(): void
}) {
  const [word, setWord] = useState(target.display)
  const [step, setStep] = useState<'ask' | 'busy' | AmendOutcome>('ask')
  useBackDismiss(onClose)

  const confirm = async () => {
    if (!acceptable(word.trim())) {
      setStep('invalid')
      return
    }
    setStep('busy')
    const outcome = await onAmend(lang, target, word)
    if (outcome === 'amended') onDone()
    setStep(outcome)
  }

  const messages: Record<AmendOutcome, string> = {
    amended:
      'Correction notée : le prochain import remplacera le mot et ses formes ; d’ici là, la nouvelle orthographe se joue en partie seule comme un mot de la communauté.',
    known: 'C’est déjà son orthographe : rien n’a changé.',
    invalid:
      'Cette orthographe ne peut pas entrer au dictionnaire : deux lettres au moins, puis des lettres, un espace, un tiret ou une apostrophe — pas de chiffre, de parenthèse ni de ponctuation.',
    forbidden: 'Le serveur refuse : seul un super modérateur corrige un mot.',
    unreachable: 'Le serveur n’a pas répondu : rien n’a été changé, vous pouvez réessayer.',
  }

  return createPortal(
    <div className="offer-pop-layer" role="dialog" aria-modal="true" aria-labelledby="edit-word-title">
      <div className="offer-pop-scrim" onClick={onClose} />
      <div className="offer-pop">
        <h2 id="edit-word-title" className="offer-pop-title">
          Corriger « {target.display} »
        </h2>
        {step === 'ask' || step === 'busy' ? (
          <>
            <p>
              {category} : l’orthographe change sans vote. Le dictionnaire livré ne la prendra qu’à l’import suivant, qui remplace la
              ligne et ses formes fléchies.
            </p>
            <label className="flag-reason" htmlFor="edit-word-text">
              <span className="note">Nouvelle orthographe</span>
              <input id="edit-word-text" value={word} onChange={(event) => setWord(event.target.value)} maxLength={60} />
            </label>
            <div className="offer-pop-actions">
              <button type="button" className="btn btn--ghost" onClick={onClose}>
                Annuler
              </button>
              <button
                type="button"
                className="btn btn--blue"
                onClick={confirm}
                disabled={step === 'busy' || word.trim().length < 2 || word.trim() === target.display}
              >
                Corriger
              </button>
            </div>
          </>
        ) : (
          <>
            <p>{messages[step]}</p>
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
