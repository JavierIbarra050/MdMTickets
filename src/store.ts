import type { Game } from './domain'
import { prefs } from './prefs'

export type NewGame = Omit<Game, 'id' | 'createdAt'>

export interface GameStore {
  load(): Promise<Game[]>
  add(game: NewGame): Promise<Game>
  remove(id: string): Promise<void>
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
