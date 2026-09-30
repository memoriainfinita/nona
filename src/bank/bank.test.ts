import { describe, expect, test } from 'vitest'
import { PEERS } from '../game/grid'
import { type BankPuzzle, LEVELS, loadDaily, loadLevel } from './bank'

/** Returns what is wrong with a bank entry, or null. */
function problem({ puzzle, solution }: BankPuzzle): string | null {
  if (!/^[.1-9]{81}$/.test(puzzle)) return 'bad puzzle format'
  if (!/^[1-9]{81}$/.test(solution)) return 'bad solution format'
  for (let i = 0; i < 81; i++) {
    if (puzzle[i] !== '.' && puzzle[i] !== solution[i]) return `given ${i} differs from solution`
    for (const p of PEERS[i]) if (solution[p] === solution[i]) return `solution repeats at ${i} and ${p}`
  }
  return null
}

describe('bank', async () => {
  const normal = await Promise.all(LEVELS.map(loadLevel))
  const daily = await loadDaily()
  const all = [...normal.flat(), ...daily]

  test('every puzzle is valid and its solution matches the givens', () => {
    const bad = all.flatMap((p) => {
      const why = problem(p)
      return why ? [`${p.seed}: ${why}`] : []
    })
    expect(bad).toEqual([])
  })

  test('no puzzle or seed appears twice, across both sets', () => {
    expect(new Set(all.map((p) => p.puzzle)).size).toBe(all.length)
    expect(new Set(all.map((p) => p.seed)).size).toBe(all.length)
  })

  test('same number of normal puzzles per level', () => {
    expect(new Set(normal.map((l) => l.length)).size).toBe(1)
    expect(normal[0].length).toBeGreaterThan(0)
  })

  test('daily list has the same number of puzzles per level', () => {
    const counts = LEVELS.map((l) => daily.filter((p) => p.level === l).length)
    expect(new Set(counts).size).toBe(1)
    expect(counts[0]).toBeGreaterThan(0)
  })
})
