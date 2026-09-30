import { ChartNoAxesColumn, Check, ChevronRight, SlidersHorizontal, Trash2 } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { type DailyPuzzle, type Level, LEVELS, loadDaily } from '../../bank/bank'
import { emptyCells, type Game } from '../../game/game'
import { dailyPuzzle } from '../../game/pick'
import { dailyEntry, utcDate } from '../../game/records'
import { formatDailyDate, formatTime, LEVEL_NAMES } from '../format'
import type { Layout } from '../layout'
import { navigate } from '../router'
import { useStore } from '../store'
import { Logo, Toast } from '../ui'

const TOAST_MS = 5000

export function Home({ layout, dark }: { layout: Layout; dark: boolean }) {
  const store = useStore()
  const [level, setLevel] = useState<Level>(() => store.games[0]?.level ?? 'medium')
  const [discarded, setDiscarded] = useState<Game | null>(null)
  const [daily, setDaily] = useState<DailyPuzzle | null>(null)
  const today = utcDate(Date.now())
  const toastTimer = useRef(0)

  useEffect(() => {
    let live = true
    loadDaily().then((list) => live && setDaily(dailyPuzzle(list, today).entry))
    return () => {
      live = false
    }
  }, [today])
  useEffect(() => () => window.clearTimeout(toastTimer.current), [])

  const discard = async (id: string) => {
    const game = await store.discard(id)
    if (!game) return
    setDiscarded(game)
    window.clearTimeout(toastTimer.current)
    toastTimer.current = window.setTimeout(() => setDiscarded(null), TOAST_MS)
  }
  const undoDiscard = () => {
    if (discarded) void store.restore(discarded)
    setDiscarded(null)
  }

  const solvedToday = dailyEntry(store.history, today)
  const dailyLevel = daily ? LEVEL_NAMES[daily.level] : ''
  const wide = layout.kind === 'wide'

  const continueList = (
    <section className="stack">
      <h2 className="section-title">CONTINUE</h2>
      {store.games.map((g) => (
        <div key={g.id} className="ongoing">
          <button type="button" className="ongoing-main" onClick={() => store.setActiveId(g.id)}>
            <span className="ongoing-text">
              <span className="ongoing-level">{g.daily ? `Daily · ${LEVEL_NAMES[g.level]}` : LEVEL_NAMES[g.level]}</span>
              <span className="muted small">
                {formatTime(g.elapsedMs)} · {emptyCells(g)} cells left
              </span>
            </span>
            <ChevronRight size={20} className="accent-text" />
          </button>
          <button type="button" className="discard" aria-label={`Discard ${LEVEL_NAMES[g.level]} game`} onClick={() => discard(g.id)}>
            <Trash2 size={18} strokeWidth={1.75} />
          </button>
        </div>
      ))}
      {store.games.length === 0 && <p className="empty-note">No games in progress. Pick a level to start, or try today's puzzle.</p>}
    </section>
  )

  const dailyCard = solvedToday ? (
    <section className="daily done">
      <div className="daily-text">
        <span className="section-title">DAILY · {formatDailyDate(today, wide)}</span>
        <span className="daily-title">Solved in {formatTime(solvedToday.timeMs)}</span>
        <span className="muted small">{LEVEL_NAMES[solvedToday.level]} · a new puzzle tomorrow</span>
      </div>
      <Check size={28} className="accent-text" />
    </section>
  ) : (
    <section className="daily">
      <div className="daily-text">
        <span className="section-title accent-text">DAILY · {formatDailyDate(today, wide)}</span>
        <span className="daily-title">{daily ? `Today's puzzle is ${dailyLevel}` : 'Today’s puzzle'}</span>
      </div>
      <button type="button" className="btn primary" onClick={() => void store.startDaily()}>
        Play
      </button>
    </section>
  )

  const newGame = (
    <section className="stack">
      {wide ? <h1 className="page-title">New game</h1> : <h2 className="section-title">NEW GAME</h2>}
      <div className="levels">
        {LEVELS.map((l) => (
          <button key={l} type="button" aria-pressed={l === level} className={l === level ? 'level on' : 'level'} onClick={() => setLevel(l)}>
            {LEVEL_NAMES[l]}
          </button>
        ))}
      </div>
      <button type="button" className="btn primary big" onClick={() => void store.startGame(level)}>
        Start {LEVEL_NAMES[level]}
      </button>
    </section>
  )

  return (
    <main className={`home home-${layout.kind}`}>
      {!layout.sidebar && (
        <div className="home-header">
          <Logo size={28} light={!dark} />
          <span className="brand big">nona</span>
          <button type="button" className="icon-btn" aria-label="Stats" onClick={() => navigate('/stats')}>
            <ChartNoAxesColumn size={20} />
          </button>
          <button type="button" className="icon-btn" aria-label="Settings" onClick={() => navigate('/settings')}>
            <SlidersHorizontal size={20} />
          </button>
        </div>
      )}
      {wide ? (
        <div className="home-columns">
          <div className="stack grow">
            {newGame}
            {dailyCard}
          </div>
          <div className="home-side">{continueList}</div>
        </div>
      ) : (
        <>
          {continueList}
          {dailyCard}
          {newGame}
        </>
      )}
      {discarded && <Toast text={`${LEVEL_NAMES[discarded.level]} game discarded`} action="Undo" onAction={undoDiscard} />}
    </main>
  )
}
