import { useCallback, useEffect, useRef, useState } from 'react'
import { EngineError, EngineLoadError } from '../engine/client'
import {
  addTime,
  applyHintMove,
  autoNotesMove,
  clearNotesMove,
  colorMove,
  commit,
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
} from '../game/game'
import { formatGrid } from '../game/grid'
import {
  afterWrongRemoved,
  countHint,
  engineAnswered,
  engineFailed,
  type HintSession,
  type HintStep,
  nextStage,
  openHint,
} from '../game/hint'
import { completeGame, type HistoryEntry, isNewBest } from '../game/records'
import { newId } from './id'
import { useStore } from './store'

export interface Victory {
  entry: HistoryEntry
  best: boolean
}

export interface GameView {
  game: Game
  selected: number | null
  /** Digit fixed on the keypad (number first). */
  pinned: number | null
  /** Colour fixed on the palette (number first, colour mode); 0 = no colour. */
  pinnedColor: number | null
  notesMode: boolean
  eraseMode: boolean
  colorMode: boolean
  paused: boolean
  hint: HintSession | null
  /** The engine has answered once: later hints skip the loading message. */
  engineReady: boolean
  victory: Victory | null
  errors: Set<number>
  /** What the notes tool does now: fill while some empty cell can take notes, then clear. null = nothing to do. */
  notesTool: 'fill' | 'clear' | null
}

export interface GameActions {
  tapCell: (cell: number) => void
  tapDigit: (digit: number) => void
  tapColor: (color: number) => void
  toggleNotes: () => void
  toggleErase: () => void
  toggleColor: () => void
  undo: () => void
  redo: () => void
  /** Fills or clears the notes, as `GameView.notesTool` says. */
  autoNotes: () => void
  openHint: () => void
  hintNext: () => void
  closeHint: () => void
  pause: () => void
  resume: () => void
  moveSelection: (dr: number, dc: number) => void
  /** Selects a cell without playing it (keyboard focus reaching the board). */
  selectCell: (cell: number) => void
  eraseSelected: () => void
}

const TICK_MS = 250
const SAVE_EVERY_MS = 5000

function vibrate(pattern: number | number[]) {
  navigator.vibrate?.(pattern)
}

export function useGame(initial: Game): [GameView, GameActions] {
  const store = useStore()
  const { settings, engine } = store
  const [game, setGame] = useState(initial)
  const [selected, setSelectedState] = useState<number | null>(null)
  const [pinned, setPinnedState] = useState<number | null>(null)
  const [pinnedColor, setPinnedColorState] = useState<number | null>(null)
  // Refs mirror the input state so a tap right after another sees it before the next render.
  const selectedRef = useRef<number | null>(null)
  const pinnedRef = useRef<number | null>(null)
  const pinnedColorRef = useRef<number | null>(null)
  const setSelected = useCallback((next: number | null) => {
    selectedRef.current = next
    setSelectedState(next)
  }, [])
  const setPinned = useCallback((next: number | null) => {
    pinnedRef.current = next
    setPinnedState(next)
  }, [])
  const setPinnedColor = useCallback((next: number | null) => {
    pinnedColorRef.current = next
    setPinnedColorState(next)
  }, [])
  const [notesMode, setNotesMode] = useState(false)
  const [eraseMode, setEraseMode] = useState(false)
  const [colorMode, setColorMode] = useState(false)
  const [paused, setPaused] = useState(false)
  const [hint, setHint] = useState<HintSession | null>(null)
  const [engineReady, setEngineReady] = useState(false)
  const [victory, setVictory] = useState<Victory | null>(null)
  const hintRequest = useRef(0)

  // Latest values for callbacks that outlive a render (timer, engine replies).
  const gameRef = useRef(game)
  gameRef.current = game
  const saveRef = useRef(store.save)
  saveRef.current = store.save

  // Autosave shortly after each change, and when leaving the screen.
  useEffect(() => {
    if (victory) return
    const t = window.setTimeout(() => void saveRef.current(game), 400)
    return () => window.clearTimeout(t)
  }, [game, victory])
  useEffect(() => {
    const flush = () => !isSolved(gameRef.current) && void saveRef.current(gameRef.current)
    window.addEventListener('pagehide', flush)
    return () => {
      window.removeEventListener('pagehide', flush)
      flush()
    }
  }, [])

  // Clock: runs with the game screen visible and not paused. Pause when leaving is a setting.
  const running = !paused && !victory
  useEffect(() => {
    if (!running) return
    let last = performance.now()
    let sinceSave = 0
    const id = window.setInterval(() => {
      const now = performance.now()
      const delta = now - last
      last = now
      sinceSave += delta
      setGame((g) => addTime(g, delta))
      if (sinceSave >= SAVE_EVERY_MS) {
        sinceSave = 0
        void saveRef.current(addTime(gameRef.current, 0))
      }
    }, TICK_MS)
    return () => window.clearInterval(id)
  }, [running])
  useEffect(() => {
    if (!settings.autoPause) return
    const onHide = () => document.visibilityState === 'hidden' && setPaused(true)
    document.addEventListener('visibilitychange', onHide)
    return () => document.removeEventListener('visibilitychange', onHide)
  }, [settings.autoPause])

  const applyStep = useCallback((step: HintStep) => {
    setHint(step.session)
    if (step.count) setGame((g) => countHint(g))
  }, [])

  const askEngine = useCallback(
    (session: HintSession) => {
      const id = ++hintRequest.current
      const g = gameRef.current
      engine
        .hint(formatGrid(g.board.values), engineCandidates(g))
        .then((answer) => {
          if (id !== hintRequest.current) return
          setEngineReady(true)
          if (!answer) setHint(null)
          else applyStep(engineAnswered(session, answer))
        })
        .catch((e: unknown) => {
          if (id !== hintRequest.current) return
          if (e instanceof EngineLoadError || e instanceof EngineError) applyStep(engineFailed(session))
          else throw e
        })
    },
    [engine, applyStep],
  )

  const closeHint = useCallback(() => {
    hintRequest.current++
    setHint(null)
  }, [])

  const finishIfSolved = useCallback(
    (next: Game) => {
      if (!isSolved(next)) return
      const entry = completeGame(next, newId(), Date.now())
      const best = isNewBest([...store.history, entry], entry)
      setVictory({ entry, best })
      setHint(null)
      void store.finish(next, entry)
    },
    [store],
  )

  /** Every board change goes through here: it closes the hint card, like any move does. */
  const play = useCallback(
    (move: Move, cell?: number, keepHint = false) => {
      if (move.length === 0 || victory) return
      const next = commit(gameRef.current, move)
      if (!keepHint) closeHint()
      setGame(next)
      if (settings.vibration && cell !== undefined && move.some((c) => c.field === 'values' && c.to)) {
        vibrate(errorCells(next, settings.errors).has(cell) ? [40, 60, 40] : 10)
      }
      finishIfSolved(next)
    },
    [victory, closeHint, settings.vibration, settings.errors, finishIfSolved],
  )

  const writeDigit = useCallback(
    (cell: number, digit: number) => {
      const g = gameRef.current
      play(notesMode ? toggleNoteMove(g, cell, digit) : placeMove(g, cell, digit, settings.autoCleanNotes), cell)
    },
    [play, notesMode, settings.autoCleanNotes],
  )

  const inputFirst = settings.inputMode === 'digit-first'

  const actions: GameActions = {
    tapCell: (cell) => {
      if (paused || victory) return
      setSelected(cell)
      const g = gameRef.current
      const color = pinnedColorRef.current
      if (colorMode) {
        if (inputFirst && color !== null) play(colorMove(g, cell, g.board.colors[cell] === color ? 0 : color))
        return
      }
      if (eraseMode) return play(eraseMove(g, cell), cell)
      if (inputFirst && pinnedRef.current) writeDigit(cell, pinnedRef.current)
    },
    tapDigit: (digit) => {
      if (paused || victory) return
      if (inputFirst) {
        // Number first: the key fixes the digit; every cell tapped then receives it.
        setPinned(pinnedRef.current === digit ? null : digit)
        setEraseMode(false)
        return
      }
      if (selectedRef.current !== null) writeDigit(selectedRef.current, digit)
    },
    tapColor: (color) => {
      if (paused || victory) return
      if (inputFirst) {
        setPinnedColor(pinnedColorRef.current === color ? null : color)
        return
      }
      const cell = selectedRef.current
      if (cell !== null) play(colorMove(gameRef.current, cell, color))
    },
    toggleNotes: () => {
      setNotesMode((m) => !m)
      setEraseMode(false)
    },
    toggleErase: () => {
      const cell = selectedRef.current
      if (!inputFirst && cell !== null) return play(eraseMove(gameRef.current, cell), cell)
      setEraseMode((m) => !m)
      setPinned(null)
    },
    toggleColor: () => {
      setColorMode((m) => !m)
      setEraseMode(false)
      closeHint()
    },
    undo: () => {
      if (victory) return
      closeHint()
      setGame((g) => undo(g))
    },
    redo: () => {
      if (victory) return
      closeHint()
      setGame((g) => redo(g))
    },
    autoNotes: () => {
      const fill = autoNotesMove(gameRef.current)
      play(fill.length ? fill : clearNotesMove(gameRef.current))
    },
    openHint: () => {
      if (hint || paused || victory) return
      setColorMode(false)
      const step = openHint(gameRef.current, settings.errors)
      applyStep(step)
      if (step.session.card.stage === 'loading') askEngine(step.session)
    },
    hintNext: () => {
      if (!hint) return
      const { card } = hint
      if (card.stage === 'wrong') {
        play(removeWrongMove(gameRef.current), undefined, true)
        const step = afterWrongRemoved(hint)
        applyStep(step)
        askEngine(step.session)
      } else if (card.stage === 'failed') {
        const step = afterWrongRemoved(hint)
        applyStep(step)
        askEngine(step.session)
      } else if (card.stage === 'conclusion') {
        play(applyHintMove(gameRef.current, card.hint, settings.autoCleanNotes), card.hint.cell)
      } else if (card.stage === 'technique' || card.stage === 'cells') {
        setHint(nextStage(hint))
      }
    },
    closeHint,
    pause: () => !victory && setPaused(true),
    resume: () => setPaused(false),
    moveSelection: (dr, dc) => {
      const s = selectedRef.current
      if (s === null) return setSelected(40)
      setSelected(((Math.floor(s / 9) + dr + 9) % 9) * 9 + (((s % 9) + dc + 9) % 9))
    },
    selectCell: (cell) => setSelected(cell),
    eraseSelected: () => {
      const cell = selectedRef.current
      if (cell !== null) play(eraseMove(gameRef.current, cell), cell)
    },
  }

  // Keyboard (design.md, Tablero): the digit keys write into the selected cell in both modes.
  const keyRef = useRef<(e: KeyboardEvent) => void>(() => {})
  keyRef.current = (e: KeyboardEvent) => {
    const target = e.target as HTMLElement | null
    if (target && ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName)) return
    if (victory) return
    const key = e.key
    const mod = e.ctrlKey || e.metaKey
    if (mod && key.toLowerCase() === 'z') return e.preventDefault(), actions.undo()
    if (mod && key.toLowerCase() === 'y') return e.preventDefault(), actions.redo()
    if (mod || e.altKey) return
    if (key === ' ') return e.preventDefault(), paused ? actions.resume() : actions.pause()
    if (paused) return
    if (hint) {
      if (key === 'Enter') return e.preventDefault(), actions.hintNext()
      if (key === 'Escape') return e.preventDefault(), actions.closeHint()
    }
    // A focused cell would take Enter as a tap: on the board, digits go in with 1-9.
    if (key === 'Enter' && target?.closest('.board')) return e.preventDefault()
    const arrows: Record<string, [number, number]> = { ArrowUp: [-1, 0], ArrowDown: [1, 0], ArrowLeft: [0, -1], ArrowRight: [0, 1] }
    if (arrows[key]) return e.preventDefault(), actions.moveSelection(...arrows[key])
    if (/^[0-9]$/.test(key)) {
      const n = Number(key)
      if (colorMode) {
        const color = n >= 1 && n <= 8 ? n : 0
        const cell = selectedRef.current
        if (cell !== null) play(colorMove(gameRef.current, cell, color))
        return
      }
      if (n >= 1 && selectedRef.current !== null) writeDigit(selectedRef.current, n)
      return
    }
    if (key === 'Backspace' || key === 'Delete') return e.preventDefault(), actions.eraseSelected()
    const k = key.toLowerCase()
    if (k === 'm') return actions.toggleNotes()
    if (k === 'e') return actions.toggleErase()
    if (k === 'c') return actions.toggleColor()
    if (k === 'h' && settings.hintButton) return actions.openHint()
  }
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => keyRef.current(e)
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const view: GameView = {
    game,
    selected,
    pinned,
    pinnedColor,
    notesMode,
    eraseMode,
    colorMode,
    paused,
    hint,
    engineReady,
    victory,
    errors: errorCells(game, settings.errors),
    notesTool: autoNotesMove(game).length ? 'fill' : clearNotesMove(game).length ? 'clear' : null,
  }
  return [view, actions]
}
