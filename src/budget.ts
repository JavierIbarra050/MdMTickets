export type BudgetLevel = 'ok' | 'warn' | 'over'

/** Aviso a partir de este porcentaje del presupuesto gastado. */
const WARN_AT = 0.8

export interface BudgetStatus {
  leftCents: number
  used: number
  level: BudgetLevel
}

export function budgetStatus(spentCents: number, budgetCents: number): BudgetStatus {
  const used = budgetCents ? spentCents / budgetCents : 0
  return {
    leftCents: budgetCents - spentCents,
    used,
    level: spentCents > budgetCents ? 'over' : used >= WARN_AT ? 'warn' : 'ok',
  }
}

const SEVERITY: Record<BudgetLevel, number> = { ok: 0, warn: 1, over: 2 }

/** Nivel nuevo si ha empeorado; null si sigue igual o ha mejorado. */
export const worsened = (before: BudgetLevel, after: BudgetLevel): BudgetLevel | null =>
  SEVERITY[after] > SEVERITY[before] ? after : null
