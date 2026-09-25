import type { PlayerId } from './domain'

export interface Player {
  id: PlayerId
  name: string
  emoji: string
  /** Tono joya por defecto. */
  jewel: string
}

export const PLAYERS: Player[] = [
  { id: 'alej', name: 'Alej', emoji: '🦊', jewel: '#C8733A' },
  { id: 'jon', name: 'Jon', emoji: '🐙', jewel: '#8E4FC8' },
  { id: 'gabriel', name: 'Gabriel', emoji: '🦈', jewel: '#2F5FD0' },
  { id: 'javier', name: 'Javier', emoji: '🐯', jewel: '#C0213F' },
  { id: 'migueliz', name: 'Migueliz', emoji: '🦄', jewel: '#E0A08A' },
]

export const JEWELS: ReadonlyArray<readonly [name: string, color: string]> = [
  ['Cobre', '#C8733A'],
  ['Ámbar', '#D98A1C'],
  ['Rubí', '#C0213F'],
  ['Oro rosa', '#E0A08A'],
  ['Amatista', '#8E4FC8'],
  ['Zafiro', '#2F5FD0'],
  ['Platino', '#B8BCC8'],
]

export const playerById = (id: PlayerId): Player => PLAYERS.find((p) => p.id === id)!
