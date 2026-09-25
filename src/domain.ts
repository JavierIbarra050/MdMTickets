export type PlayerId = 'alej' | 'jon' | 'gabriel' | 'javier' | 'migueliz'

export interface Game {
  id: string
  player: PlayerId
  tickets: number
  cents: number
  createdAt: number
  sessionId?: string | null
}

export interface Session {
  id: string
  startedAt: number
  endedAt: number | null
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

export type Metric = 'tickets' | 'cents' | 'ratio'
export type Period = 'session' | 'today' | 'all'

export interface RankRow {
  player: PlayerId
  totals: Totals
  /** Valor de la métrica elegida; null si no aplica (ratio sin gasto). */
  value: number | null
}

const sameDay = (a: number, b: number): boolean => new Date(a).toDateString() === new Date(b).toDateString()

/** Ordena a los jugadores por la métrica, de mayor a menor; los que no tienen valor van al final. */
export function ranking(
  games: Game[],
  players: PlayerId[],
  metric: Metric,
  period: Period,
  now = Date.now(),
  sessionId: string | null = null,
): RankRow[] {
  const inPeriod =
    period === 'all'
      ? games
      : period === 'today'
        ? games.filter((g) => sameDay(g.createdAt, now))
        : games.filter((g) => sessionId !== null && g.sessionId === sessionId)
  return players
    .map((player) => {
      const t = totals(gamesOf(inPeriod, player))
      return { player, totals: t, value: t[metric] }
    })
    .sort((a, b) => (b.value ?? -1) - (a.value ?? -1))
}

export type Chase =
  | { kind: 'first' }
  | { kind: 'out' }
  | { kind: 'behind'; ahead: PlayerId; diff: number }

/** Cuánto le falta a `me` para pasar al que tiene delante. */
export function chase(rows: RankRow[], me: PlayerId): Chase {
  const i = rows.findIndex((r) => r.player === me)
  if (rows[i].value === null) return { kind: 'out' }
  if (i === 0) return { kind: 'first' }
  const ahead = rows[i - 1]
  return { kind: 'behind', ahead: ahead.player, diff: (ahead.value ?? 0) - (rows[i].value ?? 0) }
}

/** La sesión abierta o, si no hay, la última que se cerró. */
export const currentSession = (sessions: Session[]): Session | null =>
  sessions.find((x) => x.endedAt === null) ?? [...sessions].sort((a, b) => b.startedAt - a.startedAt)[0] ?? null

export interface SessionSummary {
  games: number
  tickets: number
  cents: number
  winner: PlayerId | null
  best: Game | null
}

export function summarize(games: Game[], sessionId: string, players: PlayerId[]): SessionSummary {
  const played = games.filter((g) => g.sessionId === sessionId)
  const t = totals(played)
  const [first] = ranking(played, players, 'tickets', 'all')
  const best = played.reduce<Game | null>((top, g) => (top === null || g.tickets > top.tickets ? g : top), null)
  return { games: played.length, tickets: t.tickets, cents: t.cents, winner: first?.value ? first.player : null, best }
}

/** Jugadores que iban por detrás de `me` y ahora van por delante. */
export function overtakers(before: RankRow[], after: RankRow[], me: PlayerId): PlayerId[] {
  const pos = (rows: RankRow[], p: PlayerId) => rows.findIndex((r) => r.player === p)
  const was = pos(before, me)
  const now = pos(after, me)
  return after.slice(0, now).map((r) => r.player).filter((p) => pos(before, p) > was)
}
