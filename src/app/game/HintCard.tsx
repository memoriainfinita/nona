import type { HintSession } from '../../game/hint'
import { cellName, joinDigits } from '../format'

interface Props {
  session: HintSession
  /** The engine answered before: no loading message. */
  engineReady: boolean
  onNext: () => void
  onClose: () => void
}

interface Text {
  kicker: string
  title: string
  body?: string
  next: string
  step?: number
  mistake?: boolean
  busy?: boolean
}

function text(session: HintSession, engineReady: boolean): Text {
  const { card } = session
  switch (card.stage) {
    case 'wrong': {
      const n = card.cells.length
      return {
        kicker: 'HINT · MISTAKE',
        title: n === 1 ? 'There is 1 mistake on the board' : `There are ${n} mistakes on the board`,
        body: n === 1 ? 'The highlighted number is not part of the solution.' : 'The highlighted numbers are not part of the solution.',
        next: n === 1 ? 'Remove it' : 'Remove them',
        mistake: true,
      }
    }
    case 'loading':
      return engineReady
        ? { kicker: 'HINT', title: 'Looking for the next step…', next: 'Loading…', busy: true }
        : { kicker: 'HINT', title: 'Loading the hint engine…', body: 'Only before the first hint. It stays loaded while you play.', next: 'Loading…', busy: true }
    case 'failed':
      return { kicker: 'HINT', title: 'Couldn’t load the hint engine', next: 'Retry' }
    default: {
      const { hint } = card
      const conclusion =
        hint.kind === 'place'
          ? `${cellName(hint.cell)} is ${hint.values[0]}`
          : `Remove ${joinDigits(hint.values)} from ${cellName(hint.cell)}`
      if (hint.backtracking) {
        if (card.stage === 'technique') return { kicker: 'HINT', title: 'No logical step found', next: 'Show cell', step: 1 }
        if (card.stage === 'cells') return { kicker: 'HINT · NO LOGICAL STEP', title: 'Look at the highlighted cell.', next: 'Show value', step: 2 }
        return { kicker: 'HINT · NO LOGICAL STEP', title: conclusion, next: 'Apply', step: 3 }
      }
      const name = hint.technique.toUpperCase()
      if (card.stage === 'technique') return { kicker: 'HINT · LOOK FOR A', title: hint.technique, next: 'Show cells', step: 1 }
      if (card.stage === 'cells') return { kicker: `HINT · ${name}`, title: 'Look at the highlighted cells.', next: 'Show conclusion', step: 2 }
      return { kicker: `HINT · ${name}`, title: conclusion, body: hint.explanation, next: 'Apply', step: 3 }
    }
  }
}

export function HintCard({ session, engineReady, onNext, onClose }: Props) {
  const t = text(session, engineReady)
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
      <p className="hint-title">{t.title}</p>
      {t.body && <p className="hint-body">{t.body}</p>}
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
