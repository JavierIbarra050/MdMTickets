import { describe, expect, it } from 'vitest'
import { chase, currentSession, gamesOf, machineStats, overtakers, ranking, summarize, totals, type Game } from './domain'

const game = (tickets: number, cents: number, player: Game['player'] = 'jon'): Game => ({
  id: `${player}-${tickets}-${cents}`,
  player,
  tickets,
  cents,
  createdAt: 0,
})

describe('totals', () => {
  it('adds tickets and money and computes tickets per euro', () => {
    expect(totals([game(70, 100), game(30, 100)])).toEqual({ tickets: 100, cents: 200, ratio: 50 })
  })

  it('has no ratio when nothing was spent', () => {
    expect(totals([game(10, 0)]).ratio).toBeNull()
  })
})

describe('gamesOf', () => {
  it('keeps only the games of that player', () => {
    expect(gamesOf([game(1, 1, 'jon'), game(2, 2, 'alej')], 'alej')).toEqual([game(2, 2, 'alej')])
  })
})

describe('ranking', () => {
  const players: Game['player'][] = ['alej', 'jon', 'gabriel']
  const day = new Date('2026-09-25T18:00:00').getTime()
  const at = (g: Game, createdAt: number): Game => ({ ...g, createdAt })

  it('orders players from highest to lowest value', () => {
    const rows = ranking([at(game(50, 100, 'jon'), day), at(game(80, 200, 'gabriel'), day)], players, 'tickets', 'all', day)
    expect(rows.map((r) => r.player)).toEqual(['gabriel', 'jon', 'alej'])
  })

  it('puts players without spending last when ranking by ratio', () => {
    const rows = ranking([at(game(10, 100, 'alej'), day)], players, 'ratio', 'all', day)
    expect(rows.map((r) => r.value)).toEqual([10, null, null])
  })

  it('counts only games from the same day when the period is today', () => {
    const yesterday = day - 24 * 3600 * 1000
    const rows = ranking([at(game(90, 100, 'alej'), yesterday), at(game(20, 100, 'alej'), day)], players, 'tickets', 'today', day)
    expect(rows[0].value).toBe(20)
  })
})

describe('chase', () => {
  const row = (player: Game['player'], value: number | null) => ({ player, value, totals: { tickets: 0, cents: 0, ratio: null } })

  it('says how much is missing to pass the player ahead', () => {
    expect(chase([row('jon', 300), row('alej', 120)], 'alej')).toEqual({ kind: 'behind', ahead: 'jon', diff: 180 })
  })

  it('knows when you lead', () => {
    expect(chase([row('alej', 300), row('jon', 120)], 'alej')).toEqual({ kind: 'first' })
  })

  it('knows when you have no value yet', () => {
    expect(chase([row('jon', 5), row('alej', null)], 'alej')).toEqual({ kind: 'out' })
  })
})

describe('sessions', () => {
  const inSession = (g: Game, sessionId: string | null): Game => ({ ...g, sessionId })

  it('ranks only the games of the chosen session', () => {
    const games = [inSession(game(90, 100, 'alej'), 'old'), inSession(game(20, 100, 'jon'), 'now')]
    const rows = ranking(games, ['alej', 'jon'], 'tickets', 'session', 0, 'now')
    expect(rows[0]).toMatchObject({ player: 'jon', value: 20 })
  })

  it('prefers the open session over the latest closed one', () => {
    const open = { id: 'a', startedAt: 1, endedAt: null }
    expect(currentSession([{ id: 'b', startedAt: 5, endedAt: 6 }, open])).toBe(open)
  })

  it('falls back to the latest closed session', () => {
    expect(currentSession([{ id: 'x', startedAt: 1, endedAt: 2 }, { id: 'y', startedAt: 3, endedAt: 4 }])?.id).toBe('y')
  })

  it('summarizes winner, totals and best game of a session', () => {
    const best = inSession(game(300, 200, 'jon'), 's')
    const games = [inSession(game(100, 100, 'alej'), 's'), inSession(game(150, 100, 'jon'), 's'), best, inSession(game(999, 100, 'alej'), 'other')]
    expect(summarize(games, 's', ['alej', 'jon'])).toEqual({ games: 3, tickets: 550, cents: 400, winner: 'jon', best })
  })

  it('has no winner when nobody played', () => {
    expect(summarize([], 's', ['alej']).winner).toBeNull()
  })
})

describe('overtakers', () => {
  const rows = (...players: Game['player'][]) => players.map((player) => ({ player, value: 0, totals: { tickets: 0, cents: 0, ratio: null } }))

  it('finds who passed me', () => {
    expect(overtakers(rows('alej', 'jon', 'gabriel'), rows('gabriel', 'alej', 'jon'), 'jon')).toEqual(['gabriel'])
  })

  it('ignores players that were already ahead', () => {
    expect(overtakers(rows('alej', 'jon'), rows('alej', 'jon'), 'jon')).toEqual([])
  })
})

describe('machineStats', () => {
  const on = (g: Game, machineId: string | null): Game => ({ ...g, machineId })

  it('orders machines by tickets per euro', () => {
    const stats = machineStats([on(game(50, 100), 'a'), on(game(90, 100), 'b'), on(game(30, 100), 'a')])
    expect(stats.map((m) => [m.machineId, m.games, m.totals.ratio])).toEqual([
      ['b', 1, 90],
      ['a', 2, 40],
    ])
  })

  it('ignores games without machine', () => {
    expect(machineStats([on(game(50, 100), null)])).toEqual([])
  })
})
