import { describe, expect, it } from 'vitest'
import { rowToGame, rowToSession } from './supabaseStore'

describe('rowToGame', () => {
  it('turns a database row into a game', () => {
    expect(
      rowToGame({ id: 'g1', player: 'jon', tickets: 70, cents: 100, created_at: '2026-09-25T18:00:00Z' }),
    ).toEqual({ id: 'g1', player: 'jon', tickets: 70, cents: 100, createdAt: Date.parse('2026-09-25T18:00:00Z'), sessionId: null, machineId: null })
  })
})

describe('rowToSession', () => {
  it('keeps an open session without end date', () => {
    expect(rowToSession({ id: 's', started_at: '2026-09-25T18:00:00Z', ended_at: null })).toEqual({
      id: 's',
      startedAt: Date.parse('2026-09-25T18:00:00Z'),
      endedAt: null,
    })
  })
})
