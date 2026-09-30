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

/** Cells the hint changes: the placement, or every elimination's cell. */
export function targetCells(hint: Hint): number[] {
  return hint.place ? [hint.place.cell] : hint.eliminations.map((e) => e.cell)
}

/** Cells of the unit to shade. */
export function unitCellsOf(hint: Hint): number[] {
  return hint.unit === null ? [] : unitCells(hint.unit)
}
