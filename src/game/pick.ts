import type { BankPuzzle, DailyPuzzle } from '../bank/bank'
import { type Rng, randomInt, stringRng } from './rng'
import { applyTransform, randomTransform, type Transform } from './transform'

/**
 * First day of the daily list (UTC). Fixed at publication (plan.md, Fase 6); until then, a
 * placeholder.
 */
export const DAILY_EPOCH = '2026-10-01'

const DAY_MS = 86_400_000

/** Days from the epoch to a UTC date, both YYYY-MM-DD. Dates before the epoch give 0. */
export function dayIndex(date: string, epoch = DAILY_EPOCH): number {
  const days = Math.round((Date.parse(`${date}T00:00:00Z`) - Date.parse(`${epoch}T00:00:00Z`)) / DAY_MS)
  return Math.max(0, days)
}

export interface Picked<T extends BankPuzzle> {
  entry: T
  transform: Transform
  givens: number[]
  solution: number[]
}

const digits = (s: string) => [...s].map((ch) => (ch === '.' ? 0 : Number(ch)))

function transformed<T extends BankPuzzle>(entry: T, transform: Transform): Picked<T> {
  return {
    entry,
    transform,
    givens: applyTransform(digits(entry.puzzle), transform),
    solution: applyTransform(digits(entry.solution), transform),
  }
}

/**
 * Day n from the epoch plays entry n; past the end the list starts over. The transformation
 * comes from a PRNG seeded with the date, so everyone gets the same puzzle that day.
 */
export function dailyPuzzle(list: readonly DailyPuzzle[], date: string, epoch = DAILY_EPOCH): Picked<DailyPuzzle> {
  if (list.length === 0) throw new Error('empty daily list')
  const entry = list[dayIndex(date, epoch) % list.length]
  return transformed(entry, randomTransform(stringRng(date)))
}

/**
 * A normal game: a base puzzle not in `played` (history and games in progress for the level),
 * or any once all were played, with a random transformation.
 */
export function pickPuzzle(list: readonly BankPuzzle[], played: ReadonlySet<number>, rng: Rng): Picked<BankPuzzle> {
  if (list.length === 0) throw new Error('empty bank level')
  const fresh = list.filter((p) => !played.has(p.seed))
  const pool = fresh.length ? fresh : list
  return transformed(pool[randomInt(rng, pool.length)], randomTransform(rng))
}
