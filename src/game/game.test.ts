import fc from 'fast-check'
import { describe, expect, test } from 'vitest'
import { loadLevel } from '../bank/bank'
import {
  applyHintMove,
  autoNotesMove,
  colorMove,
  commit,
  createGame,
  engineCandidates,
  eraseMove,
  errorCells,
  type Game,
  isSolved,
  type Move,
  placeMove,
  redo,
  removeWrongMove,
  toggleNoteMove,
  undo,
  wrongCells,
} from './game'
import { basicCandidates, PEERS, remainingDigits } from './grid'
import { IDENTITY } from './transform'

const bank = await loadLevel('medium')
const digits = (s: string) => [...s].map((ch) => (ch === '.' ? 0 : Number(ch)))

function newGame(k = 0): Game {
  return createGame({
    id: 'g',
    level: 'medium',
    seed: bank[k].seed,
    daily: null,
    transform: IDENTITY,
    givens: digits(bank[k].puzzle),
    solution: digits(bank[k].solution),
    now: 0,
  })
}

const firstEmpty = (g: Game) => g.board.values.findIndex((v) => v === 0)

// Any action a player (or an applied elimination hint) can make.
const action = fc.oneof(
  fc.record({ type: fc.constant('place'), cell: fc.nat(80), digit: fc.integer({ min: 1, max: 9 }), clean: fc.boolean() }),
  fc.record({ type: fc.constant('note'), cell: fc.nat(80), digit: fc.integer({ min: 1, max: 9 }) }),
  fc.record({ type: fc.constant('erase'), cell: fc.nat(80) }),
  fc.record({ type: fc.constant('color'), cell: fc.nat(80), color: fc.nat(8) }),
  fc.record({ type: fc.constant('autoNotes') }),
  fc.record({ type: fc.constant('removeWrong') }),
  fc.record({ type: fc.constant('eliminate'), cell: fc.nat(80), digit: fc.integer({ min: 1, max: 9 }) }),
)
type Action = typeof action extends fc.Arbitrary<infer A> ? A : never

function moveFor(g: Game, a: Action): Move {
  switch (a.type) {
    case 'place':
      return placeMove(g, a.cell, a.digit, a.clean)
    case 'note':
      return toggleNoteMove(g, a.cell, a.digit)
    case 'erase':
      return eraseMove(g, a.cell)
    case 'color':
      return colorMove(g, a.cell, a.color)
    case 'autoNotes':
      return autoNotesMove(g)
    case 'removeWrong':
      return removeWrongMove(g)
    case 'eliminate':
      return applyHintMove(g, { kind: 'eliminate', cell: a.cell, values: [a.digit] }, true)
  }
}

const play = (g: Game, actions: Action[]) => actions.reduce((acc, a) => commit(acc, moveFor(acc, a)), g)

describe('undo and redo', () => {
  test('undoing every move returns to the start; redoing all returns to the end', () => {
    fc.assert(
      fc.property(fc.array(action, { maxLength: 60 }), (actions) => {
        const start = newGame()
        const end = play(start, actions)
        let g = end
        while (g.undo.length) g = undo(g)
        expect(g.board).toEqual(start.board)
        while (g.redo.length) g = redo(g)
        expect(g.board).toEqual(end.board)
      }),
    )
  })

  test('a new move clears redo', () => {
    let g = newGame()
    const cell = firstEmpty(g)
    g = commit(g, placeMove(g, cell, 1, true))
    g = undo(g)
    expect(g.redo).toHaveLength(1)
    g = commit(g, toggleNoteMove(g, cell, 2))
    expect(g.redo).toHaveLength(0)
  })
})

describe('rules', () => {
  test('givens never change', () => {
    fc.assert(
      fc.property(fc.array(action, { maxLength: 60 }), (actions) => {
        const g = play(newGame(), actions)
        g.givens.forEach((v, i) => v && expect(g.board.values[i]).toBe(v))
      }),
    )
  })

  test('writing the digit a cell already has empties it', () => {
    let g = newGame()
    const cell = firstEmpty(g)
    g = commit(g, placeMove(g, cell, 5, true))
    expect(g.board.values[cell]).toBe(5)
    g = commit(g, placeMove(g, cell, 5, true))
    expect(g.board.values[cell]).toBe(0)
  })

  test('a complete digit cannot be added but can be removed', () => {
    let g = newGame()
    const solution = g.solution
    // Fill every cell of digit 1 from the solution.
    solution.forEach((v, i) => {
      if (v === 1 && !g.board.values[i]) g = commit(g, placeMove(g, i, 1, true))
    })
    expect(remainingDigits(g.board.values)[1]).toBe(0)
    const other = firstEmpty(g)
    expect(placeMove(g, other, 1, true)).toEqual([])
    const placed = solution.findIndex((v, i) => v === 1 && !g.givens[i])
    g = commit(g, placeMove(g, placed, 1, true))
    expect(g.board.values[placed]).toBe(0)
  })

  test('auto-clean removes the digit from peer notes; off, the notes stay', () => {
    fc.assert(
      fc.property(fc.integer({ min: 1, max: 9 }), fc.boolean(), (digit, clean) => {
        let g = newGame()
        g = commit(g, autoNotesMove(g))
        const cell = firstEmpty(g)
        const before = g.board.notes
        g = commit(g, placeMove(g, cell, digit, clean))
        expect(g.board.notes[cell]).toBe(0)
        for (const p of PEERS[cell]) {
          if (clean) expect(g.board.notes[p] & (1 << digit)).toBe(0)
          else expect(g.board.notes[p]).toBe(before[p])
        }
      }),
    )
  })

  test('auto notes fills only empty cells without notes, as one move', () => {
    let g = newGame()
    const noted = firstEmpty(g)
    g = commit(g, toggleNoteMove(g, noted, 9))
    const undoBefore = g.undo.length
    g = commit(g, autoNotesMove(g))
    expect(g.undo.length).toBe(undoBefore + 1)
    expect(g.board.notes[noted]).toBe(1 << 9)
    const candidates = basicCandidates(g.board.values)
    g.board.values.forEach((v, i) => {
      if (v) expect(g.board.notes[i]).toBe(0)
      else if (i !== noted) expect(g.board.notes[i]).toBe(candidates[i])
    })
  })

  test('notes only go in empty cells; the eraser takes the value first, then the notes', () => {
    let g = newGame()
    const cell = firstEmpty(g)
    g = commit(g, toggleNoteMove(g, cell, 3))
    g = commit(g, placeMove(g, cell, 4, false))
    expect(toggleNoteMove(g, cell, 5)).toEqual([])
    g = commit(g, eraseMove(g, cell))
    expect(g.board.values[cell]).toBe(0)
    g = undo(undo(g))
    expect(g.board.notes[cell]).toBe(1 << 3)
    g = commit(g, eraseMove(g, cell))
    expect(g.board.notes[cell]).toBe(0)
  })

  test('colours go on any cell, givens included, and 0 removes them', () => {
    let g = newGame()
    const given = g.givens.findIndex(Boolean)
    g = commit(g, colorMove(g, given, 3))
    expect(g.board.colors[given]).toBe(3)
    g = commit(g, colorMove(g, given, 0))
    expect(g.board.colors[given]).toBe(0)
  })
})

describe('hints on the board', () => {
  test('an elimination removes engine candidates and player notes; undo restores both', () => {
    let g = newGame()
    g = commit(g, autoNotesMove(g))
    const cell = firstEmpty(g)
    const digit = [1, 2, 3, 4, 5, 6, 7, 8, 9].find((v) => v !== g.solution[cell] && g.board.notes[cell] & (1 << v))!
    const notesBefore = g.board.notes[cell]
    g = commit(g, applyHintMove(g, { kind: 'eliminate', cell, values: [digit] }, true))
    expect(g.board.notes[cell] & (1 << digit)).toBe(0)
    expect(engineCandidates(g)[cell] & (1 << digit)).toBe(0)
    g = undo(g)
    expect(g.board.notes[cell]).toBe(notesBefore)
    expect(engineCandidates(g)[cell] & (1 << digit)).not.toBe(0)
  })

  test('an elimination on a cell without notes changes no notes but is applied', () => {
    const g = newGame()
    const cell = firstEmpty(g)
    const move = applyHintMove(g, { kind: 'eliminate', cell, values: [g.solution[cell] === 1 ? 2 : 1] }, true)
    expect(move.map((c) => c.field)).toEqual(['eliminated'])
  })

  test('a placement writes the value', () => {
    let g = newGame()
    const cell = firstEmpty(g)
    g = commit(g, applyHintMove(g, { kind: 'place', cell, values: [g.solution[cell]] }, true))
    expect(g.board.values[cell]).toBe(g.solution[cell])
  })

  test('removing wrong numbers keeps right ones', () => {
    let g = newGame()
    const cells = g.board.values.flatMap((v, i) => (v ? [] : [i])).slice(0, 2)
    const [right, wrong] = cells
    g = commit(g, placeMove(g, right, g.solution[right], false))
    const remaining = remainingDigits(g.board.values)
    const bad = [1, 2, 3, 4, 5, 6, 7, 8, 9].find((v) => v !== g.solution[wrong] && remaining[v] > 0)!
    g = commit(g, placeMove(g, wrong, bad, false))
    expect(wrongCells(g)).toEqual([wrong])
    g = commit(g, removeWrongMove(g))
    expect(g.board.values[right]).toBe(g.solution[right])
    expect(g.board.values[wrong]).toBe(0)
  })
})

describe('errors and completion', () => {
  test('error modes', () => {
    let g = newGame()
    const cell = firstEmpty(g)
    const peerGiven = PEERS[cell].find((p) => g.givens[p])!
    g = commit(g, placeMove(g, cell, g.givens[peerGiven], false))
    expect(errorCells(g, 'none').size).toBe(0)
    expect([...errorCells(g, 'conflicts')]).toEqual([cell])
    expect([...errorCells(g, 'solution')]).toEqual([cell])
  })

  test('filling the solution solves the game', () => {
    let g = newGame()
    g.solution.forEach((v, i) => {
      if (!g.board.values[i]) g = commit(g, placeMove(g, i, v, true))
    })
    expect(isSolved(g)).toBe(true)
  })
})
