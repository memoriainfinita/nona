import { describe, expect, test } from 'vitest'
import { createGame, type Game } from './game'
import {
  activity,
  bestTimes,
  completeGame,
  dailyEntry,
  type HistoryEntry,
  isNewBest,
  localDate,
  recent,
  totals,
  utcDate,
} from './records'
import { IDENTITY } from './transform'

const empty = new Array(81).fill(0)

function game(overrides: Partial<Game> = {}): Game {
  return {
    ...createGame({ id: 'g', level: 'hard', seed: 7, daily: null, transform: IDENTITY, givens: empty, solution: empty, now: 0 }),
    ...overrides,
  }
}

let n = 0
function entry(overrides: Partial<HistoryEntry>): HistoryEntry {
  return { id: `e${n++}`, level: 'hard', seed: n, daily: null, timeMs: 1000, hintsUsed: 0, completedAt: 0, ...overrides }
}

describe('completing a game', () => {
  test('records level, seed, time and hints', () => {
    const e = completeGame(game({ elapsedMs: 4321, hintsUsed: 2 }), 'h1', Date.parse('2026-10-05T10:00:00Z'))
    expect(e).toMatchObject({ id: 'h1', level: 'hard', seed: 7, timeMs: 4321, hintsUsed: 2, daily: null })
  })

  test('a daily counts as daily only when solved within its UTC date', () => {
    const daily = game({ daily: '2026-10-05' })
    expect(completeGame(daily, 'a', Date.parse('2026-10-05T23:59:00Z')).daily).toBe('2026-10-05')
    expect(completeGame(daily, 'b', Date.parse('2026-10-06T00:01:00Z')).daily).toBeNull()
  })
})

describe('stats', () => {
  test('best time ignores games solved with hints', () => {
    const history = [
      entry({ level: 'hard', timeMs: 500, hintsUsed: 1 }),
      entry({ level: 'hard', timeMs: 900 }),
      entry({ level: 'hard', timeMs: 700 }),
      entry({ level: 'easy', timeMs: 100 }),
    ]
    expect(bestTimes(history)).toEqual({ hard: 700, easy: 100 })
  })

  test('new best: faster than every hint-free game of its level; never with hints', () => {
    const old = entry({ level: 'hard', timeMs: 700 })
    const faster = entry({ level: 'hard', timeMs: 600 })
    const slower = entry({ level: 'hard', timeMs: 800 })
    const helped = entry({ level: 'hard', timeMs: 100, hintsUsed: 1 })
    expect(isNewBest([old, faster], faster)).toBe(true)
    expect(isNewBest([old, slower], slower)).toBe(false)
    expect(isNewBest([old, helped], helped)).toBe(false)
    expect(isNewBest([faster], faster)).toBe(true)
  })

  test('every completed game gives 100 XP, with or without hints', () => {
    expect(totals([entry({}), entry({ hintsUsed: 3 })])).toEqual({ completed: 2, xp: 200 })
  })

  test('activity counts the last 7 local days, today last', () => {
    const now = new Date(2026, 9, 10, 15).getTime()
    const day = (d: number) => new Date(2026, 9, d, 9).getTime()
    const result = activity([entry({ completedAt: day(10) }), entry({ completedAt: day(10) }), entry({ completedAt: day(4) }), entry({ completedAt: day(3) })], now)
    expect(result).toHaveLength(7)
    expect(result[6]).toEqual({ date: localDate(now), count: 2 })
    expect(result[0]).toEqual({ date: localDate(day(4)), count: 1 })
    expect(result.reduce((s, d) => s + d.count, 0)).toBe(3)
  })

  test('recent: newest first, at most 10', () => {
    const history = Array.from({ length: 12 }, (_, i) => entry({ completedAt: i }))
    const last = recent(history)
    expect(last).toHaveLength(10)
    expect(last[0].completedAt).toBe(11)
  })

  test('daily entry by date', () => {
    const e = entry({ daily: '2026-10-05' })
    expect(dailyEntry([entry({}), e], '2026-10-05')).toBe(e)
    expect(dailyEntry([e], '2026-10-06')).toBeUndefined()
  })

  test('utcDate', () => {
    expect(utcDate(Date.parse('2026-10-05T23:30:00Z'))).toBe('2026-10-05')
  })
})
