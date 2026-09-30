import type { Level } from '../bank/bank'
import { basicCandidates, conflictCells, PEERS, remainingDigits } from './grid'
import type { Transform } from './transform'

/** Board state. All arrays have 81 entries, row-major. */
export interface Board {
  /** Placed values, givens included; 0 = empty. */
  values: number[]
  /** Player notes: bit v = digit v. */
  notes: number[]
  /** Cell colours: 0 = none, 1-8 = palette. */
  colors: number[]
  /** Engine candidates removed by applied hints (bit v = digit v). Kept apart from the notes. */
  eliminated: number[]
}

export type Field = keyof Board

export interface Change {
  field: Field
  cell: number
  from: number
  to: number
}

/** One undoable step: every change it made to the board. */
export type Move = Change[]

export interface Game {
  id: string
  level: Level
  /** Seed of the base puzzle in the bank (its id). */
  seed: number
  /** UTC date (YYYY-MM-DD) for the daily sudoku, null for a normal game. */
  daily: string | null
  transform: Transform
  givens: number[]
  solution: number[]
  board: Board
  undo: Move[]
  redo: Move[]
  elapsedMs: number
  hintsUsed: number
  createdAt: number
  updatedAt: number
}

export interface NewGame {
  id: string
  level: Level
  seed: number
  daily: string | null
  transform: Transform
  /** Already transformed. */
  givens: number[]
  solution: number[]
  now: number
}

export function createGame({ id, level, seed, daily, transform, givens, solution, now }: NewGame): Game {
  return {
    id,
    level,
    seed,
    daily,
    transform,
    givens: [...givens],
    solution: [...solution],
    board: {
      values: [...givens],
      notes: new Array(81).fill(0),
      colors: new Array(81).fill(0),
      eliminated: new Array(81).fill(0),
    },
    undo: [],
    redo: [],
    elapsedMs: 0,
    hintsUsed: 0,
    createdAt: now,
    updatedAt: now,
  }
}

function applyChanges(board: Board, move: Move, side: 'from' | 'to'): Board {
  const next: Board = {
    values: [...board.values],
    notes: [...board.notes],
    colors: [...board.colors],
    eliminated: [...board.eliminated],
  }
  for (const change of move) next[change.field][change.cell] = change[side]
  return next
}

/** Applies a move and records it for undo. An empty move changes nothing. */
export function commit(game: Game, move: Move): Game {
  if (move.length === 0) return game
  return { ...game, board: applyChanges(game.board, move, 'to'), undo: [...game.undo, move], redo: [] }
}

export function undo(game: Game): Game {
  const move = game.undo.at(-1)
  if (!move) return game
  return {
    ...game,
    board: applyChanges(game.board, move, 'from'),
    undo: game.undo.slice(0, -1),
    redo: [...game.redo, move],
  }
}

export function redo(game: Game): Game {
  const move = game.redo.at(-1)
  if (!move) return game
  return {
    ...game,
    board: applyChanges(game.board, move, 'to'),
    undo: [...game.undo, move],
    redo: game.redo.slice(0, -1),
  }
}

/** Collects changes: one per field and cell, no-ops dropped. */
class MoveBuilder {
  private changes = new Map<string, Change>()
  private readonly board: Board

  constructor(board: Board) {
    this.board = board
  }

  get(field: Field, cell: number): number {
    return this.changes.get(`${field}:${cell}`)?.to ?? this.board[field][cell]
  }

  set(field: Field, cell: number, to: number): void {
    const key = `${field}:${cell}`
    const from = this.changes.get(key)?.from ?? this.board[field][cell]
    if (from === to) this.changes.delete(key)
    else this.changes.set(key, { field, cell, from, to })
  }

  build(): Move {
    return [...this.changes.values()]
  }
}

/** Writes the digit, clears the cell's notes and, with auto-clean, the digit from peer notes. */
function placeInto(m: MoveBuilder, cell: number, digit: number, autoCleanNotes: boolean): void {
  m.set('values', cell, digit)
  m.set('notes', cell, 0)
  if (!autoCleanNotes) return
  for (const p of PEERS[cell]) m.set('notes', p, m.get('notes', p) & ~(1 << digit))
}

/**
 * Writes a digit. Givens never change. Writing the digit a cell already has empties it, even
 * when that digit is complete: the lock of a complete digit only stops adding it.
 */
export function placeMove(game: Game, cell: number, digit: number, autoCleanNotes: boolean): Move {
  if (game.givens[cell]) return []
  const m = new MoveBuilder(game.board)
  if (game.board.values[cell] === digit) {
    m.set('values', cell, 0)
    return m.build()
  }
  if (remainingDigits(game.board.values)[digit] === 0) return []
  placeInto(m, cell, digit, autoCleanNotes)
  return m.build()
}

/** Toggles a note in an empty cell. */
export function toggleNoteMove(game: Game, cell: number, digit: number): Move {
  if (game.board.values[cell]) return []
  const m = new MoveBuilder(game.board)
  m.set('notes', cell, game.board.notes[cell] ^ (1 << digit))
  return m.build()
}

/** Eraser: removes the player's value, or else the cell's notes. Givens and colours stay. */
export function eraseMove(game: Game, cell: number): Move {
  if (game.givens[cell]) return []
  const m = new MoveBuilder(game.board)
  if (game.board.values[cell]) m.set('values', cell, 0)
  else m.set('notes', cell, 0)
  return m.build()
}

/** Colours a whole cell, givens included. 0 removes the colour. */
export function colorMove(game: Game, cell: number, color: number): Move {
  const m = new MoveBuilder(game.board)
  m.set('colors', cell, color)
  return m.build()
}

/** Fills notes in empty cells that have none, from the placed values. Noted cells stay. One move. */
export function autoNotesMove(game: Game): Move {
  const m = new MoveBuilder(game.board)
  const candidates = basicCandidates(game.board.values)
  game.board.values.forEach((v, i) => {
    if (!v && !game.board.notes[i]) m.set('notes', i, candidates[i])
  })
  return m.build()
}

/** Non-given values that differ from the solution. */
export function wrongCells(game: Game): number[] {
  return game.board.values.flatMap((v, i) => (v && !game.givens[i] && v !== game.solution[i] ? [i] : []))
}

/** Removes every wrong value (the hint's wrong-numbers step). One move. */
export function removeWrongMove(game: Game): Move {
  const m = new MoveBuilder(game.board)
  for (const i of wrongCells(game)) m.set('values', i, 0)
  return m.build()
}

/** Candidates the engine works on: from the placed values, minus what applied hints eliminated. */
export function engineCandidates(game: Game): Uint16Array {
  const masks = basicCandidates(game.board.values)
  masks.forEach((mask, i) => (masks[i] = mask & ~game.board.eliminated[i]))
  return masks
}

export interface HintConclusion {
  kind: 'place' | 'eliminate'
  cell: number
  values: number[]
}

/**
 * Apply of a hint. A placement writes the value; an elimination removes the digits from the
 * engine candidates and from the player's notes when present. One move, so undo reverts both.
 */
export function applyHintMove(game: Game, hint: HintConclusion, autoCleanNotes: boolean): Move {
  const m = new MoveBuilder(game.board)
  if (hint.kind === 'place') {
    if (!game.givens[hint.cell]) placeInto(m, hint.cell, hint.values[0], autoCleanNotes)
    return m.build()
  }
  const bits = hint.values.reduce((mask, v) => mask | (1 << v), 0)
  m.set('eliminated', hint.cell, game.board.eliminated[hint.cell] | bits)
  m.set('notes', hint.cell, game.board.notes[hint.cell] & ~bits)
  return m.build()
}

/** Cells marked as errors under the errors setting. */
export function errorCells(game: Game, mode: 'none' | 'conflicts' | 'solution'): Set<number> {
  if (mode === 'none') return new Set()
  if (mode === 'solution') return new Set(wrongCells(game))
  const conflicts = conflictCells(game.board.values)
  for (const i of conflicts) if (game.givens[i]) conflicts.delete(i)
  return conflicts
}

export function isSolved(game: Game): boolean {
  return game.board.values.every((v, i) => v === game.solution[i])
}

export function emptyCells(game: Game): number {
  return game.board.values.filter((v) => !v).length
}

/** Adds play time. The UI calls it while the game screen is visible and not paused. */
export function addTime(game: Game, ms: number): Game {
  return ms > 0 ? { ...game, elapsedMs: game.elapsedMs + ms } : game
}
