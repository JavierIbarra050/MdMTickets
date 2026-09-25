import type { SupabaseClient } from '@supabase/supabase-js'
import type { Game, PlayerId } from './domain'
import type { GameStore, NewGame } from './store'

interface GameRow {
  id: string
  player: string
  tickets: number
  cents: number
  created_at: string
}

/** El código de grupo ya no es válido (por ejemplo, porque se ha cambiado). */
export class WrongGroupCodeError extends Error {}

export const rowToGame = (row: GameRow): Game => ({
  id: row.id,
  player: row.player as PlayerId,
  tickets: row.tickets,
  cents: row.cents,
  createdAt: Date.parse(row.created_at),
})

const fail = (error: { code?: string; message: string }): never => {
  if (error.code === '28000') throw new WrongGroupCodeError(error.message)
  throw new Error(error.message)
}

export async function checkGroupCode(client: SupabaseClient, code: string): Promise<boolean> {
  const { data, error } = await client.rpc('check_group_code', { code })
  if (error) fail(error)
  return data === true
}

/** Partidas compartidas por todo el grupo. Leer es libre; escribir exige el código de grupo. */
export class SupabaseGameStore implements GameStore {
  constructor(
    private readonly client: SupabaseClient,
    private readonly code: string,
  ) {}

  async load(): Promise<Game[]> {
    const { data, error } = await this.client.from('games').select('*').order('created_at')
    if (error) fail(error)
    return (data as GameRow[]).map(rowToGame)
  }

  async add(game: NewGame): Promise<Game> {
    const { data, error } = await this.client.rpc('add_game', { code: this.code, ...game })
    if (error) fail(error)
    return rowToGame(data as GameRow)
  }

  async remove(id: string): Promise<void> {
    const { error } = await this.client.rpc('remove_game', { code: this.code, game_id: id })
    if (error) fail(error)
  }
}
