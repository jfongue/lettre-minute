"""Turns a fresh worktree of the game into the promo build: no server, fake
moderation and boards, a seeded level-14 profile, a fixed seed, no keyboard.
Never committed to the game: run it in a throwaway worktree (see ../README.md)."""
import re, sys
root = sys.argv[1]

def edit(path, pairs):
    p = f'{root}/{path}'; s = open(p).read()
    for old, new in pairs:
        assert old in s, f'{path}: {old[:60]!r}'
        s = s.replace(old, new, 1)
    open(p, 'w').write(s)

FAKES = '''
// PROMO BUILD: fake answers, nothing ever written to a server.
const PROMO_AV = (design: number, ground: string, shape: string, accent: string) => ({ design, ground, shape, accent }) as AvatarChoice
const PROMO_BOARD: BoardRow[] = [
  { name: 'Léa', avatar: PROMO_AV(12, 'rouge', 'creme', 'jaune'), value: 2315 },
  { name: 'Tom', avatar: PROMO_AV(31, 'jaune', 'noir', 'rouge'), value: 2140 },
  { name: 'Camille', avatar: PROMO_AV(64, 'rose', 'noir', 'jaune'), value: 1980 },
  { name: 'Nino', avatar: PROMO_AV(5, 'bleu', 'creme', 'rouge'), value: 1720 },
  { name: 'Sacha', avatar: PROMO_AV(88, 'noir', 'jaune', 'rouge'), value: 1505 },
]
const PROMO_CARDS: ReviewCard[] = [
  ['animaux', 'ptérodactyle', 4], ['couleurs', 'bleu canard', 7], ['fruits-legumes', 'pitaya', 3], ['sports', 'padel', 9], ['couleurs', 'caca d’oie', 2],
].map(([categoryId, display, proposals], index) => ({ id: `promo-${index}`, categoryId: categoryId as string, display: display as string, proposals: proposals as number, special: false, note: null, canRespell: false, friends: index === 1 ? ['Léa'] : [] }))
'''
s = open(f'{root}/src/lib/cloud.ts').read()
s = s.replace('\n/**\n * Every call here answers with a fallback', FAKES + '\n/**\n * Every call here answers with a fallback', 1)
for fn, ret in [
    ('fetchModerationStatus', "{ moderator: true, super: false, validated: 12, queue: 5, waiting: 5, offer: null, invitedBy: null, news: 0 }"),
    ('fetchModerationQueue', 'PROMO_CARDS'),
    ('castVote', "(verdict === 'incorrect' ? 'rejected' : 'accepted') as VoteOutcome"),
    ('topUpModeration', '0'),
    ('fetchBoards', "{ day: PROMO_BOARD, week: PROMO_BOARD, discoveries: PROMO_BOARD.map((row) => ({ ...row, value: Math.round(row.value / 150) })) }"),
]:
    i = s.index(f'export function {fn}(')
    m = re.compile(r'\{\n').search(s, s.index('Promise<', i))
    s = s[:m.end()] + f'  if (import.meta.env.VITE_PROMO) return Promise.resolve({ret})\n' + s[m.end():]
open(f'{root}/src/lib/cloud.ts', 'w').write(s)

edit('src/main.tsx', [("import './styles.css'\n", """import './styles.css'
import { NEW_PROFILE, xpForLevel } from './domain/progression'
import { unlockEverything } from './domain/unlocks'

if (import.meta.env.VITE_PROMO) {
  if (!localStorage.getItem('lettre-minute.profile.v1')) {
    const profile = unlockEverything({ ...NEW_PROFILE, xp: xpForLevel(14) + 120, runs: 57, bestScore: 2480, wordsFound: 1310, bestCombo: 9, equipped: [], banIntroSeen: 1, supportAskedAt: 57, feedbackAskedAt: 57 })
    localStorage.setItem('lettre-minute.profile.v1', JSON.stringify(profile))
    localStorage.setItem('lettre-minute.tutorial.v1', 'true')
    localStorage.setItem('lettre-minute.quiet-sign-in.v1', 'true')
    localStorage.setItem('lettre-minute.locale.v1', 'fr')
    localStorage.setItem('lettre-minute.share-news.v1', 'true')
  }
  // The filmed screen keeps its keyboard out of the picture; adb types all the same.
  new MutationObserver(() => document.querySelectorAll('input, textarea').forEach((field) => field.setAttribute('inputmode', 'none')))
    .observe(document.documentElement, { childList: true, subtree: true })
}
""")])
s = open(f'{root}/src/App.tsx').read()
i = s.index('const play = useCallback')
j = s.index('const seed = Date.now() >>> 0', i)
s = s[:j] + 'const seed = import.meta.env.VITE_PROMO ? 42 : Date.now() >>> 0' + s[j + len('const seed = Date.now() >>> 0'):]
open(f'{root}/src/App.tsx', 'w').write(s)
edit('src/state/session.ts', [('const avoid = challenge ? [] : session.profile.lastPrompts', 'const avoid = challenge || import.meta.env.VITE_PROMO ? [] : session.profile.lastPrompts')])
edit('android/app/build.gradle', [('applicationId "fr.lettreminute.app"', 'applicationId "fr.lettreminute.promo" + (System.getenv("PROMO_SUFFIX") ?: "")')])
print('promo build ready')
