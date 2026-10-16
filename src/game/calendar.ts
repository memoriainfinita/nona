import type { DailyPuzzle } from '../bank/bank'
import type { Game } from './game'
import { DAILY_EPOCH, dayIndex } from './pick'
import type { HistoryEntry } from './records'

/**
 * Calendar of daily sudokus (design.md, Calendario del día). Days are UTC dates, as the daily is.
 * A day solved late is found by the seed of its puzzle: seeds are unique across the bank.
 */

export type DayState = 'off' | 'today' | 'open' | 'progress' | 'ontime' | 'late'

export interface DayInfo {
  date: string
  state: DayState
  /** The solve shown for the day: on its date if there is one, else the first one after. */
  entry?: HistoryEntry
  /** The daily game in progress for the day. */
  game?: Game
}

/** A month, 0-based like Date. */
export interface Month {
  year: number
  month: number
}

const DAY_MS = 86_400_000
const utcStart = (date: string) => Date.parse(`${date}T00:00:00Z`)
const pad = (n: number) => String(n).padStart(2, '0')

export function monthOf(date: string): Month {
  const [year, month] = date.split('-').map(Number)
  return { year, month: month - 1 }
}

export function sameMonth(a: Month, b: Month): boolean {
  return a.year === b.year && a.month === b.month
}

export function addMonths({ year, month }: Month, n: number): Month {
  const m = year * 12 + month + n
  return { year: Math.floor(m / 12), month: m % 12 }
}

/** Monday-first grid of a month: blank cells before day 1, then each date. */
export function monthDays({ year, month }: Month): { lead: number; dates: string[] } {
  const first = new Date(Date.UTC(year, month, 1))
  const days = new Date(Date.UTC(year, month + 1, 0)).getUTCDate()
  const lead = (first.getUTCDay() + 6) % 7
  const dates = Array.from({ length: days }, (_, i) => `${year}-${pad(month + 1)}-${pad(i + 1)}`)
  return { lead, dates }
}

/** Base puzzle a date plays (pick.ts, dailyPuzzle). */
export function dailyOf(list: readonly DailyPuzzle[], date: string, epoch = DAILY_EPOCH): DailyPuzzle {
  return list[dayIndex(date, epoch) % list.length]
}

export function dailySeed(list: readonly DailyPuzzle[], date: string, epoch = DAILY_EPOCH): number {
  return dailyOf(list, date, epoch).seed
}

export function dayInfo(
  date: string,
  today: string,
  list: readonly DailyPuzzle[],
  history: readonly HistoryEntry[],
  games: readonly Game[],
  epoch = DAILY_EPOCH,
): DayInfo {
  if (date < epoch || date > today) return { date, state: 'off' }
  const onTime = history.find((e) => e.daily === date)
  if (onTime) return { date, state: 'ontime', entry: onTime }
  // Solved after its date, or a Play again of it. From its date on: the list starts over after
  // its last day, and an older solve of the same puzzle belongs to an earlier date.
  const seed = dailySeed(list, date, epoch)
  const from = utcStart(date)
  const late = history
    .filter((e) => e.seed === seed && e.completedAt >= from)
    .sort((a, b) => a.completedAt - b.completedAt)[0]
  if (late) return { date, state: 'late', entry: late }
  const game = games.find((g) => g.daily === date)
  if (game) return { date, state: 'progress', game }
  return { date, state: date === today ? 'today' : 'open' }
}

/** Dates are YYYY-MM-DD; whole days apart. */
export function daysBetween(a: string, b: string): number {
  return Math.round((utcStart(b) - utcStart(a)) / DAY_MS)
}
