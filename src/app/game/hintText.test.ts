import { describe, expect, test } from 'vitest'
import type { Hint } from '../../engine/protocol'
import { ALL_DIGITS, basicCandidates, parseGrid } from '../../game/grid'
import samples from '../hint-samples.json'
import { conclusionLines, dependentNote, explanation, TECHNIQUE_INTRO } from './hintText'

// One real hint per technique, written by `cargo run --release --example survey -- 60 --dump`
// (engine/examples/survey.rs): the board, the engine candidates and the bridge's answer.
interface Sample {
  name: string
  board: string
  masks: number[]
  hint: Hint
}

const all = samples as unknown as Sample[]
const context = (s: Sample) => ({ basic: basicCandidates(parseGrid(s.board)), masks: Uint16Array.from(s.masks) })
const texts = (s: Sample) => [...conclusionLines(s.hint), ...explanation(s.hint, context(s))]

// The engine's own formats: "(8, 9)" coordinates, ["r1", "r4"] lists, "chain of length", "... found."
const ENGINE_FORMAT = /\(\d, \d\)|\["|chain of length|found\.|chain of \d ALS/

describe('hint texts', () => {
  test('the samples cover the techniques seen in the bank', () => {
    expect(all.length).toBeGreaterThanOrEqual(20)
  })

  test.each(all.map((s) => [s.name, s] as const))('%s: own texts, app format', (_name, s) => {
    const lines = texts(s)
    expect(lines.length).toBeGreaterThan(1)
    for (const line of lines) {
      expect(line).not.toMatch(ENGINE_FORMAT)
      expect(line).not.toMatch(/undefined|NaN|null/)
      expect(line.trim()).toBe(line)
    }
    const cells = lines.join(' ').match(/R\dC\d/g) ?? []
    expect(cells.length).toBeGreaterThan(0)
  })

  test.each(all.map((s) => [s.hint.technique] as const))('%s: step 1 says what the technique is', (name) => {
    expect(TECHNIQUE_INTRO[name]).toMatch(/^[A-Z0-9].*\.$/)
  })

  test('singles that need earlier eliminations say so; the others do not', () => {
    for (const s of all.filter((s) => s.hint.detail.family === 'single')) {
      const note = dependentNote(s.hint, context(s))
      if (s.name.includes('earlier eliminations')) expect(note).toMatch(/ruled out by (an earlier hint|earlier hints)/)
      else expect(note).toBeNull()
    }
  })

  test('eliminations read one line per digit', () => {
    const hint: Hint = {
      technique: 'X-Wing', backtracking: false, place: null, pattern: [], unit: null, marks: [],
      eliminations: [{ cell: 60, values: [6] }, { cell: 69, values: [6, 2] }, { cell: 78, values: [6] }],
      detail: { family: 'other' },
    }
    expect(conclusionLines(hint)).toEqual(['Remove 2 from R8C7', 'Remove 6 from R7C7, R8C7 and R9C7'])
    const one: Hint = { ...hint, eliminations: [{ cell: 0, values: [1, 7] }] }
    expect(conclusionLines(one)).toEqual(['Remove 1 and 7 from R1C1'])
    const pair: Hint = { ...hint, eliminations: [{ cell: 4, values: [6, 7] }, { cell: 13, values: [6, 7] }] }
    expect(conclusionLines(pair)).toEqual(['Remove 6 and 7 from R1C5 and R2C5'])
  })

  test('a naked single with the other candidate ruled out by a hint', () => {
    const basic = new Uint16Array(81).fill(ALL_DIGITS)
    basic[31] = (1 << 2) | (1 << 5)
    const masks = basic.slice()
    masks[31] = 1 << 5
    const hint: Hint = {
      technique: 'Naked Single', backtracking: false, place: { cell: 31, value: 5 }, eliminations: [], pattern: [31], unit: null,
      marks: [[31, 5]], detail: { family: 'single', naked: true, cell: 31, value: 5, unit: null },
    }
    expect(explanation(hint, { basic, masks })).toEqual([
      'R4C5 has only one candidate left: 5.',
      'R4C5 had 2 and 5; 2 was ruled out by an earlier hint.',
    ])
  })
})
