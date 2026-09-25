import { describe, expect, it } from 'vitest'
import { rowToGame } from './supabaseStore'

describe('rowToGame', () => {
  it('turns a database row into a game', () => {
    expect(
      rowToGame({ id: 'g1', player: 'jon', tickets: 70, cents: 100, created_at: '2026-09-25T18:00:00Z' }),
    ).toEqual({ id: 'g1', player: 'jon', tickets: 70, cents: 100, createdAt: Date.parse('2026-09-25T18:00:00Z') })
  })
})
