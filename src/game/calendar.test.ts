import { expect, test } from 'vitest'
import type { DailyPuzzle } from '../bank/bank'
import { addMonths, dailySeed, dayInfo, daysBetween, monthDays, monthOf } from './calendar'
import { createGame, type Game } from './game'
import type { HistoryEntry } from './records'
import { IDENTITY } from './transform'

const EPOCH = '2026-09-30'
const TODAY = '2026-10-16'
const list: DailyPuzzle[] = Array.from({ length: 30 }, (_, i) => ({ seed: 9000 + i, level: 'hard', puzzle: '', solution: '' }))
const at = (date: string, hour = 12) => Date.parse(`${date}T${String(hour).padStart(2, '0')}:00:00Z`)

function entry(id: string, seed: number, completedAt: number, daily: string | null = null): HistoryEntry {
  return { id, level: 'hard', seed, daily, timeMs: 1000, hintsUsed: 0, completedAt }
}

function game(daily: string): Game {
  const empty = new Array(81).fill(0)
  return createGame({ id: `g-${daily}`, level: 'hard', seed: dailySeed(list, daily, EPOCH), daily, transform: IDENTITY, givens: empty, solution: empty, now: 0 })
}

test('month grid starts on Monday', () => {
  // 1 October 2026 is a Thursday; 1 September a Tuesday.
  expect(monthDays({ year: 2026, month: 9 })).toMatchObject({ lead: 3 })
  expect(monthDays({ year: 2026, month: 9 }).dates).toHaveLength(31)
  expect(monthDays({ year: 2026, month: 8 })).toMatchObject({ lead: 1 })
  expect(monthDays({ year: 2026, month: 8 }).dates.at(-1)).toBe('2026-09-30')
  expect(monthDays({ year: 2027, month: 1 }).dates).toHaveLength(28)
})

test('months', () => {
  expect(monthOf('2026-10-16')).toEqual({ year: 2026, month: 9 })
  expect(addMonths({ year: 2026, month: 11 }, 1)).toEqual({ year: 2027, month: 0 })
  expect(addMonths({ year: 2027, month: 0 }, -1)).toEqual({ year: 2026, month: 11 })
  expect(daysBetween(EPOCH, TODAY)).toBe(16)
})

test('days before the first daily and after today are off', () => {
  expect(dayInfo('2026-09-29', TODAY, list, [], [], EPOCH).state).toBe('off')
  expect(dayInfo('2026-10-17', TODAY, list, [], [], EPOCH).state).toBe('off')
  expect(dayInfo(EPOCH, TODAY, list, [], [], EPOCH).state).toBe('open')
  expect(dayInfo(TODAY, TODAY, list, [], [], EPOCH).state).toBe('today')
})

test('solved on the day, solved later, in progress', () => {
  const d5 = '2026-10-05'
  const d6 = '2026-10-06'
  const d7 = '2026-10-07'
  const history = [
    entry('a', dailySeed(list, d5, EPOCH), at(d5), d5),
    // Solved late: no daily date, found by its seed.
    entry('b', dailySeed(list, d6, EPOCH), at('2026-10-09')),
  ]
  expect(dayInfo(d5, TODAY, list, history, [], EPOCH)).toMatchObject({ state: 'ontime', entry: { id: 'a' } })
  expect(dayInfo(d6, TODAY, list, history, [], EPOCH)).toMatchObject({ state: 'late', entry: { id: 'b' } })
  expect(dayInfo(d7, TODAY, list, history, [game(d7)], EPOCH)).toMatchObject({ state: 'progress', game: { id: `g-${d7}` } })
})

test('a solve on the day wins over a later one; of several later ones, the first', () => {
  const d = '2026-10-02'
  const seed = dailySeed(list, d, EPOCH)
  const later = [entry('late2', seed, at('2026-10-12')), entry('late1', seed, at('2026-10-04'))]
  expect(dayInfo(d, TODAY, list, later, [], EPOCH).entry?.id).toBe('late1')
  expect(dayInfo(d, TODAY, list, [...later, entry('day', seed, at(d), d)], [], EPOCH).entry?.id).toBe('day')
})

test('once the list starts over, an older solve of the same puzzle belongs to the earlier date', () => {
  // 30 puzzles: day 30 after the epoch plays the epoch's puzzle again.
  const first = EPOCH
  const again = '2026-10-30'
  expect(dailySeed(list, again, EPOCH)).toBe(dailySeed(list, first, EPOCH))
  const history = [entry('old', dailySeed(list, first, EPOCH), at(first), first)]
  expect(dayInfo(again, '2026-11-02', list, history, [], EPOCH).state).toBe('open')
})
