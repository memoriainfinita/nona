import fc from 'fast-check'
import { describe, expect, test } from 'vitest'
import { loadDaily, loadLevel } from '../bank/bank'
import { conflictCells } from './grid'
import { dailyPuzzle, dayIndex, historyPuzzle, pickPuzzle } from './pick'
import { seededRng } from './rng'
import { randomTransform } from './transform'

const daily = await loadDaily()
const easy = await loadLevel('easy')

describe('daily sudoku', () => {
  test('day index from the epoch; earlier dates give 0', () => {
    expect(dayIndex('2026-10-01', '2026-10-01')).toBe(0)
    expect(dayIndex('2026-10-02', '2026-10-01')).toBe(1)
    expect(dayIndex('2027-10-01', '2026-10-01')).toBe(365)
    expect(dayIndex('2026-09-01', '2026-10-01')).toBe(0)
  })

  test('same date, same puzzle and transformation', () => {
    const a = dailyPuzzle(daily, '2026-11-20', '2026-10-01')
    const b = dailyPuzzle(daily, '2026-11-20', '2026-10-01')
    expect(a).toEqual(b)
  })

  test('consecutive days walk the list in order', () => {
    for (let d = 0; d < 5; d++) {
      const date = new Date(Date.UTC(2026, 9, 1 + d)).toISOString().slice(0, 10)
      expect(dailyPuzzle(daily, date, '2026-10-01').entry).toBe(daily[d])
    }
  })

  test('past the end the list starts over, with another transformation', () => {
    const first = dailyPuzzle(daily, '2026-10-01', '2026-10-01')
    const again = new Date(Date.UTC(2026, 9, 1) + daily.length * 86_400_000).toISOString().slice(0, 10)
    const wrapped = dailyPuzzle(daily, again, '2026-10-01')
    expect(wrapped.entry).toBe(first.entry)
    expect(wrapped.transform).not.toEqual(first.transform)
  })

  test('the transformed daily is a valid puzzle', () => {
    const { givens, solution } = dailyPuzzle(daily, '2026-12-25', '2026-10-01')
    expect(conflictCells(solution).size).toBe(0)
    givens.forEach((v, i) => v && expect(v).toBe(solution[i]))
  })
})

describe('normal games', () => {
  test('prefers base puzzles not yet played', () => {
    fc.assert(
      fc.property(fc.integer(), fc.integer({ min: 0, max: easy.length - 1 }), (seed, keep) => {
        const played = new Set(easy.filter((_, i) => i !== keep).map((p) => p.seed))
        expect(pickPuzzle(easy, played, seededRng(seed)).entry).toBe(easy[keep])
      }),
      { numRuns: 50 },
    )
  })

  test('with every base played, it still picks one', () => {
    const played = new Set(easy.map((p) => p.seed))
    expect(easy).toContain(pickPuzzle(easy, played, seededRng(1)).entry)
  })
})

describe('history puzzle', () => {
  test('rebuilds the puzzle as it was played, searching the lists in order', () => {
    const played = pickPuzzle(easy, new Set(), seededRng(3))
    expect(historyPuzzle([easy], played.entry.seed, played.transform)).toEqual(played)
    const today = dailyPuzzle(daily, '2026-11-20', '2026-10-01')
    expect(historyPuzzle([easy, daily], today.entry.seed, today.transform)).toEqual(today)
  })

  test('without a transform, the base puzzle; an unknown seed gives null', () => {
    const base = historyPuzzle([easy], easy[0].seed)!
    expect(base.givens.join('')).toBe(easy[0].puzzle.replaceAll('.', '0'))
    expect(historyPuzzle([easy], -1, randomTransform(seededRng(1)))).toBeNull()
  })
})
