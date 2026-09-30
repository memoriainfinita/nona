import fc from 'fast-check'
import { describe, expect, test } from 'vitest'
import { loadLevel } from '../bank/bank'
import { conflictCells } from './grid'
import { seededRng } from './rng'
import { applyTransform, IDENTITY, randomTransform } from './transform'

const bank = await loadLevel('expert')
const digits = (s: string) => [...s].map((ch) => (ch === '.' ? 0 : Number(ch)))

describe('transform', () => {
  test('identity changes nothing', () => {
    const solution = digits(bank[0].solution)
    expect(applyTransform(solution, IDENTITY)).toEqual(solution)
  })

  test('four quarter turns give the original grid', () => {
    const solution = digits(bank[0].solution)
    expect(applyTransform(solution, { ...IDENTITY, rotation: 4 })).toEqual(solution)
  })

  test('keeps a valid solution valid and the givens on the solution', () => {
    fc.assert(
      fc.property(fc.integer(), fc.integer({ min: 0, max: bank.length - 1 }), (seed, k) => {
        const t = randomTransform(seededRng(seed))
        const puzzle = applyTransform(digits(bank[k].puzzle), t)
        const solution = applyTransform(digits(bank[k].solution), t)
        expect(conflictCells(solution).size).toBe(0)
        expect(solution.every((v) => v >= 1 && v <= 9)).toBe(true)
        puzzle.forEach((v, i) => v && expect(v).toBe(solution[i]))
        expect(puzzle.filter(Boolean).length).toBe(digits(bank[k].puzzle).filter(Boolean).length)
      }),
    )
  })

  test('random transforms are permutations that keep bands and stacks together', () => {
    fc.assert(
      fc.property(fc.integer(), (seed) => {
        const t = randomTransform(seededRng(seed))
        for (const perm of [t.rows, t.cols]) {
          expect([...perm].sort()).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8])
          for (let g = 0; g < 3; g++) {
            const bands = new Set(perm.slice(g * 3, g * 3 + 3).map((r) => Math.floor(r / 3)))
            expect(bands.size).toBe(1)
          }
        }
        expect(t.digits[0]).toBe(0)
        expect(t.digits.slice(1).sort()).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9])
        expect(t.rotation).toBeGreaterThanOrEqual(0)
        expect(t.rotation).toBeLessThan(4)
      }),
    )
  })
})
