import { type Rng, randomInt, shuffled } from './rng'

/**
 * A sudoku symmetry: row and column permutations that keep bands and stacks together,
 * a rotation, and a relabelling of digits. Saved with the game.
 */
export interface Transform {
  /** rows[r] = source row shown at row r. */
  rows: number[]
  /** cols[c] = source column shown at column c. */
  cols: number[]
  /** Clockwise quarter turns, 0-3. */
  rotation: number
  /** digits[v] = digit shown for source digit v; digits[0] = 0. */
  digits: number[]
}

export const IDENTITY: Transform = {
  rows: [0, 1, 2, 3, 4, 5, 6, 7, 8],
  cols: [0, 1, 2, 3, 4, 5, 6, 7, 8],
  rotation: 0,
  digits: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9],
}

/** Permutation of 0..8 that moves whole groups of three and shuffles within each group. */
function groupedPermutation(rng: Rng): number[] {
  const groups = shuffled([0, 1, 2], rng)
  return groups.flatMap((g) => shuffled([0, 1, 2], rng).map((k) => g * 3 + k))
}

export function randomTransform(rng: Rng): Transform {
  return {
    rows: groupedPermutation(rng),
    cols: groupedPermutation(rng),
    rotation: randomInt(rng, 4),
    digits: [0, ...shuffled([1, 2, 3, 4, 5, 6, 7, 8, 9], rng)],
  }
}

/** Applies a transform to 81 values (0 = empty). Use the same transform on puzzle and solution. */
export function applyTransform(values: readonly number[], t: Transform): number[] {
  let grid = Array.from({ length: 81 }, (_, i) => values[t.rows[Math.floor(i / 9)] * 9 + t.cols[i % 9]])
  for (let k = 0; k < t.rotation; k++) {
    const prev = grid
    // Clockwise: new[r][c] = old[8 - c][r]
    grid = Array.from({ length: 81 }, (_, i) => prev[(8 - (i % 9)) * 9 + Math.floor(i / 9)])
  }
  return grid.map((v) => t.digits[v])
}
