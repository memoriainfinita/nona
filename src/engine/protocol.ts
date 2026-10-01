/**
 * A hint from the bridge (engine/src/lib.rs). Cells are indices 0..80, row-major. Units are
 * 0..26: rows 0..8, columns 9..17, boxes 18..26.
 */
export interface Hint {
  /** Readable technique name, e.g. "Naked Single". */
  technique: string
  /** No logical step found: the engine fell back to backtracking. */
  backtracking: boolean
  /** The placement; null for an elimination hint. */
  place: Placement | null
  /** Every elimination of the pattern, one per cell. Empty for a placement. */
  eliminations: Elimination[]
  /** Cells that form the pattern. */
  pattern: number[]
  /** Unit to shade (hidden singles, intersections). */
  unit: number | null
  /** Key candidates to highlight, as [cell, digit]. */
  marks: [number, number][]
  detail: HintDetail
}

export interface Placement {
  cell: number
  value: number
}

export interface Elimination {
  cell: number
  values: number[]
}

export interface ChainNode {
  cell: number
  digit: number
  on: boolean
}

/** Data for the explanation, one shape per family of techniques. */
export type HintDetail =
  | { family: 'single'; naked: boolean; cell: number; value: number; unit: number | null }
  | { family: 'subset'; naked: boolean; cells: number[]; digits: number[]; units: number[] }
  | { family: 'intersection'; pointing: boolean; digit: number; from: number; to: number }
  | { family: 'fish'; digit: number; bases: number[]; covers: number[]; fins: number[] }
  | { family: 'emptyRectangle'; digit: number; box: number; lines: number[]; link: number[] }
  | { family: 'als'; sets: { cells: number[]; digits: number[]; unit: number }[]; links: number[]; z: number | null }
  | { family: 'chain'; nodes: ChainNode[] }
  | { family: 'coloring'; nodes: ChainNode[] }
  | { family: 'rectangle'; corners: number[]; digits: number[] }
  | { family: 'other' }
  | { family: 'backtracking' }

export interface HintRequest {
  id: number
  type: 'hint'
  /** 81 chars, '.' for empty cells. */
  puzzle: string
  /** Engine candidates: masks[i] has bit v set for digit v. */
  masks: Uint16Array
}

/** A puzzle entered by the player: how many solutions, and its level and solution if just one. */
export interface CheckRequest {
  id: number
  type: 'check'
  /** 81 chars, '.' for empty cells. */
  puzzle: string
}

export type EngineRequest = HintRequest | CheckRequest

export interface CheckResult {
  /** Counting stops at 2. */
  solutions: 0 | 1 | 2
  /** The engine's difficulty name ("Beginner" ... "Extreme"), only with one solution. */
  level: string | null
  /** 81 digits, only with one solution. */
  solution: string | null
}

export type EngineResponse =
  | { id: number; ok: true; result: Hint | null | CheckResult }
  | { id: number; ok: false; error: 'load' | 'engine'; message: string }
