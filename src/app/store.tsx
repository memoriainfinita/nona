import { createContext, type ReactNode, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { type Level, loadDaily, loadLevel } from '../bank/bank'
import { HintEngine } from '../engine/client'
import { createGame, type Game } from '../game/game'
import { dailyPuzzle, pickPuzzle } from '../game/pick'
import type { HistoryEntry } from '../game/records'
import { utcDate } from '../game/records'
import type { Settings } from '../game/settings'
import {
  type Db,
  deleteGame,
  finishGame,
  listGames,
  listHistory,
  loadSettings,
  openNona,
  playedSeeds,
  saveGame,
  saveSettings,
} from '../storage/db'

export interface Store {
  db: Db
  settings: Settings
  /** Games in progress, most recently played first. */
  games: Game[]
  history: HistoryEntry[]
  /** One engine for the whole app: the worker and WASM load on the first hint. */
  engine: HintEngine
  /** The game on screen, if any. */
  activeId: string | null
  setActiveId: (id: string | null) => void
  updateSettings: (patch: Partial<Settings>) => void
  save: (game: Game) => Promise<void>
  startGame: (level: Level) => Promise<Game>
  /** Today's daily: the game in progress for it, or a new one. */
  startDaily: () => Promise<Game>
  discard: (id: string) => Promise<Game | undefined>
  restore: (game: Game) => Promise<void>
  finish: (game: Game, entry: HistoryEntry) => Promise<void>
  /** Re-reads everything from IndexedDB (after import or clear). */
  reload: () => Promise<void>
}

const StoreContext = createContext<Store | null>(null)

export function useStore(): Store {
  const store = useContext(StoreContext)
  if (!store) throw new Error('useStore outside StoreProvider')
  return store
}

interface Data {
  db: Db
  settings: Settings
  games: Game[]
  history: HistoryEntry[]
}

async function readAll(db: Db): Promise<Data> {
  const [settings, games, history] = await Promise.all([loadSettings(db), listGames(db), listHistory(db)])
  return { db, settings, games, history }
}

export function StoreProvider({ children, dbName }: { children: ReactNode; dbName?: string }) {
  const [data, setData] = useState<Data | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [activeId, setActiveId] = useState<string | null>(null)
  const engine = useRef<HintEngine>(null)
  engine.current ??= new HintEngine()

  useEffect(() => {
    let cancelled = false
    const opening = openNona(dbName)
    opening
      .then(readAll)
      .then((d) => !cancelled && setData(d))
      .catch((e) => !cancelled && setError(String(e)))
    return () => {
      cancelled = true
      // Close the connection so the database can be deleted or upgraded elsewhere.
      void opening.then((db) => db.close()).catch(() => {})
    }
  }, [dbName])

  const upsert = useCallback((game: Game) => {
    setData((d) => d && { ...d, games: [game, ...d.games.filter((g) => g.id !== game.id)] })
  }, [])

  const store = useMemo<Store | null>(() => {
    if (!data) return null
    const { db } = data
    const create = async (game: Game) => {
      const saved = await saveGame(db, game)
      upsert(saved)
      setActiveId(saved.id)
      return saved
    }
    return {
      ...data,
      engine: engine.current!,
      activeId,
      setActiveId,
      updateSettings: (patch) => {
        const settings = { ...data.settings, ...patch }
        setData((d) => d && { ...d, settings })
        void saveSettings(db, settings)
      },
      save: async (game) => {
        const saved = await saveGame(db, game)
        upsert(saved)
      },
      startGame: async (level) => {
        const [list, played] = await Promise.all([loadLevel(level), playedSeeds(db, level)])
        const picked = pickPuzzle(list, played, Math.random)
        const now = Date.now()
        return create(createGame({ id: crypto.randomUUID(), level, seed: picked.entry.seed, daily: null, transform: picked.transform, givens: picked.givens, solution: picked.solution, now }))
      },
      startDaily: async () => {
        const now = Date.now()
        const today = utcDate(now)
        const existing = data.games.find((g) => g.daily === today)
        if (existing) {
          setActiveId(existing.id)
          return existing
        }
        const picked = dailyPuzzle(await loadDaily(), today)
        return create(createGame({ id: crypto.randomUUID(), level: picked.entry.level, seed: picked.entry.seed, daily: today, transform: picked.transform, givens: picked.givens, solution: picked.solution, now }))
      },
      discard: async (id) => {
        const game = data.games.find((g) => g.id === id)
        await deleteGame(db, id)
        setData((d) => d && { ...d, games: d.games.filter((g) => g.id !== id) })
        return game
      },
      restore: async (game) => {
        await saveGame(db, game, game.updatedAt)
        setData((d) => d && { ...d, games: [...d.games, game].sort((a, b) => b.updatedAt - a.updatedAt) })
      },
      finish: async (game, entry) => {
        // The list changes first, so the menu never shows a solved game while IndexedDB writes.
        setData((d) => d && { ...d, games: d.games.filter((g) => g.id !== game.id), history: [...d.history, entry] })
        await finishGame(db, game.id, entry)
      },
      reload: async () => {
        setData(await readAll(db))
        setActiveId(null)
      },
    }
  }, [data, activeId, upsert])

  if (error) {
    return (
      <main className="fatal">
        <h1>nona</h1>
        <p>Couldn’t open this browser’s storage, so games can’t be saved. Private windows sometimes block it.</p>
      </main>
    )
  }
  if (!store) return null
  return <StoreContext.Provider value={store}>{children}</StoreContext.Provider>
}
