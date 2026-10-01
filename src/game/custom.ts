import type { Level } from '../bank/bank'

/**
 * A puzzle entered by the player (design.md, Sudoku propio). The engine's difficulty becomes an
 * app level as in the bank; the two the bank has no list for go to the nearest one.
 */
const LEVEL_OF: Record<string, Level> = {
  Beginner: 'easy',
  Easy: 'easy',
  Medium: 'medium',
  Intermediate: 'intermediate',
  Hard: 'hard',
  Expert: 'expert',
  Master: 'master',
  Extreme: 'master',
}

export function customLevel(engineLevel: string): Level {
  const level = LEVEL_OF[engineLevel]
  if (!level) throw new Error(`unknown engine level ${engineLevel}`)
  return level
}

/** Pasted text: 81 cells of 1-9, with '.' or '0' for empty; whitespace and line breaks are ignored. */
export function parsePasted(text: string): number[] | null {
  const cells = text.replace(/\s/g, '')
  if (!/^[0-9.]{81}$/.test(cells)) return null
  return [...cells].map((ch) => (ch === '.' ? 0 : Number(ch)))
}
