import { describe, expect, it } from 'vitest'
import { chase, gamesOf, ranking, totals, type Game } from './domain'

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
