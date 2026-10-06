import { describe, expect, it } from 'vitest'
import { MODERATOR_LEVEL, MODERATOR_LEVEL_XP, queueAlertDue, reachesModeratorLevel, swipeVerdict } from './moderation'
import { levelFor, xpForLevel } from './progression'

describe('moderator level', () => {
  it('matches the XP the server checks before offering', () => {
    expect(xpForLevel(MODERATOR_LEVEL)).toBe(MODERATOR_LEVEL_XP)
  })

  it('is reached exactly at the level', () => {
    expect(reachesModeratorLevel(MODERATOR_LEVEL_XP - 1)).toBe(false)
    expect(reachesModeratorLevel(MODERATOR_LEVEL_XP)).toBe(true)
    expect(levelFor(MODERATOR_LEVEL_XP)).toBe(MODERATOR_LEVEL)
  })
})

describe('swipeVerdict', () => {
  it('reads a swipe right as correct and left as incorrect', () => {
    expect(swipeVerdict(150, 10, 300)).toBe('correct')
    expect(swipeVerdict(-150, 10, 300)).toBe('incorrect')
  })

  it('reads a swipe up as unsure', () => {
    expect(swipeVerdict(20, -150, 300)).toBe('unsure')
  })

  it('means nothing until it has travelled far enough', () => {
    expect(swipeVerdict(60, -60, 300)).toBeNull()
    expect(swipeVerdict(0, 200, 300)).toBeNull()
  })

  it('lets the longer direction win', () => {
    expect(swipeVerdict(200, -120, 300)).toBe('correct')
    expect(swipeVerdict(-120, -200, 300)).toBe('unsure')
  })
})

describe('queueAlertDue', () => {
  it('shows a full queue, until opened that day', () => {
    expect(queueAlertDue(19, null, '2026-09-30')).toBe(false)
    expect(queueAlertDue(20, null, '2026-09-30')).toBe(true)
    expect(queueAlertDue(20, '2026-09-30', '2026-09-30')).toBe(false)
    expect(queueAlertDue(20, '2026-09-30', '2026-10-01')).toBe(true)
  })
})
