import { describe, expect, it } from 'vitest'
import { achievements, newlyUnlocked } from './achievements'
import type { Game, PlayerId, Session } from './domain'

let clock = 0
const game = (player: PlayerId, tickets: number, cents: number, extra: Partial<Game> = {}): Game => ({
  id: `g${++clock}`,
  player,
  tickets,
  cents,
  createdAt: clock,
  ...extra,
})
const has = (games: Game[], player: PlayerId, sessions: Session[] = []) => achievements(games, sessions).get(player) ?? new Set()
const closed: Session = { id: 's', startedAt: 0, endedAt: 999 }

describe('achievements', () => {
  it('jackpot needs a single game of 200 tickets', () => {
    expect(has([game('jon', 200, 100)], 'jon').has('jackpot')).toBe(true)
    expect(has([game('jon', 199, 100)], 'jon').has('jackpot')).toBe(false)
  })

  it('francotirador needs 5 games in a row at 70 tickets per euro', () => {
    const five = Array.from({ length: 5 }, () => game('jon', 70, 100))
    expect(has(five, 'jon').has('francotirador')).toBe(true)
  })

  it('a bad game breaks the francotirador streak', () => {
    const broken = [...Array.from({ length: 4 }, () => game('jon', 70, 100)), game('jon', 10, 100), game('jon', 70, 100)]
    expect(has(broken, 'jon').has('francotirador')).toBe(false)
  })

  it('mecenas goes to who spent most in a finished session', () => {
    const games = [game('jon', 1, 500, { sessionId: 's' }), game('alej', 1, 100, { sessionId: 's' })]
    expect(has(games, 'jon', [closed]).has('mecenas')).toBe(true)
    expect(has(games, 'alej', [closed]).has('mecenas')).toBe(false)
  })

  it('mecenas waits until the session ends', () => {
    const open = { ...closed, endedAt: null }
    expect(has([game('jon', 1, 500, { sessionId: 's' })], 'jon', [open]).has('mecenas')).toBe(false)
  })

  it('remontada rewards winning a session after being last', () => {
    const games = [
      game('alej', 50, 100, { sessionId: 's' }),
      game('jon', 40, 100, { sessionId: 's' }),
      game('gabriel', 5, 100, { sessionId: 's' }),
      game('gabriel', 300, 100, { sessionId: 's' }),
    ]
    expect(has(games, 'gabriel', [closed]).has('remontada')).toBe(true)
    expect(has(games, 'alej', [closed]).has('remontada')).toBe(false)
  })

  it('fiel needs 10 games on the same machine', () => {
    const loyal = Array.from({ length: 10 }, () => game('jon', 1, 100, { machineId: 'm' }))
    expect(has(loyal, 'jon').has('fiel')).toBe(true)
    expect(has(loyal.slice(1), 'jon').has('fiel')).toBe(false)
  })

  it('madrugador goes to the first game of a session', () => {
    const games = [game('alej', 1, 100, { sessionId: 's' }), game('jon', 1, 100, { sessionId: 's' })]
    expect(has(games, 'alej', [closed]).has('madrugador')).toBe(true)
    expect(has(games, 'jon', [closed]).has('madrugador')).toBe(false)
  })
})

describe('newlyUnlocked', () => {
  it('lists only achievements that were not there before', () => {
    const before = new Map([['jon' as PlayerId, new Set(['jackpot' as const])]])
    const after = new Map([['jon' as PlayerId, new Set(['jackpot' as const, 'fiel' as const])]])
    expect(newlyUnlocked(before, after)).toEqual([['jon', 'fiel']])
  })
})
