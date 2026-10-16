import { ChevronLeft, ChevronRight } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import { type DailyPuzzle, loadDaily } from '../../bank/bank'
import { addMonths, dailyOf, type DayInfo, dayInfo, type Month, monthDays, monthOf, sameMonth } from '../../game/calendar'
import { emptyCells } from '../../game/game'
import { DAILY_EPOCH } from '../../game/pick'
import { type HistoryEntry, utcDate } from '../../game/records'
import { formatDailyDate, formatMonth, formatTime, LEVEL_NAMES } from '../format'
import type { Layout } from '../layout'
import { navigate } from '../router'
import { useStore } from '../store'
import { PageHeader } from '../ui'
import { HistoryDialog } from './Stats'

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
const WORDS: Record<DayInfo['state'], string> = {
  ontime: 'solved on the day',
  late: 'solved later',
  progress: 'in progress',
  today: 'today, not played',
  open: 'not played',
  off: 'not available',
}

/** "12 Oct" in the device's local time, for the day a late daily was solved. */
const solvedOn = (time: number) => new Date(time).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })

/**
 * Calendar of daily sudokus (design.md, Calendario del día): every day since the first daily,
 * with what was done on it. A day opens its card first, so the level shows before playing.
 */
export function Daily({ layout }: { layout: Layout }) {
  const store = useStore()
  const today = utcDate(Date.now())
  const [list, setList] = useState<DailyPuzzle[] | null>(null)
  const [view, setView] = useState<Month>(() => monthOf(today))
  const [selected, setSelected] = useState(today)
  const [open, setOpen] = useState<HistoryEntry | null>(null)
  const close = useCallback(() => setOpen(null), [])
  const wide = layout.kind === 'wide'

  useEffect(() => {
    let live = true
    void loadDaily().then((l) => live && setList(l))
    return () => {
      live = false
    }
  }, [])

  const first = monthOf(DAILY_EPOCH)
  const last = monthOf(today)
  const info = (date: string) => (list ? dayInfo(date, today, list, store.history, store.games) : { date, state: 'off' as const })
  const { lead, dates } = monthDays(view)
  const day = info(selected)

  const play = async () => {
    await store.startDaily(selected)
    navigate('/play')
  }
  const resume = () => {
    if (!day.game) return
    store.setActiveId(day.game.id)
    navigate('/play')
  }

  const level = list ? LEVEL_NAMES[dailyOf(list, selected).level] : ''
  const head = `${formatDailyDate(selected, wide)}${day.state === 'today' ? ' · TODAY' : ''}`
  let card: { title: string; sub?: string; action: string; primary: boolean; onAction: () => void }
  switch (day.state) {
    case 'ontime':
    case 'late':
      card = {
        title: `Solved in ${formatTime(day.entry!.timeMs)}`,
        sub: `${level} · ${day.state === 'ontime' ? 'on the day' : `solved on ${solvedOn(day.entry!.completedAt)}`}`,
        action: 'View',
        primary: false,
        onAction: () => setOpen(day.entry!),
      }
      break
    case 'progress':
      card = {
        title: `${level} · in progress`,
        sub: `${formatTime(day.game!.elapsedMs)} · ${emptyCells(day.game!)} cells left`,
        action: 'Continue',
        primary: true,
        onAction: resume,
      }
      break
    case 'today':
      card = { title: `Today’s puzzle is ${level}`, action: 'Play', primary: true, onAction: () => void play() }
      break
    default:
      card = { title: level, sub: 'Past days count as a normal game.', action: 'Play', primary: true, onAction: () => void play() }
  }

  // Until the list loads every day would read as off: the grid waits for it.
  const calendar = list && (
    <div className="cal">
      <div className="cal-card">
        <div className="cal-nav">
          <button type="button" className="icon-btn" aria-label="Previous month" disabled={sameMonth(view, first)} onClick={() => setView((v) => addMonths(v, -1))}>
            <ChevronLeft size={20} />
          </button>
          <h2 className="cal-month">{formatMonth(view.year, view.month)}</h2>
          <button type="button" className="icon-btn" aria-label="Next month" disabled={sameMonth(view, last)} onClick={() => setView((v) => addMonths(v, 1))}>
            <ChevronRight size={20} />
          </button>
        </div>
        <div className="cal-week" aria-hidden="true">
          {WEEKDAYS.map((w) => (
            <span key={w}>{wide ? w : w[0]}</span>
          ))}
        </div>
        <div className="cal-grid">
          {Array.from({ length: lead }, (_, i) => (
            <span key={`b${i}`} />
          ))}
          {dates.map((date) => {
            const { state } = info(date)
            const n = Number(date.slice(8))
            const on = date === selected
            return (
              <button
                key={date}
                type="button"
                className={`day ${state}${on ? ' sel' : ''}`}
                aria-label={`${n} ${formatMonth(view.year, view.month).split(' ')[0]}, ${WORDS[state]}`}
                aria-pressed={on}
                disabled={state === 'off'}
                onClick={() => setSelected(date)}
              >
                {n}
                {state === 'progress' && <span className="day-dot" />}
              </button>
            )
          })}
        </div>
      </div>
      <div className="cal-legend" aria-hidden="true">
        <span><i className="mark ontime" />{wide ? 'Solved on the day' : 'On the day'}</span>
        <span><i className="mark late" />{wide ? 'Solved later' : 'Later'}</span>
        <span><i className="mark progress" />In progress</span>
        <span><i className="mark today" />Today</span>
      </div>
    </div>
  )

  const dayCard = list && (
    <section className={`day-card${card.primary ? ' primary' : ''}`} aria-live="polite">
      <div className="daily-text">
        <span className={`section-title${card.primary ? ' accent-text' : ''}`}>{head}</span>
        <span className="daily-title">{card.title}</span>
        {card.sub && <span className="muted small">{card.sub}</span>}
      </div>
      <button type="button" className={card.primary ? 'btn primary' : 'btn outline'} onClick={card.onAction}>
        {card.action}
      </button>
    </section>
  )

  return (
    <main className={`page daily-page page-${layout.kind}`}>
      <PageHeader title="Daily puzzles" back />
      {wide ? (
        <div className="daily-columns">
          {calendar}
          {dayCard}
        </div>
      ) : (
        <>
          {calendar}
          {dayCard}
        </>
      )}
      {open && <HistoryDialog entry={open} sheet={layout.sheet} onClose={close} />}
    </main>
  )
}
