import { Check, ChevronLeft, Pause } from 'lucide-react'
import { useEffect, useRef } from 'react'
import type { Game } from '../../game/game'
import { remainingDigits } from '../../game/grid'
import { formatClock, formatTime, LEVEL_NAMES } from '../format'
import type { Layout } from '../layout'
import { useStore } from '../store'
import { useGame } from '../useGame'
import { Board } from './Board'
import { HintCard } from './HintCard'
import { Keypad, Palette } from './Keypad'
import { Tools } from './Tools'

interface Props {
  initial: Game
  layout: Layout
  onMenu: () => void
  onPlayAnother: (game: Game) => void
}

const SHORTCUTS = {
  game: 'Arrows move · 1–9 place · M notes · E erase · C color · H hint · Space pause · Ctrl+Z / Ctrl+Y',
  hint: 'Enter next step or Apply · Esc close · Any move on the board closes the hint',
  color: 'C color mode · 1–8 pick a color · 9 or 0 no color',
}

export function GameScreen({ initial, layout, onMenu, onPlayAnother }: Props) {
  const store = useStore()
  const { settings } = store
  const [view, act] = useGame(initial)
  const { game, hint, paused, victory, colorMode } = view
  const level = LEVEL_NAMES[game.level]
  const wide = layout.kind === 'wide'
  const landscape = layout.kind === 'phoneLandscape'
  const remaining = remainingDigits(game.board.values)
  const highlight = view.pinned ?? (view.selected !== null ? game.board.values[view.selected] || null : null)
  const cellFirst = settings.inputMode === 'cell-first'
  const paletteCurrent = cellFirst ? (view.selected !== null ? game.board.colors[view.selected] : null) : view.pinnedColor

  const clock = settings.timerVisible ? formatClock(game.elapsedMs) : null
  const pauseButton = (
    <button type="button" className="icon-btn boxed accent" aria-label="Pause" onClick={act.pause}>
      <Pause size={wide ? 20 : 18} />
    </button>
  )

  if (paused && !victory && layout.kind !== 'phone') {
    return <PauseFull level={level} time={game.elapsedMs} onResume={act.resume} onMenu={onMenu} />
  }

  const board = paused ? (
    <div className="board paused-board">
      <Pause size={36} strokeWidth={1.75} className="accent-text" />
      <span className="paused-title">Paused</span>
      <span className="paused-time">{formatClock(game.elapsedMs)}</span>
    </div>
  ) : (
    <Board game={game} selected={view.selected} highlight={highlight} errors={view.errors} hint={hint} settings={settings} onCell={act.tapCell} />
  )

  const tools = hint ? (
    <HintCard session={hint} engineReady={view.engineReady} onNext={act.hintNext} onClose={act.closeHint} />
  ) : (
    <Tools
      settings={settings}
      notesMode={view.notesMode}
      eraseMode={view.eraseMode}
      colorMode={colorMode}
      canUndo={game.undo.length > 0}
      canRedo={game.redo.length > 0}
      notesTool={view.notesTool}
      compact={landscape}
      short={layout.kind === 'phone'}
      onUndo={act.undo}
      onRedo={act.redo}
      onNotes={act.toggleNotes}
      onColor={act.toggleColor}
      onErase={act.toggleErase}
      onFill={act.autoNotes}
      onHint={act.openHint}
    />
  )

  const keys = colorMode ? (
    <Palette current={paletteCurrent} named={wide} onColor={act.tapColor} />
  ) : (
    <Keypad remaining={remaining} pinned={cellFirst ? null : view.pinned} notesMode={view.notesMode} settings={settings} long={wide} onDigit={act.tapDigit} />
  )

  const content =
    layout.kind === 'phone' && paused ? (
      <>
        {board}
        <button type="button" className="btn primary big" onClick={act.resume}>
          Resume
        </button>
        <button type="button" className="btn ghost" onClick={onMenu}>
          Back to menu
        </button>
      </>
    ) : wide ? (
      <div className="game-wide">
        {board}
        <div className="side-panel">
          <div className="side-head">
            <div className="side-clock">
              <span className="level-label">{level.toUpperCase()}</span>
              {clock && <span className="clock-big">{clock}</span>}
            </div>
            {pauseButton}
          </div>
          {keys}
          {tools}
          {layout.sidebar && <p className="shortcuts">{hint ? SHORTCUTS.hint : colorMode ? SHORTCUTS.color : SHORTCUTS.game}</p>}
        </div>
      </div>
    ) : landscape ? (
      <div className="game-landscape">
        {board}
        <div className="side-panel">
          <div className="game-header">
            <button type="button" className="icon-btn" aria-label="Back to menu" onClick={onMenu}>
              <ChevronLeft size={20} />
            </button>
            <span className="level-name">{level}</span>
            <span className="clock">{clock}</span>
            {pauseButton}
          </div>
          {keys}
          {tools}
        </div>
      </div>
    ) : (
      <>
        {board}
        {keys}
        {colorMode && <p className="color-help">Tap cells to paint them. Tap Color again to go back to numbers.</p>}
        {tools}
      </>
    )

  return (
    <main className={`game game-${layout.kind}`}>
      {!wide && !landscape && (
        <div className="game-header">
          <button type="button" className="icon-btn" aria-label="Back to menu" onClick={onMenu}>
            <ChevronLeft size={22} />
          </button>
          <div className="game-title">
            <span className="level-name">{level}</span>
            {clock && <span className="clock">{clock}</span>}
          </div>
          {!paused && pauseButton}
        </div>
      )}
      {wide && !layout.sidebar && (
        <div className="game-header">
          <button type="button" className="icon-btn" aria-label="Back to menu" onClick={onMenu}>
            <ChevronLeft size={22} />
          </button>
        </div>
      )}
      {content}
      {victory && (
        <VictoryDialog
          level={level}
          time={victory.entry.timeMs}
          best={victory.best}
          withHints={victory.entry.hintsUsed > 0}
          daily={game.daily !== null}
          onAnother={async () => onPlayAnother(await store.startGame(game.level))}
          onMenu={onMenu}
        />
      )}
    </main>
  )
}

function PauseFull({ level, time, onResume, onMenu }: { level: string; time: number; onResume: () => void; onMenu: () => void }) {
  return (
    <main className="pause-full">
      <Pause size={44} strokeWidth={1.75} className="accent-text" />
      <span className="paused-title big">Paused</span>
      <span className="level-label">{level.toUpperCase()}</span>
      <span className="clock-huge">{formatClock(time)}</span>
      <div className="pause-actions">
        <button type="button" className="btn primary big" onClick={onResume}>
          Resume
        </button>
        <button type="button" className="btn ghost" onClick={onMenu}>
          Back to menu
        </button>
      </div>
      <span className="muted small">The board stays hidden while paused.</span>
    </main>
  )
}

interface VictoryProps {
  level: string
  time: number
  best: boolean
  withHints: boolean
  daily: boolean
  onAnother: () => void
  onMenu: () => void
}

function VictoryDialog({ level, time, best, withHints, daily, onAnother, onMenu }: VictoryProps) {
  const first = useRef<HTMLButtonElement>(null)
  useEffect(() => first.current?.focus(), [])
  return (
    <div className="scrim strong">
      <div className="victory" role="dialog" aria-modal="true" aria-labelledby="victory-title">
        <Check size={44} strokeWidth={1.75} className="accent-text" />
        <h2 id="victory-title">Solved</h2>
        <span className="muted">{daily ? `Daily · ${level}` : level}</span>
        <span className="victory-time">{formatTime(time)}</span>
        {best && <span className="pill accent">New best for {level}</span>}
        {withHints && <span className="pill">Solved with hints</span>}
        <div className="victory-actions">
          <button ref={first} type="button" className="btn primary big" onClick={onAnother}>
            Play another {level}
          </button>
          <button type="button" className="btn ghost" onClick={onMenu}>
            Menu
          </button>
        </div>
      </div>
    </div>
  )
}
