import type { ChallengeWord } from '../../../src/domain/challenge'

/**
 * What a daily post carries in its `postData` (2 KB at most): enough for the
 * splash to paint the day without a request, and for the game to deal it.
 */
export type DailyPostData = {
  day: string
  lang: string
  number: number
  categories: string[]
}

export type BoardRow = {
  name: string
  score: number
}

/** A reader's counted game of the day, as the server keeps it. */
export type DailyResult = {
  score: number
  words: ChallengeWord[]
  skips: number
  bestCombo: number
}

export type Standing = {
  /** 1 for the best score of the post. */
  rank: number
  /** Readers who played this post. */
  total: number
  /** Keys (`categoryId:key`) of the reader's words that nobody else on the post found so far. */
  unique: string[]
  /** Days in a row the reader played the day's post; 0 when the post is not today's. */
  streak: number
}

export type DayResponse = {
  type: 'day'
  /** Null when the reader is logged out: they play, but nothing is kept. */
  username: string | null
  players: number
  top: BoardRow[]
  /** The reader's counted game, if they already played this post. */
  played: (DailyResult & Standing) | null
}

export type PlayRequest = DailyResult

export type PlayResponse = {
  type: 'play'
  /** False for a logged-out reader or a second game of the same post: it was shown, not kept. */
  counted: boolean
  top: BoardRow[]
  players: number
  standing: Standing | null
}

export type ShareRequest = {
  text: string
}

export type ShareResponse = {
  type: 'share'
  ok: boolean
}

export type ErrorResponse = {
  type: 'error'
  message: string
}
