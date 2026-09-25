import { describe, expect, it } from 'vitest'
import { gamesOf, totals, type Game } from './domain'

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
