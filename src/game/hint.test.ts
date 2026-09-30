import { describe, expect, test } from 'vitest'
import type { Hint } from '../engine/protocol'
import { commit, createGame, type Game, placeMove } from './game'
import { afterWrongRemoved, engineAnswered, engineFailed, nextStage, openHint } from './hint'
import { IDENTITY } from './transform'

const PUZZLE = '.981.6.........389....4...52.531.76.4...2...1.13.648.26...8....321.........4.312.'
const SOLUTION = '598136247164572389732948615285319764476825931913764852649281573321657498857493126'
const digits = (s: string) => [...s].map((ch) => (ch === '.' ? 0 : Number(ch)))

function game(): Game {
  return createGame({
    id: 'g', level: 'medium', seed: 1, daily: null, transform: IDENTITY,
    givens: digits(PUZZLE), solution: digits(SOLUTION), now: 0,
  })
}

function withWrongNumber(): Game {
  const g = game()
  const cell = g.board.values.findIndex((v) => !v)
  const bad = g.solution[cell] === 9 ? 8 : 9
  return commit(g, placeMove(g, cell, bad, false))
}

const HINT: Hint = {
  technique: 'Hidden Single', backtracking: false, kind: 'place', cell: 0, values: [5], cells: [0], explanation: '...',
}

describe('hint card', () => {
  test('without wrong numbers: waits for the engine, counts when the technique shows', () => {
    const open = openHint(game(), 'solution')
    expect(open.session.card.stage).toBe('loading')
    expect(open.count).toBe(false)
    const shown = engineAnswered(open.session, HINT)
    expect(shown.session.card.stage).toBe('technique')
    expect(shown.count).toBe(true)
  })

  test('technique, cells, conclusion', () => {
    let session = engineAnswered(openHint(game(), 'none').session, HINT).session
    session = nextStage(session)
    expect(session.card.stage).toBe('cells')
    session = nextStage(session)
    expect(session.card.stage).toBe('conclusion')
    expect(nextStage(session)).toBe(session)
  })

  test('wrong numbers come first and count, except with errors against the solution', () => {
    const counted = openHint(withWrongNumber(), 'conflicts')
    expect(counted.session.card.stage).toBe('wrong')
    expect(counted.count).toBe(true)
    const free = openHint(withWrongNumber(), 'solution')
    expect(free.session.card.stage).toBe('wrong')
    expect(free.count).toBe(false)
  })

  test('counts at most once per card', () => {
    const open = openHint(withWrongNumber(), 'none')
    expect(open.count).toBe(true)
    const loading = afterWrongRemoved(open.session)
    const shown = engineAnswered(loading.session, HINT)
    expect(shown.count).toBe(false)
  })

  test('after uncounted wrong numbers, the technique counts', () => {
    const open = openHint(withWrongNumber(), 'solution')
    const shown = engineAnswered(afterWrongRemoved(open.session).session, HINT)
    expect(shown.count).toBe(true)
  })

  test('backtracking counts too', () => {
    const shown = engineAnswered(openHint(game(), 'none').session, { ...HINT, backtracking: true, technique: 'Backtracking' })
    expect(shown.count).toBe(true)
  })

  test('engine load failure does not count', () => {
    const failed = engineFailed(openHint(game(), 'none').session)
    expect(failed.session.card.stage).toBe('failed')
    expect(failed.count).toBe(false)
  })
})
