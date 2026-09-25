import type { Game, Machine, Session } from './domain'
import { prefs } from './prefs'

export type NewGame = Pick<Game, 'player' | 'tickets' | 'cents' | 'machineId'>

export type GameChange =
  | { type: 'added'; game: Game }
  | { type: 'removed'; id: string }
  | { type: 'session'; session: Session }
  | { type: 'machine'; machine: Machine }

export interface GameStore {
  load(): Promise<Game[]>
  add(game: NewGame): Promise<Game>
  remove(id: string): Promise<void>
  /** Avisa de cambios hechos desde otros móviles. Devuelve la función para dejar de escuchar. */
  /** Sesiones de tarde; solo existen con la base de datos compartida. */
  loadSessions?(): Promise<Session[]>
  startSession?(): Promise<Session>
  endSession?(): Promise<Session | null>
  /** Máquinas del local; solo existen con la base de datos compartida. */
  loadMachines?(): Promise<Machine[]>
  addMachine?(name: string): Promise<Machine>
  subscribe?(onChange: (change: GameChange) => void): () => void
}

/** Partidas guardadas solo en este navegador. Se sustituye por Supabase en #14. */
export class LocalGameStore implements GameStore {
  private readonly key = 'tk.games'

  async load(): Promise<Game[]> {
    return prefs.read<Game[]>(this.key, [])
  }

  async add(game: NewGame): Promise<Game> {
    const saved: Game = { ...game, id: crypto.randomUUID(), createdAt: Date.now() }
    prefs.write(this.key, [...(await this.load()), saved])
    return saved
  }

  async remove(id: string): Promise<void> {
    prefs.write(this.key, (await this.load()).filter((g) => g.id !== id))
  }
}
