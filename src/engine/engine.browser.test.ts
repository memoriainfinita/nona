import { afterEach, describe, expect, test } from 'vitest'
import { basicCandidates, formatGrid, parseGrid, PEERS } from '../game/grid'
import { EngineError, EngineLoadError, HintEngine } from './client'

// First puzzle of each level from bench/js/puzzles-seeded.json (Generator::with_seed(1)).
const PUZZLES = {
  medium: '.981.6.........389....4...52.531.76.4...2...1.13.648.26...8....321.........4.312.',
  hard: '..81.6.........389....4...5..531.7..4...2...1..3.648..6...8....321.........4.31..',
  expert: '38.5......9.3....7..462...........322...9...864...........761..8....2.6......5.74',
  master: '.....35.1.9......61.7..9.......851....4...8....564.......7..6.57......8.2.83.....',
}

let engine: HintEngine | undefined
afterEach(() => engine?.terminate())

/** Plays to the end using only hints, applying each one to the values and engine candidates. */
async function playWithHints(engine: HintEngine, puzzle: string) {
  const values = parseGrid(puzzle)
  const masks = basicCandidates(values)
  const seen = new Set<string>()
  let hints = 0
  while (values.includes(0)) {
    const hint = await engine.hint(formatGrid(values), masks)
    if (!hint) throw new Error(`no hint after ${hints}`)
    hints++
    if (hint.place) {
      const { cell, value } = hint.place
      expect(values[cell]).toBe(0)
      expect(masks[cell] & (1 << value)).not.toBe(0)
      values[cell] = value
      masks[cell] = 0
      for (const p of PEERS[cell]) masks[p] &= ~(1 << value)
    } else {
      expect(hint.eliminations.length).toBeGreaterThan(0)
      for (const { cell, values: digits } of hint.eliminations) {
        const key = `${cell}:${digits.join()}`
        expect(seen.has(key)).toBe(false)
        seen.add(key)
        for (const v of digits) masks[cell] &= ~(1 << v)
        expect(masks[cell]).not.toBe(0)
      }
    }
  }
  for (let i = 0; i < 81; i++) for (const p of PEERS[i]) expect(values[p]).not.toBe(values[i])
  return { hints, values }
}

describe('HintEngine in a worker', () => {
  test.each(Object.entries(PUZZLES))('solves %s with hints only', async (_level, puzzle) => {
    engine = new HintEngine()
    const { hints } = await playWithHints(engine, puzzle)
    expect(hints).toBeGreaterThan(0)
  }, 60_000)

  test('hint carries technique name, pattern and detail', async () => {
    engine = new HintEngine()
    const values = parseGrid(PUZZLES.medium)
    const hint = await engine.hint(PUZZLES.medium, basicCandidates(values))
    expect(hint).not.toBeNull()
    expect(hint!.technique).toMatch(/^[A-Z][A-Za-z-]*( [A-Za-z0-9-]+)*$/)
    expect(hint!.backtracking).toBe(false)
    expect(hint!.pattern.length).toBeGreaterThan(0)
    expect(hint!.detail.family).toBe('single')
  })

  test('singles on the placed values come before singles that need earlier eliminations', async () => {
    engine = new HintEngine()
    const values = parseGrid(PUZZLES.hard)
    const basic = basicCandidates(values)
    // Engine candidates with a digit removed from a cell: the hint still starts from what the board shows.
    const masks = basic.slice()
    const cell = masks.findIndex((m) => (m & (m - 1)) !== 0)
    masks[cell] &= masks[cell] - 1
    const hint = await engine.hint(PUZZLES.hard, masks)
    const { cell: at, value } = hint!.place!
    const bit = 1 << value
    const peersIn = (u: number[]) => u.filter((c) => c !== at && basic[c] & bit).length === 0
    const row = Array.from({ length: 9 }, (_, k) => Math.floor(at / 9) * 9 + k)
    const col = Array.from({ length: 9 }, (_, k) => k * 9 + (at % 9))
    const box = Array.from({ length: 9 }, (_, k) => (Math.floor(at / 27) * 3 + Math.floor(k / 3)) * 9 + Math.floor((at % 9) / 3) * 3 + (k % 3))
    expect(basic[at] === bit || peersIn(row) || peersIn(col) || peersIn(box)).toBe(true)
  })

  test('solved grid gives no hint', async () => {
    engine = new HintEngine()
    const { values } = await playWithHints(engine, PUZZLES.medium)
    expect(await engine.hint(formatGrid(values), new Uint16Array(81))).toBeNull()
  }, 60_000)

  test('invalid puzzle rejects with EngineError', async () => {
    engine = new HintEngine()
    await expect(engine.hint('x'.repeat(81), new Uint16Array(81))).rejects.toBeInstanceOf(EngineError)
  })
})

describe('check: a puzzle entered by the player', () => {
  test('one solution: the solution and a level', async () => {
    engine = new HintEngine()
    const result = await engine.check(PUZZLES.expert)
    expect(result.solutions).toBe(1)
    expect(result.level).toMatch(/^(Beginner|Easy|Medium|Intermediate|Hard|Expert|Master|Extreme)$/)
    const solution = parseGrid(result.solution!)
    expect(solution).not.toContain(0)
    parseGrid(PUZZLES.expert).forEach((v, i) => v && expect(solution[i]).toBe(v))
    for (let i = 0; i < 81; i++) for (const p of PEERS[i]) expect(solution[p]).not.toBe(solution[i])
  })

  test('more than one solution: counting stops at 2', async () => {
    engine = new HintEngine()
    expect(await engine.check('.'.repeat(81))).toEqual({ solutions: 2, level: null, solution: null })
  })

  test('no solution, with and without givens that break a rule', async () => {
    engine = new HintEngine()
    // Row 1 leaves R1C9 only 9, which column 9 already has.
    expect(await engine.check('12345678.' + '........9' + '.'.repeat(63))).toEqual({ solutions: 0, level: null, solution: null })
    expect(await engine.check('55' + '.'.repeat(79))).toEqual({ solutions: 0, level: null, solution: null })
  })

  test('invalid text rejects with EngineError', async () => {
    engine = new HintEngine()
    await expect(engine.check('x'.repeat(81))).rejects.toBeInstanceOf(EngineError)
  })
})

describe('load failure', () => {
  const blobWorker = (source: string) => () =>
    new Worker(URL.createObjectURL(new Blob([source], { type: 'text/javascript' })), { type: 'module' })

  test('worker script error rejects with EngineLoadError', async () => {
    engine = new HintEngine(blobWorker('throw new Error("boom")'))
    await expect(engine.hint(PUZZLES.medium, new Uint16Array(81))).rejects.toBeInstanceOf(EngineLoadError)
  })

  test('WASM init failure rejects with EngineLoadError', async () => {
    engine = new HintEngine(
      blobWorker('onmessage = (e) => postMessage({ id: e.data.id, ok: false, error: "load", message: "init failed" })'),
    )
    await expect(engine.hint(PUZZLES.medium, new Uint16Array(81))).rejects.toBeInstanceOf(EngineLoadError)
  })

  test('retry after a load failure starts a fresh worker', async () => {
    let calls = 0
    const failing = blobWorker('throw new Error("boom")')
    engine = new HintEngine(() => (calls++ === 0 ? failing() : new Worker(new URL('./hint.worker.ts', import.meta.url), { type: 'module' })))
    await expect(engine.hint(PUZZLES.medium, new Uint16Array(81))).rejects.toBeInstanceOf(EngineLoadError)
    const values = parseGrid(PUZZLES.medium)
    expect(await engine.hint(PUZZLES.medium, basicCandidates(values))).not.toBeNull()
    expect(calls).toBe(2)
  })
})
