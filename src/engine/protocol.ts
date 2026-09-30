/** A hint from the engine. Cells are indices 0..80, row-major. */
export interface Hint {
  /** Readable technique name, e.g. "Naked Single". */
  technique: string
  /** No logical step found: the engine fell back to backtracking. */
  backtracking: boolean
  kind: 'place' | 'eliminate'
  cell: number
  /** The placed value for "place", the removed candidates for "eliminate". */
  values: number[]
  cells: number[]
  explanation: string
}

export interface HintRequest {
  id: number
  /** 81 chars, '.' for empty cells. */
  puzzle: string
  /** Engine candidates: masks[i] has bit v set for digit v. */
  masks: Uint16Array
}

export type HintResponse =
  | { id: number; ok: true; hint: Hint | null }
  | { id: number; ok: false; error: 'load' | 'engine'; message: string }
