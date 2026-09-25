import { challengeWordsOf, type ChallengeWord } from '../domain/challenge'
import { playBot } from '../domain/bot'
import { loadPacks } from '../data/packs'
import type { ChallengeDetail } from '../lib/cloud'
import { createJudge } from './judge'

/**
 * The server marks a house bot played but has no words for it: they are
 * played here from the challenge's seed, with a judge every device builds
 * alike. Until the player has played, the bot's words show only their instant
 * and points, as `challenge_detail` does for everyone else.
 */
export async function withBotRuns(detail: ChallengeDetail): Promise<ChallengeDetail> {
  if (!detail.players.some((player) => player.bot && player.playedAt !== null)) return detail
  let judge
  try {
    judge = createJudge(await loadPacks(detail.lang, detail.categoryIds), { own: {}, crowd: {} })
  } catch {
    return detail
  }
  const open = detail.finished || detail.players.some((player) => player.me && player.playedAt !== null)
  return {
    ...detail,
    players: detail.players.map((player) => {
      if (!player.bot || player.playedAt === null) return player
      const run = playBot(detail.seed, detail.categoryIds, player.playerId, judge)
      const words = challengeWordsOf(run)
      return {
        ...player,
        score: run.score,
        skips: run.skips,
        bestCombo: run.bestCombo,
        words: open ? words : words.map(hidden),
      }
    }),
  }
}

function hidden(word: ChallengeWord): ChallengeWord {
  return { ...word, categoryId: '', letter: '', key: '', display: '', tier: 'courant', approximate: false, seconds: 0 }
}
