import type { SupabaseClient } from '@supabase/supabase-js'
import type { Game, Machine, PlayerId, Session } from './domain'
import type { GameChange, GameStore, NewGame } from './store'

interface GameRow {
  id: string
  player: string
  tickets: number
  cents: number
  created_at: string
  session_id?: string | null
  machine_id?: string | null
}

interface SessionRow {
  id: string
  started_at: string
  ended_at: string | null
}

export const rowToSession = (row: SessionRow): Session => ({
  id: row.id,
  startedAt: Date.parse(row.started_at),
  endedAt: row.ended_at === null ? null : Date.parse(row.ended_at),
})

/** El código de grupo ya no es válido (por ejemplo, porque se ha cambiado). */
export class WrongGroupCodeError extends Error {}

export const rowToGame = (row: GameRow): Game => ({
  id: row.id,
  player: row.player as PlayerId,
  tickets: row.tickets,
  cents: row.cents,
  createdAt: Date.parse(row.created_at),
  sessionId: row.session_id ?? null,
  machineId: row.machine_id ?? null,
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
    const { data, error } = await this.client.rpc('add_game', {
      code: this.code,
      player: game.player,
      tickets: game.tickets,
      cents: game.cents,
      machine_id: game.machineId ?? null,
    })
    if (error) fail(error)
    return rowToGame(data as GameRow)
  }

  subscribe(onChange: (change: GameChange) => void): () => void {
    const channel = this.client
      .channel('games')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'games' }, (p) =>
        onChange({ type: 'added', game: rowToGame(p.new as GameRow) }),
      )
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'games' }, (p) =>
        onChange({ type: 'removed', id: (p.old as { id: string }).id }),
      )
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'machines' }, (p) =>
        onChange({ type: 'machine', machine: { id: p.new.id as string, name: p.new.name as string } }),
      )
      .on('postgres_changes', { event: '*', schema: 'public', table: 'sessions' }, (p) => {
        if (p.eventType !== 'DELETE') onChange({ type: 'session', session: rowToSession(p.new as SessionRow) })
      })
      .subscribe()
    return () => void this.client.removeChannel(channel)
  }

  async loadMachines(): Promise<Machine[]> {
    const { data, error } = await this.client.from('machines').select('id, name').order('name')
    if (error) fail(error)
    return data as Machine[]
  }

  async addMachine(name: string): Promise<Machine> {
    const { data, error } = await this.client.rpc('add_machine', { code: this.code, name })
    if (error) fail(error)
    const row = data as Machine
    return { id: row.id, name: row.name }
  }

  async loadSessions(): Promise<Session[]> {
    const { data, error } = await this.client.from('sessions').select('*').order('started_at')
    if (error) fail(error)
    return (data as SessionRow[]).map(rowToSession)
  }

  async startSession(): Promise<Session> {
    const { data, error } = await this.client.rpc('start_session', { code: this.code })
    if (error) fail(error)
    return rowToSession(data as SessionRow)
  }

  async endSession(): Promise<Session | null> {
    const { data, error } = await this.client.rpc('end_session', { code: this.code })
    if (error) fail(error)
    // Si no había sesión abierta, Postgres devuelve una fila con todo a null.
    return (data as SessionRow | null)?.id ? rowToSession(data as SessionRow) : null
  }

  async remove(id: string): Promise<void> {
    const { error } = await this.client.rpc('remove_game', { code: this.code, game_id: id })
    if (error) fail(error)
  }
}
