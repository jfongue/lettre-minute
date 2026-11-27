import { describe, expect, it } from 'vitest'
import { channelOf, liveTransport, pollingTransport, type PollClock } from './live'

/** Une horloge à la main : les battements partent quand le test le dit. */
function fakeClock() {
  let hidden = false
  let next = 0
  const timers = new Map<number, { tick: () => void; ms: number }>()
  const clock: PollClock = {
    hidden: () => hidden,
    setInterval: (tick, ms) => {
      next += 1
      timers.set(next, { tick, ms })
      return next
    },
    clearInterval: (handle) => void timers.delete(handle as number),
  }
  return {
    clock,
    timers,
    hide: (value: boolean) => (hidden = value),
    beat: () => [...timers.values()].forEach((timer) => timer.tick()),
  }
}

describe('pollingTransport', () => {
  it('wakes the screen at the cadence it asks for, and only then', () => {
    const fake = fakeClock()
    let woken = 0
    pollingTransport(fake.clock).watch({ kind: 'duelTable', table: 't1' }, () => woken++, { every: 450 })
    expect([...fake.timers.values()].map((timer) => timer.ms)).toEqual([450])
    expect(woken).toBe(0)
    fake.beat()
    fake.beat()
    expect(woken).toBe(2)
  })

  it('stays quiet while the page is hidden', () => {
    const fake = fakeClock()
    let woken = 0
    pollingTransport(fake.clock).watch({ kind: 'duelInvites' }, () => woken++, { every: 15_000 })
    fake.hide(true)
    fake.beat()
    expect(woken).toBe(0)
    fake.hide(false)
    fake.beat()
    expect(woken).toBe(1)
  })

  it('stops for good once unsubscribed, leaving the other watches running', () => {
    const fake = fakeClock()
    const transport = pollingTransport(fake.clock)
    const woken: string[] = []
    const stopTable = transport.watch({ kind: 'duelTable', table: 't1' }, () => woken.push('table'), { every: 450 })
    transport.watch({ kind: 'duelInvites' }, () => woken.push('invites'), { every: 15_000 })
    stopTable()
    fake.beat()
    expect(woken).toEqual(['invites'])
    expect(fake.timers.size).toBe(1)
  })
})

describe('channelOf', () => {
  it('names the channels the 0121 triggers broadcast on', () => {
    expect(channelOf({ kind: 'duelTable', table: 'abc' }, null)).toBe('duel:abc')
    expect(channelOf({ kind: 'duelInvites' }, 'me')).toBe('duel-invites:me')
    expect(channelOf({ kind: 'duelInvites' }, null)).toBeNull()
  })
})

describe('liveTransport', () => {
  it('is still the polling one: Realtime waits for its own patch', () => {
    expect(liveTransport().name).toBe('polling')
  })
})
