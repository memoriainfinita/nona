/** Peers of each cell (same row, column or box), indices 0..80 row-major. */
export const PEERS: readonly (readonly number[])[] = Array.from({ length: 81 }, (_, i) => {
  const r = Math.floor(i / 9)
  const c = i % 9
  const br = r - (r % 3)
  const bc = c - (c % 3)
  const set = new Set<number>()
  for (let k = 0; k < 9; k++) {
    set.add(r * 9 + k)
    set.add(k * 9 + c)
    set.add((br + Math.floor(k / 3)) * 9 + bc + (k % 3))
  }
  set.delete(i)
  return [...set]
})

/** All digits 1-9 as a candidate mask (bit v = digit v). */
export const ALL_DIGITS = 0x3fe

/** Parses an 81-char puzzle ('.' or '0' for empty) into values, 0 for empty. */
export function parseGrid(puzzle: string): number[] {
  if (puzzle.length !== 81) throw new Error('expected 81 cells')
  return [...puzzle].map((ch) => (ch === '.' || ch === '0' ? 0 : Number(ch)))
}

export function formatGrid(values: readonly number[]): string {
  return values.map((v) => (v ? String(v) : '.')).join('')
}

/** Candidates from the placed values alone: for each empty cell, digits not used by its peers. */
export function basicCandidates(values: readonly number[]): Uint16Array {
  const masks = new Uint16Array(81)
  values.forEach((v, i) => {
    if (v) return
    let mask = ALL_DIGITS
    for (const p of PEERS[i]) if (values[p]) mask &= ~(1 << values[p])
    masks[i] = mask
  })
  return masks
}

/** Cells whose value repeats in their row, column or box. */
export function conflictCells(values: readonly number[]): Set<number> {
  const out = new Set<number>()
  values.forEach((v, i) => {
    if (v && PEERS[i].some((p) => values[p] === v)) out.add(i)
  })
  return out
}

/** How many of each digit are still missing: remaining[v] for v 1-9 (index 0 unused). */
export function remainingDigits(values: readonly number[]): number[] {
  const remaining = [0, 9, 9, 9, 9, 9, 9, 9, 9, 9]
  for (const v of values) if (v) remaining[v]--
  return remaining
}
