import { describe, expect, it } from 'vitest'
import { budgetStatus, worsened } from './budget'

describe('budgetStatus', () => {
  it('says how much is left', () => {
    expect(budgetStatus(450, 1000)).toEqual({ leftCents: 550, used: 0.45, level: 'ok' })
  })

  it('warns from 80 % of the budget', () => {
    expect(budgetStatus(800, 1000).level).toBe('warn')
  })

  it('knows when you went over', () => {
    expect(budgetStatus(1050, 1000)).toMatchObject({ leftCents: -50, level: 'over' })
  })

  it('spending exactly the budget is not going over', () => {
    expect(budgetStatus(1000, 1000).level).toBe('warn')
  })
})

describe('worsened', () => {
  it('reports only when the level gets worse', () => {
    expect(worsened('ok', 'warn')).toBe('warn')
    expect(worsened('warn', 'warn')).toBeNull()
    expect(worsened('over', 'ok')).toBeNull()
  })
})
