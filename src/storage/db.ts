import { type DBSchema, type IDBPDatabase, openDB } from 'idb'
import type { Level } from '../bank/bank'
import type { Game } from '../game/game'
import type { HistoryEntry } from '../game/records'
import { DEFAULT_SETTINGS, type Settings } from '../game/settings'

interface NonaDB extends DBSchema {
  /** Games in progress, with undo, colours and engine candidates. */
  games: { key: string; value: Game }
  /** Every completed game. */
  history: { key: string; value: HistoryEntry }
  /** Device settings under the single key "settings". */
  settings: { key: string; value: Partial<Settings> }
}

export type Db = IDBPDatabase<NonaDB>

export const DB_NAME = 'nona'
const SETTINGS_KEY = 'settings'

export function openNona(name = DB_NAME): Promise<Db> {
  return openDB<NonaDB>(name, 1, {
    upgrade(db) {
      db.createObjectStore('games', { keyPath: 'id' })
      db.createObjectStore('history', { keyPath: 'id' })
      db.createObjectStore('settings')
    },
  })
}

export async function saveGame(db: Db, game: Game, now = Date.now()): Promise<Game> {
  const saved = { ...game, updatedAt: now }
  await db.put('games', saved)
  return saved
}

export function getGame(db: Db, id: string): Promise<Game | undefined> {
  return db.get('games', id)
}

/** Games in progress, most recently played first. */
export async function listGames(db: Db): Promise<Game[]> {
  return (await db.getAll('games')).sort((a, b) => b.updatedAt - a.updatedAt)
}

export function deleteGame(db: Db, id: string): Promise<void> {
  return db.delete('games', id)
}

/** Moves a solved game to the history in one transaction. */
export async function finishGame(db: Db, gameId: string, entry: HistoryEntry): Promise<void> {
  const tx = db.transaction(['games', 'history'], 'readwrite')
  await Promise.all([tx.objectStore('games').delete(gameId), tx.objectStore('history').put(entry), tx.done])
}

export function listHistory(db: Db): Promise<HistoryEntry[]> {
  return db.getAll('history')
}

/** Seeds of a level's base puzzles already played or in progress, to pick fresh ones first. */
export async function playedSeeds(db: Db, level: Level): Promise<Set<number>> {
  const [games, history] = await Promise.all([db.getAll('games'), db.getAll('history')])
  return new Set([...games, ...history].filter((x) => x.level === level).map((x) => x.seed))
}

/** Stored settings over the defaults, so settings added later get their default. */
export async function loadSettings(db: Db): Promise<Settings> {
  return { ...DEFAULT_SETTINGS, ...(await db.get('settings', SETTINGS_KEY)) }
}

export async function saveSettings(db: Db, settings: Settings): Promise<void> {
  await db.put('settings', settings, SETTINGS_KEY)
}

/** Clear history: removes games in progress and the history (best times with it); keeps settings. */
export async function clearHistory(db: Db): Promise<void> {
  const tx = db.transaction(['games', 'history'], 'readwrite')
  await Promise.all([tx.objectStore('games').clear(), tx.objectStore('history').clear(), tx.done])
}
