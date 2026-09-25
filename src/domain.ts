export type PlayerId = 'alej' | 'jon' | 'gabriel' | 'javier' | 'migueliz'

export interface Game {
  id: string
  player: PlayerId
  tickets: number
  cents: number
  createdAt: number
}

export interface Totals {
  tickets: number
  cents: number
  /** Tickets por euro; null si no se ha gastado nada. */
  ratio: number | null
}

export function totals(games: Game[]): Totals {
  const tickets = games.reduce((sum, g) => sum + g.tickets, 0)
  const cents = games.reduce((sum, g) => sum + g.cents, 0)
  return { tickets, cents, ratio: cents ? tickets / (cents / 100) : null }
}

export const gamesOf = (games: Game[], player: PlayerId): Game[] => games.filter((g) => g.player === player)
