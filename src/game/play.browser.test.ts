import { afterEach, expect, test } from 'vitest'
import { loadLevel } from '../bank/bank'
import { HintEngine } from '../engine/client'
import { applyHintMove, autoNotesMove, commit, createGame, engineCandidates, isSolved, undo } from './game'
import { formatGrid } from './grid'
import { pickPuzzle } from './pick'
import { seededRng } from './rng'

let engine: HintEngine | undefined
afterEach(() => engine?.terminate())

// A transformed bank puzzle played to the end through the game module: engine candidates,
// Apply of each hint (with notes on the board) and, at the end, undo back to the start.
test.each(['medium', 'expert', 'master'] as const)('plays a transformed %s game with hints only', async (level) => {
  const picked = pickPuzzle(await loadLevel(level), new Set(), seededRng(42))
  const start = createGame({
    id: 'g', level, seed: picked.entry.seed, daily: null, transform: picked.transform,
    givens: picked.givens, solution: picked.solution, now: 0,
  })
  let g = commit(start, autoNotesMove(start))
  engine = new HintEngine()
  let hints = 0
  while (!isSolved(g)) {
    const hint = await engine.hint(formatGrid(g.board.values), engineCandidates(g))
    expect(hint).not.toBeNull()
    if (hint!.place) expect(hint!.place.value).toBe(g.solution[hint!.place.cell])
    else for (const e of hint!.eliminations) expect(e.values).not.toContain(g.solution[e.cell])
    g = commit(g, applyHintMove(g, hint!, true))
    expect(++hints).toBeLessThan(200)
  }
  while (g.undo.length) g = undo(g)
  expect(g.board).toEqual(start.board)
}, 60_000)
