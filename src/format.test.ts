import { describe, expect, it } from 'vitest'
import { eur, num } from './format'

describe('eur', () => {
  it('formats cents as euros in Spanish', () => {
    expect(eur(150)).toBe('1,50\u00a0€')
  })
})

describe('num', () => {
  it('rounds to whole tickets', () => {
    expect(num(69.6)).toBe('70')
  })
})
