import type { Game, PlayerId, Session } from './domain'

export type AchievementId = 'jackpot' | 'francotirador' | 'mecenas' | 'remontada' | 'fiel' | 'madrugador'

export interface Achievement {
  id: AchievementId
  name: string
  emoji: string
  description: string
}

export const ACHIEVEMENTS: Achievement[] = [
  { id: 'jackpot', name: 'Jackpot', emoji: '💰', description: 'Una partida de 200 tickets o más' },
  { id: 'francotirador', name: 'Francotirador', emoji: '🎯', description: '5 partidas seguidas sacando 70 tickets o más por euro' },
  { id: 'mecenas', name: 'Mecenas', emoji: '💸', description: 'Ser quien más gasta en una sesión terminada' },
  { id: 'remontada', name: 'Remontada', emoji: '🚀', description: 'Ganar una sesión después de haber ido último en ella' },
  { id: 'fiel', name: 'Fiel', emoji: '🤝', description: '10 partidas en la misma máquina' },
  { id: 'madrugador', name: 'Madrugador', emoji: '🌅', description: 'Apuntar la primera partida de una sesión' },
]

const JACKPOT_TICKETS = 200
const SNIPER_RATIO = 70
const SNIPER_STREAK = 5
const LOYAL_GAMES = 10
/** La remontada solo cuenta si ya había al menos tantos jugadores en la sesión. */
const COMEBACK_MIN_PLAYERS = 3

export type Unlocked = Map<PlayerId, Set<AchievementId>>

const chronological = (games: Game[]): Game[] => [...games].sort((a, b) => a.createdAt - b.createdAt)

const leaders = (scores: Map<PlayerId, number>, pick: (a: number, b: number) => number): PlayerId[] => {
  if (!scores.size) return []
  const best = [...scores.values()].reduce((a, b) => pick(a, b))
  return [...scores].filter(([, v]) => v === best).map(([p]) => p)
}

/** Logros conseguidos por cada jugador. Solo depende de los datos, así sale igual en todos los móviles. */
export function achievements(games: Game[], sessions: Session[]): Unlocked {
  const unlocked: Unlocked = new Map()
  const grant = (player: PlayerId, id: AchievementId) => unlocked.set(player, (unlocked.get(player) ?? new Set()).add(id))
  const ordered = chronological(games)

  const streak = new Map<PlayerId, number>()
  const perMachine = new Map<string, number>()
  for (const g of ordered) {
    if (g.tickets >= JACKPOT_TICKETS) grant(g.player, 'jackpot')

    const sniped = g.cents > 0 && g.tickets / (g.cents / 100) >= SNIPER_RATIO
    const run = sniped ? (streak.get(g.player) ?? 0) + 1 : 0
    streak.set(g.player, run)
    if (run >= SNIPER_STREAK) grant(g.player, 'francotirador')

    if (g.machineId) {
      const key = `${g.player}|${g.machineId}`
      const count = (perMachine.get(key) ?? 0) + 1
      perMachine.set(key, count)
      if (count >= LOYAL_GAMES) grant(g.player, 'fiel')
    }
  }

  for (const session of sessions) {
    const played = ordered.filter((g) => g.sessionId === session.id)
    if (played.length) grant(played[0].player, 'madrugador')
    if (session.endedAt === null || !played.length) continue

    const spent = new Map<PlayerId, number>()
    played.forEach((g) => spent.set(g.player, (spent.get(g.player) ?? 0) + g.cents))
    if (Math.max(...spent.values()) > 0) leaders(spent, Math.max).forEach((p) => grant(p, 'mecenas'))

    const tickets = new Map<PlayerId, number>()
    const wasLast = new Set<PlayerId>()
    for (const g of played) {
      tickets.set(g.player, (tickets.get(g.player) ?? 0) + g.tickets)
      if (tickets.size >= COMEBACK_MIN_PLAYERS) leaders(tickets, Math.min).forEach((p) => wasLast.add(p))
    }
    const winners = leaders(tickets, Math.max)
    if (winners.length === 1 && wasLast.has(winners[0])) grant(winners[0], 'remontada')
  }

  return unlocked
}

/** Logros que aparecen en `after` y no estaban en `before`. */
export function newlyUnlocked(before: Unlocked, after: Unlocked): Array<[PlayerId, AchievementId]> {
  return [...after].flatMap(([player, ids]) => [...ids].filter((id) => !before.get(player)?.has(id)).map((id) => [player, id] as [PlayerId, AchievementId]))
}
