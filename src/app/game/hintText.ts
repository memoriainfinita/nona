import type { ChainNode, Hint } from '../../engine/protocol'
import { cellName, joinDigits } from '../format'

/**
 * Hint texts (design.md, Pistas legibles): built from the bridge's detail, in the app's
 * format (R4C6, "box 5"), never the engine's own explanation.
 */

/** Candidates the card compares: from the placed values alone, and the engine's. */
export interface HintContext {
  basic: Uint16Array
  masks: Uint16Array
}

export function unitName(unit: number): string {
  if (unit < 9) return `row ${unit + 1}`
  if (unit < 18) return `column ${unit - 8}`
  return `box ${unit - 17}`
}

function unitCells(unit: number): number[] {
  return Array.from({ length: 9 }, (_, k) => {
    if (unit < 9) return unit * 9 + k
    if (unit < 18) return k * 9 + (unit - 9)
    const b = unit - 18
    return (Math.floor(b / 3) * 3 + Math.floor(k / 3)) * 9 + (b % 3) * 3 + (k % 3)
  })
}

function unitsOf(cell: number): number[] {
  const r = Math.floor(cell / 9)
  const c = cell % 9
  return [r, 9 + c, 18 + Math.floor(r / 3) * 3 + Math.floor(c / 3)]
}

function inUnit(cell: number, unit: number): boolean {
  return unitCells(unit).includes(cell)
}

function join(items: readonly string[], word = 'and'): string {
  if (items.length <= 1) return items.join('')
  return `${items.slice(0, -1).join(', ')} ${word} ${items.at(-1)}`
}

const cells = (list: readonly number[], word = 'and') => join(list.map(cellName), word)
const digitsOr = (list: readonly number[]) => join(list.map(String), 'or')
const digitsOf = (mask: number) => [1, 2, 3, 4, 5, 6, 7, 8, 9].filter((d) => mask & (1 << d))

/** "rows 3 and 8", or each name when the kinds mix: "row 2, row 7 and column 3". */
function units(list: readonly number[]): string {
  const kind = (u: number) => (u < 9 ? 'row' : u < 18 ? 'column' : 'box')
  if (list.length > 1 && list.every((u) => kind(u) === kind(list[0]))) {
    return `${kind(list[0])}s ${join(list.map((u) => unitName(u).split(' ')[1]))}`
  }
  return join(list.map(unitName))
}

/** The conclusion, one line per digit for eliminations. */
export function conclusionLines(hint: Hint): string[] {
  if (hint.place) return [`${cellName(hint.place.cell)} is ${hint.place.value}`]
  // Digits that leave the same cells share a line: "Remove 6 and 7 from R1C5 and R2C5".
  const byDigit = new Map<number, number[]>()
  for (const e of hint.eliminations) for (const v of e.values) byDigit.set(v, [...(byDigit.get(v) ?? []), e.cell])
  const lines = new Map<string, { digits: number[]; cells: number[] }>()
  for (const [d, list] of [...byDigit.entries()].sort(([a], [b]) => a - b)) {
    const key = list.join()
    const line = lines.get(key) ?? { digits: [], cells: list }
    line.digits.push(d)
    lines.set(key, line)
  }
  return [...lines.values()].map((l) => `Remove ${joinDigits(l.digits)} from ${cells(l.cells)}`)
}

const COUNT = ['', 'one', 'two', 'three', 'four']
const count = (n: number) => COUNT[n] ?? String(n)

/** "rows", "columns", "boxes", or "units" when the kinds mix. */
function plural(list: readonly number[]): string {
  const kinds = new Set(list.map((u) => (u < 9 ? 'rows' : u < 18 ? 'columns' : 'boxes')))
  return kinds.size === 1 ? [...kinds][0] : 'units'
}

/** Explanation paragraphs for step 3. */
export function explanation(hint: Hint, ctx: HintContext): string[] {
  const d = hint.detail
  switch (d.family) {
    case 'single': {
      const where = cellName(d.cell)
      const lines = d.naked
        ? [`${where} has only one candidate left: ${d.value}.`]
        : [`In ${unitName(d.unit!)}, ${d.value} fits only in ${where}.`]
      const note = dependentNote(hint, ctx)
      return note ? [...lines, note] : lines
    }
    case 'subset': {
      if (d.naked) {
        return [
          `${cells(d.cells)} hold only ${joinDigits(d.digits)}, so those ${count(d.cells.length)} digits go in these cells.`,
          `No other cell in ${join(d.units.map(unitName), 'or')} can be ${digitsOr(d.digits)}.`,
        ]
      }
      return [
        `In ${unitName(d.units[0])}, ${joinDigits(d.digits)} fit only in ${cells(d.cells)}.`,
        `So these cells hold ${joinDigits(d.digits)} and nothing else.`,
      ]
    }
    case 'intersection': {
      const [from, to] = [unitName(d.from), unitName(d.to)]
      return [`In ${from}, ${d.digit} fits only where it meets ${to}.`, `Whichever cell it is, the rest of ${to} can't be ${d.digit}.`]
    }
    case 'fish': {
      const lines = [
        `In ${units(d.bases)}, ${d.digit} fits only in ${units(d.covers)}.`,
        `Each of those ${plural(d.bases)} needs a ${d.digit}, so every ${d.digit} of ${units(d.covers)} comes from them.`,
      ]
      if (!d.fins.length) return [...lines, `No other cell in ${units(d.covers)} can be ${d.digit}.`]
      const fin = d.fins.length === 1 ? 'the fin' : 'the fins'
      return [
        ...lines,
        `The exception is ${fin} ${cells(d.fins)}: either the pattern holds or ${d.fins.length === 1 ? 'the fin is' : 'a fin is'} ${d.digit}.`,
        `Cells that also see ${fin} can't be ${d.digit} either way.`,
      ]
    }
    case 'emptyRectangle': {
      const lines = [`In ${unitName(d.box)}, every ${d.digit} lies in ${join(d.lines.map(unitName), 'or')}.`]
      const [a, b] = d.link
      const shared = unitsOf(a).find((u) => inUnit(b, u))
      if (shared !== undefined) lines.push(`In ${unitName(shared)}, ${d.digit} is only in ${cells([a, b], 'or')}.`)
      return [...lines, `Either way, ${cells(targetCells(hint))} can't be ${d.digit}.`]
    }
    case 'als': {
      if (d.z === null) {
        const [core, ...others] = d.sets
        return [
          `${cells(core.cells)} hold ${joinDigits(core.digits)} where ${join(others.map((s) => unitName(s.unit)))} meet.`,
          ...others.map((s) => `With ${cells(s.cells)} (${joinDigits(s.digits)}) in ${unitName(s.unit)}, the rest of ${unitName(s.unit)} can't be ${digitsOr(s.digits)}.`),
        ]
      }
      return [
        'Almost locked sets, each with one more digit than cells:',
        ...d.sets.map((s) => `${s.cells.map(cellName).join(', ')}: ${s.digits.join(', ')}`),
        `${joinDigits(d.links)} can be in only one of them, so one set must hold ${d.z}.`,
        `A cell that sees every ${d.z} in them can't be ${d.z}.`,
      ]
    }
    case 'chain':
      return chainText(d.nodes)
    case 'coloring':
      return [
        `3D Medusa: ${d.nodes.length} candidates coloured in two sets along strong links. One colour is entirely true.`,
        'The conclusion holds whichever colour it is.',
      ]
    case 'rectangle':
      return [
        `${cells(d.corners)} form a rectangle on ${joinDigits(d.digits)} across two boxes.`,
        `If all four ended up as only ${digitsOr(d.digits)}, the puzzle would have two solutions. It has one, and that rules out the conclusion.`,
      ]
    case 'other':
      return ['The highlighted cells form the pattern that leads to the conclusion.']
    case 'backtracking':
      return []
  }
}

/** Alternating chain, read by position: "isn't", "is", "isn't"... The first or the last node is true. */
function chainText(nodes: ChainNode[]): string[] {
  if (nodes.length < 2 || nodes.length % 2) return ['The highlighted cells form a chain that leads to the conclusion.']
  const step = (n: ChainNode, k: number) => `${cellName(n.cell)} ${k % 2 ? 'is' : "isn't"} ${n.digit}`
  const [first, rest] = [nodes[0], nodes.slice(1)]
  const last = nodes[nodes.length - 1]
  const lines = [`If ${step(first, 0)}, then ${rest.map((n, k) => step(n, k + 1)).join(', so ')}.`]
  if (first.cell === last.cell) lines.push(`So ${cellName(first.cell)} is ${digitsOr([first.digit, last.digit])}.`)
  else if (first.digit === last.digit) {
    lines.push(`Either ${cellName(first.cell)} or ${cellName(last.cell)} is ${first.digit}, so a cell that sees both can't be ${first.digit}.`)
  } else lines.push(`Either ${cellName(first.cell)} is ${first.digit} or ${cellName(last.cell)} is ${last.digit}.`)
  return lines
}

/** A single that exists only because earlier hints removed candidates the board still allows. */
export function dependentNote(hint: Hint, { basic, masks }: HintContext): string | null {
  const d = hint.detail
  if (d.family !== 'single') return null
  if (d.naked) {
    const removed = digitsOf(basic[d.cell] & ~masks[d.cell])
    if (!removed.length) return null
    const had = joinDigits(digitsOf(basic[d.cell]))
    return removed.length === 1
      ? `${cellName(d.cell)} had ${had}; ${removed[0]} was ruled out by an earlier hint.`
      : `${cellName(d.cell)} had ${had}; ${joinDigits(removed)} were ruled out by earlier hints.`
  }
  const bit = 1 << d.value
  const others = unitCells(d.unit!).filter((c) => c !== d.cell && basic[c] & bit && !(masks[c] & bit))
  if (!others.length) return null
  return `${d.value} was also possible in ${cells(others)}, ruled out by ${others.length === 1 ? 'an earlier hint' : 'earlier hints'}.`
}

/** Step 1: what the technique is, one fixed sentence per name (the engine's `Display`, plus "Pointing Triple"). */
export const TECHNIQUE_INTRO: Record<string, string> = {
  'Naked Single': 'A cell with only one candidate left.',
  'Hidden Single': 'A digit that fits in only one cell of a row, column or box.',
  'Naked Pair': 'Two cells of one unit that together hold only two digits.',
  'Naked Triple': 'Three cells of one unit that together hold only three digits.',
  'Naked Quad': 'Four cells of one unit that together hold only four digits.',
  'Hidden Pair': 'Two digits that fit only in the same two cells of a unit.',
  'Hidden Triple': 'Three digits that fit only in the same three cells of a unit.',
  'Hidden Quad': 'Four digits that fit only in the same four cells of a unit.',
  'Pointing Pair': 'In a box, a digit that fits only in two cells along one row or column.',
  'Pointing Triple': 'In a box, a digit that fits only in three cells along one row or column.',
  'Box/Line Reduction': 'In a row or column, a digit that fits only inside one box.',
  'X-Wing':
    'A digit that fits in two places in each of two rows, and those places line up in two columns. Or the same with rows and columns swapped.',
  Swordfish: 'The X-Wing idea with three rows and columns.',
  Jellyfish: 'The X-Wing idea with four rows and columns.',
  'Finned X-Wing': 'An X-Wing with one or two extra candidates, the fin, in one box.',
  'Finned Swordfish': 'A Swordfish with one or two extra candidates, the fin, in one box.',
  'Finned Jellyfish': 'A Jellyfish with one or two extra candidates, the fin, in one box.',
  'Franken Fish': 'A fish whose rows or columns include a box.',
  'Mutant Fish': 'A fish that mixes rows, columns and boxes on both sides.',
  'Siamese Fish': 'Two finned fish on the same digit whose fins share a box, read together.',
  'Kraken Fish': 'A finned fish where chains show that every fin leads to the same conclusion.',
  'Empty Rectangle': 'In a box, a digit confined to one row and one column, combined with a link outside the box.',
  'Unique Rectangle':
    "Four cells in two boxes that could swap two digits. The puzzle has one solution, so that pattern can't be completed.",
  'Hidden Rectangle': 'A Unique Rectangle found through strong links on its two digits.',
  'Avoidable Rectangle': "Like a Unique Rectangle, but with cells you've already solved.",
  'Extended Unique Rectangle': 'The Unique Rectangle idea over more cells and more digits.',
  'BUG+1': 'Every unsolved cell has two candidates except one. That one must take the digit that avoids a second solution.',
  'XY-Wing':
    'A cell with two candidates, X and Y, sees two others: one with X and Z, one with Y and Z. One of those two must be Z.',
  'XYZ-Wing': 'Like an XY-Wing, but the middle cell also holds Z.',
  'WXYZ-Wing': 'Four cells holding four digits, arranged so that one digit must land in one of them.',
  'W-Wing': 'Two cells with the same two candidates, joined by a strong link on one of the digits.',
  'X-Chain': 'A chain on a single digit that alternates between "isn\'t" and "is".',
  AIC: 'A chain that alternates between "isn\'t" and "is", across different cells and digits.',
  '3D Medusa': 'Candidates coloured in two sets along strong links. One colour is entirely true.',
  'Sue de Coq': 'Cells where a box meets a row or column, whose candidates split between the two units.',
  'ALS-XZ': 'Two almost locked sets, groups with one more digit than cells, linked by a shared digit.',
  'ALS-XY-Wing': 'Three almost locked sets joined by two shared digits.',
  'ALS Chain': 'A chain of almost locked sets linked by shared digits.',
  'Death Blossom': 'Each candidate of one cell leads into an almost locked set. Whichever is true, a common digit is ruled out.',
  'Aligned Pair Exclusion':
    'Try every combination of two cells that see each other; combinations that would empty another cell are ruled out.',
  'Aligned Triplet Exclusion':
    'Try every combination of three cells that see each other; combinations that would empty another cell are ruled out.',
  'Arithmetic Counting': 'Count how many times digits must appear across several units. A candidate that breaks the count is false.',
  'Nishio Forcing Chain': "Assume a candidate is true. If that leads to a contradiction, it's false.",
  'Cell Forcing Chain': 'Try every candidate of one cell. Whatever they all lead to is true.',
  'Region Forcing Chain': 'Try every place a digit can go in a unit. Whatever they all lead to is true.',
  'Dynamic Forcing Chain': 'A forcing chain that uses the deductions it makes along the way.',
}

/** Cells the hint changes: the placement, or every elimination's cell. */
export function targetCells(hint: Hint): number[] {
  return hint.place ? [hint.place.cell] : hint.eliminations.map((e) => e.cell)
}

/** Cells of the unit to shade. */
export function unitCellsOf(hint: Hint): number[] {
  return hint.unit === null ? [] : unitCells(hint.unit)
}
