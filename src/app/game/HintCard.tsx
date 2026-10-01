import { engineCandidates, type Game } from '../../game/game'
import { basicCandidates } from '../../game/grid'
import type { HintSession } from '../../game/hint'
import { conclusionLines, explanation, TECHNIQUE_INTRO, type HintContext } from './hintText'

interface Props {
  session: HintSession
  /** The board the hint was asked on: the card compares its candidates. */
  game: Game
  /** The engine answered before: no loading message. */
  engineReady: boolean
  onNext: () => void
  onClose: () => void
}

interface Text {
  kicker: string
  /** One line each; several for eliminations of more than one digit. */
  title: string[]
  body?: string[]
  next: string
  step?: number
  mistake?: boolean
  busy?: boolean
}

function text(session: HintSession, engineReady: boolean, ctx: HintContext): Text {
  const { card } = session
  switch (card.stage) {
    case 'wrong': {
      const n = card.cells.length
      return {
        kicker: 'HINT · MISTAKE',
        title: [n === 1 ? 'There is 1 mistake on the board' : `There are ${n} mistakes on the board`],
        body: [n === 1 ? 'The highlighted number is not part of the solution.' : 'The highlighted numbers are not part of the solution.'],
        next: n === 1 ? 'Remove it' : 'Remove them',
        mistake: true,
      }
    }
    case 'loading':
      return engineReady
        ? { kicker: 'HINT', title: ['Looking for the next step…'], next: 'Loading…', busy: true }
        : { kicker: 'HINT', title: ['Loading the hint engine…'], body: ['Only before the first hint. It stays loaded while you play.'], next: 'Loading…', busy: true }
    case 'failed':
      return { kicker: 'HINT', title: ['Couldn’t load the hint engine'], next: 'Retry' }
    default: {
      const { hint } = card
      const conclusion = conclusionLines(hint)
      if (hint.backtracking) {
        if (card.stage === 'technique') return { kicker: 'HINT', title: ['No logical step found'], next: 'Show cell', step: 1 }
        if (card.stage === 'cells') return { kicker: 'HINT · NO LOGICAL STEP', title: ['Look at the highlighted cell.'], next: 'Show value', step: 2 }
        return { kicker: 'HINT · NO LOGICAL STEP', title: conclusion, next: 'Apply', step: 3 }
      }
      const name = hint.technique.toUpperCase()
      if (card.stage === 'technique') {
        const intro = TECHNIQUE_INTRO[hint.technique]
        return { kicker: 'HINT · LOOK FOR A', title: [hint.technique], body: intro ? [intro] : undefined, next: 'Show cells', step: 1 }
      }
      if (card.stage === 'cells') return { kicker: `HINT · ${name}`, title: ['Look at the highlighted cells.'], next: 'Show conclusion', step: 2 }
      return { kicker: `HINT · ${name}`, title: conclusion, body: explanation(hint, ctx), next: 'Apply', step: 3 }
    }
  }
}

export function HintCard({ session, game, engineReady, onNext, onClose }: Props) {
  const t = text(session, engineReady, { basic: basicCandidates(game.board.values), masks: engineCandidates(game) })
  return (
    <section className={`hint-card${t.mistake ? ' mistake' : ''}`} aria-live="polite" aria-label="Hint">
      <div className="hint-head">
        <span className="kicker">{t.kicker}</span>
        {t.step && (
          <span className="dots" aria-label={`Step ${t.step} of 3`}>
            {[1, 2, 3].map((n) => (
              <span key={n} className={n <= t.step! ? 'dot on' : 'dot'} />
            ))}
          </span>
        )}
      </div>
      <div className="hint-text">
        {t.title.map((line) => (
          <p key={line} className="hint-title">
            {line}
          </p>
        ))}
        {t.body?.map((line) => (
          <p key={line} className="hint-body">
            {line}
          </p>
        ))}
      </div>
      <div className="hint-actions">
        <button type="button" className="btn ghost" onClick={onClose}>
          Close
        </button>
        <button type="button" className="btn primary" onClick={onNext} disabled={t.busy}>
          {t.next}
        </button>
      </div>
    </section>
  )
}
