export const LEVELS = ['easy', 'medium', 'intermediate', 'hard', 'expert', 'master'] as const
export type Level = (typeof LEVELS)[number]

export interface BankPuzzle {
  /** Generator seed; the puzzle's id. */
  seed: number
  /** 81 chars, '.' for empty cells. */
  puzzle: string
  /** 81 digits. */
  solution: string
}

export interface DailyPuzzle extends BankPuzzle {
  level: Level
}

// One chunk per file, loaded when needed. Both sets only grow at the end (see design.md, Banco).
const files = import.meta.glob<BankPuzzle[]>(['../../bank/*.json', '!../../bank/meta.json'], {
  import: 'default',
})

function load<T>(name: string): Promise<T> {
  const loader = files[`../../bank/${name}.json`]
  if (!loader) throw new Error(`no bank file ${name}`)
  return loader() as Promise<T>
}

export const loadLevel = (level: Level) => load<BankPuzzle[]>(level)
export const loadDaily = () => load<DailyPuzzle[]>('daily')
