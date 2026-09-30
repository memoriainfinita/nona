import type { Level } from '../bank/bank'
import type { Game } from './game'
import type { Transform } from './transform'

export const XP_PER_SUDOKU = 100

export interface HistoryEntry {
  id: string
  level: Level
  /** Seed of the base puzzle. */
  seed: number
  /** UTC date when it counts as that day's daily sudoku (solved within its date), else null. */
  daily: string | null
  timeMs: number
  hintsUsed: number
  completedAt: number
  /** Transformation the puzzle was played with. Missing in entries saved before it was kept. */
  transform?: Transform
}

/** UTC date as YYYY-MM-DD. */
export function utcDate(time: number): string {
  return new Date(time).toISOString().slice(0, 10)
}

/** Local date of the device as YYYY-MM-DD. */
export function localDate(time: number): string {
  const d = new Date(time)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

/** History entry for a solved game. A daily only counts as daily if solved within its UTC date. */
export function completeGame(game: Game, id: string, now: number): HistoryEntry {
  return {
    id,
    level: game.level,
    seed: game.seed,
    daily: game.daily !== null && utcDate(now) === game.daily ? game.daily : null,
    timeMs: game.elapsedMs,
    hintsUsed: game.hintsUsed,
    completedAt: now,
    transform: game.transform,
  }
}

/** Solved with hints: counts as completed and gives XP, never a best time. */
export function solvedWithHints(entry: HistoryEntry): boolean {
  return entry.hintsUsed > 0
}

/** Best time per level: the minimum among games solved without hints. */
export function bestTimes(history: readonly HistoryEntry[]): Partial<Record<Level, number>> {
  const best: Partial<Record<Level, number>> = {}
  for (const e of history) {
    if (solvedWithHints(e)) continue
    const current = best[e.level]
    if (current === undefined || e.timeMs < current) best[e.level] = e.timeMs
  }
  return best
}

/** True when this entry set a new best time for its level (the victory screen notice). */
export function isNewBest(history: readonly HistoryEntry[], entry: HistoryEntry): boolean {
  if (solvedWithHints(entry)) return false
  return history.every((e) => e.id === entry.id || e.level !== entry.level || solvedWithHints(e) || e.timeMs > entry.timeMs)
}

export function totals(history: readonly HistoryEntry[]): { completed: number; xp: number } {
  return { completed: history.length, xp: history.length * XP_PER_SUDOKU }
}

/** Completed games per local day for the last `days` days, oldest first, today last. */
export function activity(history: readonly HistoryEntry[], now: number, days = 7): { date: string; count: number }[] {
  const today = new Date(now)
  const dates = Array.from({ length: days }, (_, k) => {
    const d = new Date(today.getFullYear(), today.getMonth(), today.getDate() - (days - 1 - k), 12)
    return localDate(d.getTime())
  })
  const counts = new Map(dates.map((d) => [d, 0]))
  for (const e of history) {
    const d = localDate(e.completedAt)
    if (counts.has(d)) counts.set(d, counts.get(d)! + 1)
  }
  return dates.map((date) => ({ date, count: counts.get(date)! }))
}

/** The most recent completed games, newest first. */
export function recent(history: readonly HistoryEntry[], n = 10): HistoryEntry[] {
  return [...history].sort((a, b) => b.completedAt - a.completedAt).slice(0, n)
}

/** The entry for that day's daily sudoku, if it was solved within its date. */
export function dailyEntry(history: readonly HistoryEntry[], date: string): HistoryEntry | undefined {
  return history.find((e) => e.daily === date)
}
