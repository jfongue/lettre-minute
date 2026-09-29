import { beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * `fetchMyRuns` relit les parties du compte : celles poussées depuis 0033
 * portent leur relevé, les plus anciennes n'ont que leurs mots. Il doit tenir
 * les deux, et retomber sur les mots quand `record` n'existe pas encore.
 */
const fixture = vi.hoisted(() => {
  const record = {
    at: Date.parse('2026-09-29T11:00:00.000Z'),
    lang: 'fr',
    score: 42,
    bestCombo: 3,
    skips: 1,
    categoryIds: ['pays'],
    words: [{ categoryId: 'pays', word: 'chili', display: 'Chili', points: 20, seconds: 4 }],
  }
  const legacy = {
    id: 'run-2',
    created_at: '2026-09-29T09:07:55.956565+00:00',
    score: 20,
    best_combo: 2,
    skips: 0,
    run_words: [{ word: 'de:katze', category_id: 'de:animaux', points: 10 }],
  }
  return {
    record,
    legacy,
    rows: [{ id: 'run-1', created_at: '2026-09-29T10:00:00.000000+00:00', score: 42, best_combo: 3, skips: 1, record, run_words: [] }, legacy],
    migrated: { current: true },
  }
})

vi.mock('./supabase', () => ({
  supabase: {
    from: () => ({
      select: (columns: string) => {
        // La colonne `record` date de 0033 : sans elle, le serveur la refuse.
        const missing = columns.includes('record') && !fixture.migrated.current
        const rows = fixture.migrated.current
          ? fixture.rows
          : fixture.rows.map((row) => {
              const { record: _dropped, ...rest } = row as { record?: unknown }
              return rest
            })
        const answer = missing ? { data: null, error: { message: 'column runs.record does not exist' } } : { data: rows, error: null }
        const chain = {
          eq: () => chain,
          order: () => chain,
          gte: () => chain,
          limit: () => chain,
          then: (resolve: (value: unknown) => unknown) => resolve(answer),
        }
        return chain
      },
    }),
  },
  connect: () => Promise.resolve({ userId: 'player-1' }),
  forgetSession: () => {},
  cloudConfigured: () => true,
}))

const cloud = await import('./cloud')

describe('fetchMyRuns', () => {
  beforeEach(() => {
    fixture.migrated.current = true
  })

  it('reads a run whole from its record, and recomposes the ones kept as words only', async () => {
    const runs = await cloud.fetchMyRuns()
    expect(runs).toHaveLength(2)
    expect(runs?.[0]).toEqual(fixture.record)
    expect(runs?.[1]).toEqual({
      at: Date.parse(fixture.legacy.created_at),
      lang: 'de',
      score: 20,
      bestCombo: 2,
      skips: 0,
      categoryIds: ['animaux'],
      words: [{ categoryId: 'animaux', word: 'katze', display: 'katze', points: 10 }],
    })
  })

  it('still answers when the project has not applied 0033', async () => {
    fixture.migrated.current = false
    const runs = await cloud.fetchMyRuns()
    // Les deux se recomposent alors de leurs mots : celle du relevé n'en a aucun.
    expect(runs?.map((run) => [run.score, run.words.length])).toEqual([
      [42, 0],
      [20, 1],
    ])
  })
})
