import { describe, expect, it } from 'vitest'
import { NO_USAGE } from './rarity'
import { NEW_PROFILE, type Profile } from './progression'
import {
  revealBudget,
  ban,
  banNews,
  bannedOf,
  banVerdict,
  feedbackDue,
  shareNewsDue,
  BASE_REVEALS,
  REVEAL_ADS_MAX,
  REVEAL_BONUS_MAX,
  REVEALS_MAX,
  REVEALS_PER_AD,
  banUnlocked,
  grantRevealAd,
  grantPlus,
  isPlus,
  revealAdsLeft,
  revealsLeft,
  spendReveal,
  hiddenAnswers,
  learnFromProfessor,
  joinPlus,
  markBanIntroSeen,
  markFeedbackAsked,
  markPlusThanked,
  plusThanksDue,
  playableCategoryIds,
  unban,
  countPlusAdSkipped,
  countPlusAttempt,
  countPlusReveal,
  countPlusRun,
  plusStat,
  premiereNews,
  weeklyWinPrizeDue,
} from './perks'
import { createRun, skip, submit, type Judge } from './run'
import { normalizeWord } from './text'
import { buildWordPack, commonWord, findWord, lettersWithEnough } from './words'

const SEVEN = ['a', 'b', 'c', 'd', 'e', 'f', 'g']

const filtered = (count: number): Profile => ({ ...NEW_PROFILE, bonuses: Array(count).fill('filter') })

describe('bans', () => {
  it('are locked until a filter bonus or Premium', () => {
    expect(banUnlocked(NEW_PROFILE)).toBe(false)
    expect(banVerdict(NEW_PROFILE, SEVEN, 'a')).toBe('locked')
    expect(banNews(NEW_PROFILE)).toBe(false)
    expect(banUnlocked(filtered(1))).toBe(true)
    expect(banVerdict(filtered(1), SEVEN, 'a')).toBe('ok')
    expect(banNews(filtered(1))).toBe(true)
    expect(banNews(markBanIntroSeen(filtered(1)))).toBe(false)
    expect(banVerdict(joinPlus(NEW_PROFILE, 1), SEVEN, 'a')).toBe('ok')
  })

  it('keep the banned category out of the draw', () => {
    const banned = ban(filtered(1), SEVEN, 'c')
    expect(playableCategoryIds(banned, SEVEN)).toEqual(['a', 'b', 'd', 'e', 'f', 'g'])
    expect(playableCategoryIds(unban(banned, 'c'), SEVEN)).toEqual(SEVEN)
  })

  it('give one ban per filter bonus, two at most, then ask for Premium', () => {
    const EIGHT = [...SEVEN, 'h', 'i']
    const one = ban(filtered(1), EIGHT, 'c')
    expect(banVerdict(one, EIGHT, 'd')).toBe('plus')
    expect(ban(one, EIGHT, 'd')).toBe(one)
    const two = ban(ban(filtered(2), EIGHT, 'c'), EIGHT, 'd')
    expect(bannedOf(two, EIGHT)).toEqual(['c', 'd'])
    expect(banVerdict(two, EIGHT, 'e')).toBe('plus')
    expect(bannedOf(filtered(3), EIGHT)).toEqual([])
    expect(bannedOf({ ...filtered(3), banned: ['a', 'b', 'c'] }, EIGHT)).toEqual(['a', 'b'])
    const plus = joinPlus(two, 1)
    expect(banVerdict(plus, EIGHT, 'e')).toBe('ok')
  })

  it('never leave fewer than six categories in play', () => {
    const plus = ban(joinPlus(NEW_PROFILE, 1), SEVEN, 'a')
    expect(banVerdict(plus, SEVEN, 'b')).toBe('floor')
    expect(bannedOf({ ...plus, banned: ['a', 'b'] }, SEVEN)).toEqual(['a'])
  })

  it('stop at six bans for Premium', () => {
    const owned = 'abcdefghijklmn'.split('')
    let plus = joinPlus(NEW_PROFILE, 1)
    for (const id of 'abcdef') plus = ban(plus, owned, id)
    expect(bannedOf(plus, owned)).toEqual(['a', 'b', 'c', 'd', 'e', 'f'])
    expect(banVerdict(plus, owned, 'g')).toBe('max')
  })

  it('fall back to the bonuses bans when Premium is gone', () => {
    const plus: Profile = { ...filtered(1), plusSince: 1, banned: ['a', 'b'] }
    expect(bannedOf({ ...plus, plusSince: 0 }, SEVEN)).toEqual(['a'])
    expect(bannedOf({ ...NEW_PROFILE, banned: ['a'] }, SEVEN)).toEqual([])
  })

  it('forget a category no longer owned', () => {
    expect(bannedOf({ ...filtered(1), banned: ['z', 'a'] }, SEVEN)).toEqual(['a'])
  })
})

describe('reveals', () => {
  const DAY = '2026-10-09'
  const NEXT = '2026-10-10'
  const withBonuses = (count: number): Profile => ({ ...NEW_PROFILE, bonuses: Array(count).fill('reveal') })

  it('are two a day to begin with', () => {
    expect(revealsLeft(NEW_PROFILE, DAY)).toBe(BASE_REVEALS)
    let profile = NEW_PROFILE
    for (let i = 0; i < BASE_REVEALS + 2; i++) profile = spendReveal(profile, DAY)
    expect(profile.revealsUsed).toBe(BASE_REVEALS)
    expect(revealsLeft(profile, DAY)).toBe(0)
  })

  it('come back with the next day', () => {
    const spent = spendReveal(spendReveal(NEW_PROFILE, DAY), DAY)
    expect(revealsLeft(spent, NEXT)).toBe(BASE_REVEALS)
    expect(spendReveal(spent, NEXT)).toMatchObject({ revealDay: NEXT, revealsUsed: 1 })
  })

  it('grow by one per reveal bonus, three at most', () => {
    expect(revealsLeft(withBonuses(2), DAY)).toBe(BASE_REVEALS + 2)
    expect(revealsLeft(withBonuses(4), DAY)).toBe(BASE_REVEALS + REVEAL_BONUS_MAX)
  })

  it('grow by two per ad, three a day, and the ads restart with the day', () => {
    let profile = NEW_PROFILE
    for (let i = 0; i < REVEAL_ADS_MAX + 2; i++) profile = grantRevealAd(profile, DAY)
    expect(profile.revealAds).toBe(REVEAL_ADS_MAX)
    expect(revealAdsLeft(profile, DAY)).toBe(0)
    expect(revealsLeft(profile, DAY)).toBe(BASE_REVEALS + REVEALS_PER_AD * REVEAL_ADS_MAX)
    expect(revealAdsLeft(profile, NEXT)).toBe(REVEAL_ADS_MAX)
    expect(revealsLeft(profile, NEXT)).toBe(BASE_REVEALS)
  })

  it('top out at eleven', () => {
    let profile = withBonuses(3)
    for (let i = 0; i < REVEAL_ADS_MAX; i++) profile = grantRevealAd(profile, DAY)
    expect(revealsLeft(profile, DAY)).toBe(REVEALS_MAX)
    expect(REVEALS_MAX).toBe(11)
  })

  it('never run out for Premium, who watches no ad', () => {
    const plus = joinPlus(NEW_PROFILE, 1)
    expect(revealsLeft(plus, DAY)).toBe(Infinity)
    expect(spendReveal(plus, DAY)).toBe(plus)
    expect(revealAdsLeft(plus, DAY)).toBe(0)
    expect(grantRevealAd(plus, DAY)).toBe(plus)
  })
})

describe('plusThanksDue', () => {
  it('thanks a new Premium member once', () => {
    expect(plusThanksDue(NEW_PROFILE)).toBe(false)
    const plus = joinPlus(NEW_PROFILE, 1)
    expect(plusThanksDue(plus)).toBe(true)
    expect(plusThanksDue(markPlusThanked(plus))).toBe(false)
  })

  it('ne remercie pas un compte servi par la table des fonctionnalités', () => {
    // Il n'a rien acheté : la page dit « offert », l'accueil ne le remercie pas.
    expect(plusThanksDue(grantPlus(NEW_PROFILE, true))).toBe(false)
  })
})

describe('grantPlus', () => {
  it('ouvre les avantages sans dater un achat', () => {
    expect(isPlus(NEW_PROFILE)).toBe(false)
    const granted = grantPlus(NEW_PROFILE, true)
    expect(isPlus(granted)).toBe(true)
    expect(granted.plusSince).toBe(0)
  })

  it('se reprend, et ne touche pas un profil déjà dans cet état', () => {
    const granted = grantPlus(NEW_PROFILE, true)
    expect(isPlus(grantPlus(granted, false))).toBe(false)
    expect(grantPlus(NEW_PROFILE, false)).toBe(NEW_PROFILE)
    expect(grantPlus(granted, true)).toBe(granted)
  })
})

describe('feedbackDue', () => {
  it('asks after ten runs, then every thirty', () => {
    expect(feedbackDue({ ...NEW_PROFILE, runs: 9 })).toBe(false)
    const ten = { ...NEW_PROFILE, runs: 10 }
    expect(feedbackDue(ten)).toBe(true)
    const asked = markFeedbackAsked(ten)
    expect(feedbackDue({ ...asked, runs: 39 })).toBe(false)
    expect(feedbackDue({ ...asked, runs: 40 })).toBe(true)
  })
})

describe('hiddenAnswers', () => {
  const pack = buildWordPack(
    'animaux',
    'ABCDEFGHIJLMNOPRSTV'.split('').flatMap((letter) => [
      [`${letter}chat`, 90, 1] as const,
      [`${letter}rare`, 1, 1] as const,
    ]),
  )
  const judge: Judge = {
    find: (_, word) => findWord(pack, word),
    usage: () => NO_USAGE,
    known: () => 2,
    letters: () => lettersWithEnough(pack, 1),
    common: (_, letter, played) => commonWord(pack, letter, played),
  }

  it('names the best-known word of each skipped prompt, once', () => {
    let run = createRun({ seed: 3, categoryIds: ['animaux'] }, judge)
    const first = run.prompt
    run = skip(run, judge)
    run = submit(run, `${run.prompt.letter}chat`, judge).run
    const answers = hiddenAnswers(run, judge)
    expect(answers).toHaveLength(1)
    expect(answers[0]!.prompt).toEqual(first)
    expect(answers[0]!.display.toLowerCase()).toBe(`${first.letter}chat`.toLowerCase())
  })

  it('names a word whose spelling is its own key, which is what a flag sends', () => {    let run = createRun({ seed: 3, categoryIds: ['animaux'] }, judge)
    run = skip(run, judge)
    run = submit(run, `${run.prompt.letter}chat`, judge).run
    // Le récap signale un mot caché par sa clé (`WordEntry.key`, celle d'une
    // réponse jouée) : sa forme repliée doit être cette clé, sinon un ban
    // viserait une autre ligne du dictionnaire que celle qu'on lit.
    const [answer] = hiddenAnswers(run, judge)
    const entry = [...pack.entries.values()].find((candidate) => candidate.display === answer!.display)
    expect(entry?.key).toBe(normalizeWord(answer!.display))
  })

  it('asks the judge for a rare word under Professeur', () => {
    const asked: (boolean | undefined)[] = []
    const professing: Judge = {
      ...judge,
      suggest: (_, letter, played, rare) => {
        asked.push(rare)
        return commonWord(pack, letter, played)
      },
    }
    let run = createRun({ seed: 3, categoryIds: ['animaux'], powers: ['professor'] }, professing)
    run = skip(run, professing)
    run = submit(run, `${run.prompt.letter}chat`, professing).run
    expect(hiddenAnswers(run, professing)).toHaveLength(1)
    expect(asked).toEqual([true])
  })

})

describe('learnFromProfessor', () => {
const pack = buildWordPack(
'animaux',
[['Achat', 90, 1] as const],
)
const judge: Judge = {
find: (_, word) => findWord(pack, word),
usage: () => NO_USAGE,
known: () => 2,
letters: () => lettersWithEnough(pack, 1),
common: (_, letter, played) => commonWord(pack, letter, played),
}
const professing = createRun({ seed: 1, categoryIds: ['animaux'], powers: ['professor'] }, judge)

it('marque le mot repris, qui compte une fois, sans changer ce qu’il paie', () => {
const plain = submit(professing, 'Achat', judge, 3)
const marked = submit({ ...professing, taught: ['achat'] }, 'Achat', judge, 3)

expect(marked.verdict.found!.taught).toBe(true)
expect(plain.verdict.found!.taught).toBe(false)
expect(marked.verdict.found!.points).toBe(plain.verdict.found!.points)

const learned = learnFromProfessor(NEW_PROFILE, marked.run, judge)
expect(learned.professorWordsPlayed).toBe(1)
expect(learned.professorWords).toEqual([])
})

it('ne retient que ce que le Professeur a proposé', () => {
const without = createRun({ seed: 1, categoryIds: ['animaux'] }, judge)
const learned = learnFromProfessor(NEW_PROFILE, skip(without, judge), judge)

expect(learned.professorWords).toEqual([])
expect(learned.professorWordsPlayed).toBe(0)
})
})

describe('shareNewsDue', () => {
  it('tells a named account at once, anyone else from the fifteenth run, and only once', () => {
    expect(shareNewsDue(NEW_PROFILE, true, false)).toBe(true)
    expect(shareNewsDue({ ...NEW_PROFILE, runs: 14 }, false, false)).toBe(false)
    expect(shareNewsDue({ ...NEW_PROFILE, runs: 15 }, false, false)).toBe(true)
    expect(shareNewsDue({ ...NEW_PROFILE, runs: 40 }, true, true)).toBe(false)
  })
})

describe('what Premium brought', () => {
  const DAY = '2026-10-09'
  const NEXT = '2026-10-10'
  const plus = joinPlus(NEW_PROFILE, 1)

  it('counts nothing for a free player', () => {
    expect(countPlusReveal(NEW_PROFILE, DAY)).toBe(NEW_PROFILE)
    expect(countPlusAttempt(NEW_PROFILE, 4)).toBe(NEW_PROFILE)
    expect(countPlusAdSkipped(NEW_PROFILE)).toBe(NEW_PROFILE)
    expect(countPlusRun(NEW_PROFILE, { filtersActive: 6, premiereDealt: true })).toBe(NEW_PROFILE)
  })

  it('counts a reveal only past the free allowance, and an ad skipped while an ad could have paid', () => {
    let profile = plus
    for (let i = 0; i < BASE_REVEALS; i++) profile = countPlusReveal(profile, DAY)
    expect(plusStat(profile, 'reveals')).toBe(0)
    profile = countPlusReveal(profile, DAY)
    expect(plusStat(profile, 'reveals')).toBe(1)
    expect(plusStat(profile, 'adsSkipped')).toBe(1)
    for (let i = 0; i < REVEAL_ADS_MAX + 1; i++) profile = countPlusReveal(profile, DAY)
    expect(plusStat(profile, 'adsSkipped')).toBe(REVEAL_ADS_MAX)
    expect(plusStat(countPlusReveal(profile, NEXT), 'reveals')).toBe(plusStat(profile, 'reveals'))
  })

  it('counts the weekly attempts past the free one, the second sparing an ad', () => {
    expect(countPlusAttempt(plus, 1)).toBe(plus)
    const second = countPlusAttempt(plus, 2)
    expect(plusStat(second, 'attempts')).toBe(1)
    expect(plusStat(second, 'adsSkipped')).toBe(1)
    expect(plusStat(countPlusAttempt(second, 3), 'adsSkipped')).toBe(1)
    expect(plusStat(countPlusAttempt(second, 3), 'attempts')).toBe(2)
  })

  it('counts runs with more filters than the free maximum, and runs that dealt a preview', () => {
    const run = countPlusRun(plus, { filtersActive: 3, premiereDealt: true })
    expect(plusStat(run, 'filterRuns')).toBe(1)
    expect(plusStat(run, 'premiereRuns')).toBe(1)
    expect(countPlusRun(plus, { filtersActive: 2, premiereDealt: false })).toBe(plus)
  })
})

describe('the news a delivery brings', () => {
  it('announces a shipped preview once, and again for every new one', () => {
    const available = ['pays', 'ingredients', 'lieux']
    expect(premiereNews([], available)).toEqual(['ingredients', 'lieux'])
    expect(premiereNews(['ingredients'], available)).toEqual(['lieux'])
    expect(premiereNews(['ingredients', 'lieux'], available)).toEqual([])
    // Sans dictionnaire livré pour la langue, rien à annoncer.
    expect(premiereNews([], ['pays', 'sports'])).toEqual([])
  })

  it('offers Premium to the week first, once, and never to a member', () => {
    expect(weeklyWinPrizeDue(NEW_PROFILE, 1, false)).toBe(true)
    expect(weeklyWinPrizeDue(NEW_PROFILE, 2, false)).toBe(false)
    expect(weeklyWinPrizeDue(NEW_PROFILE, null, false)).toBe(false)
    expect(weeklyWinPrizeDue(NEW_PROFILE, 1, true)).toBe(false)
    expect(weeklyWinPrizeDue(joinPlus(NEW_PROFILE, 1), 1, false)).toBe(false)
  })
})

describe('reveals a version gives away', () => {
  it('opens every reveal where the host says so, without touching the counters', () => {
    const budget = revealBudget(NEW_PROFILE, '2026-10-13', true)
    expect(budget.unlimited).toBe(true)
    expect(revealBudget(NEW_PROFILE, '2026-10-13').unlimited).toBe(false)
  })
})
