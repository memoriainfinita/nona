import { useCallback, useEffect, useState } from 'react'
import { LEVELS } from '../../bank/bank'
import { emptyCells } from '../../game/game'
import { activity, bestTimes, type HistoryEntry, recent, totals } from '../../game/records'
import { formatHistoryDate, formatTime, LEVEL_NAMES, weekdayLetter } from '../format'
import type { Layout } from '../layout'
import { useStore } from '../store'
import { Dialog, PageHeader } from '../ui'

/** Completed games per day for the last 7 days, as SVG bars. */
function ActivityChart({ days }: { days: { date: string; count: number }[] }) {
  const max = Math.max(1, ...days.map((d) => d.count))
  const w = 100 / days.length
  const H = 120
  return (
    <figure className="chart">
      <svg viewBox={`0 0 100 ${H + 16}`} preserveAspectRatio="none" role="img" aria-label="Completed puzzles in the last 7 days">
        {days.map((d, i) => {
          const h = d.count ? Math.max(4, (d.count / max) * (H - 4)) : 3
          return (
            <g key={d.date}>
              <title>{`${d.date}: ${d.count}`}</title>
              <rect x={i * w + w * 0.14} y={H + 16 - h} width={w * 0.72} height={h} rx="1.2" className={d.count ? 'bar' : 'bar empty'} />
            </g>
          )
        })}
      </svg>
      <div className="chart-labels" aria-hidden="true">
        {days.map((d) => (
          <span key={d.date}>
            <b>{d.count}</b>
            {weekdayLetter(d.date)}
          </span>
        ))}
      </div>
    </figure>
  )
}

/** Solved board, read only: givens as on the game board, the rest in the accent. */
function SolvedBoard({ givens, solution }: { givens: number[]; solution: number[] }) {
  return (
    <div className="board readonly" role="img" aria-label="Solved sudoku">
      {solution.map((v, i) => {
        const classes = ['cell']
        if (i % 9 === 2 || i % 9 === 5) classes.push('box-right')
        if (Math.floor(i / 9) === 2 || Math.floor(i / 9) === 5) classes.push('box-bottom')
        return (
          <div key={i} className={classes.join(' ')}>
            <span className={givens[i] ? 'value given' : 'value'}>{v}</span>
          </div>
        )
      })}
    </div>
  )
}

type Viewed = { givens: number[]; solution: number[] } | 'loading' | 'missing'

/** A history entry: the solved puzzle as it was played, and Play again. */
function HistoryDialog({ entry, sheet, onClose }: { entry: HistoryEntry; sheet: boolean; onClose: () => void }) {
  const store = useStore()
  const [viewed, setViewed] = useState<Viewed>('loading')
  useEffect(() => {
    let live = true
    void store.puzzleOf(entry).then((p) => live && setViewed(p ? { givens: p.givens, solution: p.solution } : 'missing'))
    return () => {
      live = false
    }
  }, [store, entry])
  const playAgain = async () => {
    if (await store.replay(entry)) window.location.hash = '/play'
  }
  const title = `${entry.daily ? 'Daily · ' : ''}${LEVEL_NAMES[entry.level]}`
  return (
    <Dialog
      title={title}
      sheet={sheet}
      onCancel={onClose}
      actions={[
        { label: 'Close', kind: 'ghost', onClick: onClose },
        ...(viewed === 'missing' ? [] : [{ label: 'Play again', kind: 'primary' as const, onClick: () => void playAgain() }]),
      ]}
    >
      <p>
        {formatTime(entry.timeMs)}
        {entry.hintsUsed > 0 ? ' · with hints' : ''} · {formatHistoryDate(entry.completedAt)}
      </p>
      {viewed === 'missing' ? (
        <p>This puzzle is no longer in the bank.</p>
      ) : viewed === 'loading' ? (
        <div className="board readonly" aria-busy="true" />
      ) : (
        <SolvedBoard givens={viewed.givens} solution={viewed.solution} />
      )}
      {!entry.transform && viewed !== 'missing' && (
        <p className="small">Saved before games kept their orientation: this is the same puzzle, maybe rotated or with other digits.</p>
      )}
    </Dialog>
  )
}

export function Stats({ layout }: { layout: Layout }) {
  const store = useStore()
  const [open, setOpen] = useState<HistoryEntry | null>(null)
  const close = useCallback(() => setOpen(null), [])
  const { completed, xp } = totals(store.history)
  const best = bestTimes(store.history)
  const last = recent(store.history)
  const now = Date.now()
  return (
    <main className={`page stats page-${layout.kind}`}>
      <PageHeader title="Stats" back={!layout.sidebar} />
      <div className="tiles">
        <div className="tile">
          <span className="section-title">COMPLETED</span>
          <span className="tile-value">{completed.toLocaleString('en-GB')}</span>
        </div>
        <div className="tile">
          <span className="section-title">XP</span>
          <span className="tile-value accent-text">{xp.toLocaleString('en-GB')}</span>
        </div>
      </div>
      <section className="stack">
        <h2 className="section-title">IN PROGRESS</h2>
        {store.games.map((g) => (
          <button key={g.id} type="button" className="ongoing-main row-link" onClick={() => {
            store.setActiveId(g.id)
            window.location.hash = '/play'
          }}>
            <span className="ongoing-text">
              <span className="ongoing-level">{g.daily ? `Daily · ${LEVEL_NAMES[g.level]}` : LEVEL_NAMES[g.level]}</span>
              <span className="muted small">
                {formatTime(g.elapsedMs)} · {emptyCells(g)} cells left
              </span>
            </span>
            <span className="accent-text strong">Continue</span>
          </button>
        ))}
        {store.games.length === 0 && <p className="muted">No games in progress.</p>}
      </section>
      <section className="stack">
        <h2 className="section-title">LAST 7 DAYS</h2>
        <ActivityChart days={activity(store.history, now)} />
      </section>
      <section className="list">
        <h2 className="section-title">BEST TIMES</h2>
        {LEVELS.map((l) => (
          <div key={l} className="list-row">
            <span>{LEVEL_NAMES[l]}</span>
            <span className={best[l] === undefined ? 'num muted' : 'num'}>{best[l] === undefined ? '—' : formatTime(best[l])}</span>
          </div>
        ))}
      </section>
      <section className="list">
        <h2 className="section-title">HISTORY</h2>
        {last.map((h) => (
          <button key={h.id} type="button" className="list-row history-row" onClick={() => setOpen(h)}>
            <span className="grow">
              {h.daily ? 'Daily · ' : ''}
              {LEVEL_NAMES[h.level]}
              {h.hintsUsed > 0 && <span className="muted small"> · hints</span>}
            </span>
            <span className="muted small">{formatHistoryDate(h.completedAt, now)}</span>
            <span className="num time">{formatTime(h.timeMs)}</span>
          </button>
        ))}
        {last.length === 0 && <p className="muted">Solved puzzles will show up here.</p>}
      </section>
      {open && <HistoryDialog entry={open} sheet={layout.sheet} onClose={close} />}
    </main>
  )
}
