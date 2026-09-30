import type { Hint } from '../engine/protocol'
import { type Game, wrongCells } from './game'
import type { Settings } from './settings'

/**
 * The hint card (design.md, Pistas). With wrong numbers on the board, the first stage marks
 * them; otherwise the card waits for the engine and then shows technique, cells and conclusion.
 */
export type HintCard =
  | { stage: 'wrong'; cells: number[] }
  | { stage: 'loading' }
  | { stage: 'technique' | 'cells' | 'conclusion'; hint: Hint }
  | { stage: 'failed' }

export interface HintSession {
  card: HintCard
  /** The hint already counted in game.hintsUsed. Counted at most once per session. */
  counted: boolean
}

/** A stage change, plus whether the hint counts as used from now on. */
export interface HintStep {
  session: HintSession
  count: boolean
}

function enter(session: HintSession, card: HintCard, counts: boolean): HintStep {
  const count = counts && !session.counted
  return { session: { card, counted: session.counted || count }, count }
}

/**
 * Opens the card. The wrong-numbers stage counts, except with "Errors against the solution"
 * on: those errors are already on screen.
 */
export function openHint(game: Game, errors: Settings['errors']): HintStep {
  const start: HintSession = { card: { stage: 'loading' }, counted: false }
  const cells = wrongCells(game)
  if (cells.length) return enter(start, { stage: 'wrong', cells }, errors !== 'solution')
  return { session: start, count: false }
}

/** After the wrong numbers are removed, the card asks the engine. */
export function afterWrongRemoved(session: HintSession): HintStep {
  return enter(session, { stage: 'loading' }, false)
}

/** The engine answered. Showing the technique counts, backtracking included. */
export function engineAnswered(session: HintSession, hint: Hint): HintStep {
  return enter(session, { stage: 'technique', hint }, true)
}

/** The engine could not be loaded: the card offers Retry and the hint does not count. */
export function engineFailed(session: HintSession): HintStep {
  return enter(session, { stage: 'failed' }, false)
}

/** Enter: technique, then cells, then conclusion. On the conclusion the caller applies instead. */
export function nextStage(session: HintSession): HintSession {
  const { card } = session
  if (card.stage === 'technique') return { ...session, card: { stage: 'cells', hint: card.hint } }
  if (card.stage === 'cells') return { ...session, card: { stage: 'conclusion', hint: card.hint } }
  return session
}

export function countHint(game: Game): Game {
  return { ...game, hintsUsed: game.hintsUsed + 1 }
}
