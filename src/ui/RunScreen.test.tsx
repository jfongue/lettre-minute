import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { MessagesContext, messagesFor } from '../i18n'
import { createRun, type Judge, type Verdict } from '../domain/run'
import { NO_USAGE } from '../domain/rarity'
import { buildWordPack, findWord, lettersWithEnough, type WordPack } from '../domain/words'
import { RunScreen } from './RunScreen'

const LETTERS = 'ABCDEFGHIJLMNOPRSTV'.split('')
const PER_LETTER = 12

const animals: WordPack = buildWordPack(
  'animaux',
  LETTERS.flatMap((letter) => Array.from({ length: PER_LETTER }, (_, i) => `${letter}nimal${i}`)).map(
    (word) => [word, 50, 1] as const,
  ),
)

const judge: Judge = {
  find: (categoryId, word) => (categoryId === 'animaux' ? findWord(animals, word) : null),
  usage: () => NO_USAGE,
  known: () => PER_LETTER,
  letters: (categoryId) => (categoryId === 'animaux' ? lettersWithEnough(animals, PER_LETTER) : []),
}

function htmlOf(live: Verdict | null): string {
  const t = messagesFor('fr')
  const run = createRun({ seed: 1, categoryIds: ['animaux'] }, judge)
  return renderToStaticMarkup(
    <MessagesContext.Provider value={t}>
      <RunScreen
        run={run}
        draft=""
        live={live}
        cheer={null}
        remaining={30}
        hushed={false}
        next={null}
        proposed={[]}
        onType={() => undefined}
        onSubmit={() => undefined}
        onSkip={() => undefined}
        onReroll={() => undefined}
        onRecall={() => undefined}
        onPropose={() => undefined}
      />
    </MessagesContext.Provider>,
  )
}

// The verdict is the only line that says what the run just did: a screen reader
// must hear it. The container holding it has to survive the cheer's remounts,
// so the live region lives outside the line itself.
describe('RunScreen', () => {
  it('tient le verdict dans une région annoncée, quel qu’il soit', () => {
    for (const live of [null, { kind: 'wrong-letter', found: null } as Verdict]) {
      expect(htmlOf(live)).toMatch(/<div aria-live="polite">\s*<p class="verdict/)
    }
  })

  it('annonce aussi le gain d’un mot trouvé', () => {
    expect(htmlOf({ kind: 'accepted', found: null })).toMatch(/<div aria-live="polite">\s*<p class="verdict/)
  })
})
