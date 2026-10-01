import { ChevronLeft, ClipboardPaste, Trash2, Undo2 } from 'lucide-react'
import { type CSSProperties, useEffect, useMemo, useRef, useState } from 'react'
import { EngineLoadError } from '../../engine/client'
import { customLevel, parsePasted } from '../../game/custom'
import { createGame } from '../../game/game'
import { conflictCells, formatGrid, parseGrid, remainingDigits } from '../../game/grid'
import { IDENTITY } from '../../game/transform'
import { Board } from '../game/Board'
import { Keypad } from '../game/Keypad'
import type { Layout } from '../layout'
import { navigate } from '../router'
import { useStore } from '../store'
import { Dialog } from '../ui'

const EMPTY: readonly number[] = new Array(81).fill(0)
const PASTE_HELP = 'Paste 81 cells: digits 1–9, with . or 0 for empty cells.'

type Status = { kind: 'idle' } | { kind: 'checking' } | { kind: 'error'; text: string }

/**
 * A puzzle entered by the player (design.md, Sudoku propio): the givens, typed or pasted, then
 * Play checks it with the engine. One solution starts a normal game; otherwise it says why.
 */
export function Enter({ layout }: { layout: Layout }) {
  const store = useStore()
  const { settings } = store
  const [values, setValues] = useState<readonly number[]>(EMPTY)
  const [past, setPast] = useState<(readonly number[])[]>([])
  const [selected, setSelected] = useState<number | null>(null)
  const [pinned, setPinned] = useState<number | null>(null)
  const [status, setStatus] = useState<Status>({ kind: 'idle' })
  const [pasting, setPasting] = useState(false)
  // False once the screen is gone, so a late check result is dropped. Set on every mount:
  // StrictMode mounts twice in development.
  const live = useRef(false)
  useEffect(() => {
    live.current = true
    return () => {
      live.current = false
    }
  }, [])

  const cellFirst = settings.inputMode === 'cell-first'
  const wide = layout.kind === 'wide'
  const landscape = layout.kind === 'phoneLandscape'
  const checking = status.kind === 'checking'
  const errors = conflictCells(values)
  const remaining = remainingDigits(values).map((n) => Math.max(0, n))
  // The board shows the entered numbers as givens.
  const game = useMemo(
    () => createGame({ id: 'entry', level: 'easy', seed: null, daily: null, transform: IDENTITY, givens: [...values], solution: [...EMPTY], now: 0 }),
    [values],
  )
  const highlight = pinned ?? (selected !== null ? values[selected] || null : null)

  const change = (next: readonly number[]) => {
    if (checking || next.every((v, i) => v === values[i])) return
    setPast((p) => [...p, values])
    setValues(next)
    setStatus({ kind: 'idle' })
  }
  /** Writes a digit into a cell; the same digit again empties it. */
  const write = (cell: number, digit: number) => {
    const next = [...values]
    next[cell] = values[cell] === digit ? 0 : digit
    change(next)
  }
  const erase = (cell: number) => {
    const next = [...values]
    next[cell] = 0
    change(next)
  }
  const undo = () => {
    if (checking || !past.length) return
    setValues(past[past.length - 1])
    setPast((p) => p.slice(0, -1))
    setStatus({ kind: 'idle' })
  }
  /** Pasted text; from the dialog, an invalid one is reported there. */
  const paste = (text: string, inDialog = false): boolean => {
    const parsed = parsePasted(text)
    if (!parsed) {
      if (!inDialog) setStatus({ kind: 'error', text: PASTE_HELP })
      return false
    }
    change(parsed)
    return true
  }

  const tapCell = (cell: number) => {
    setSelected(cell)
    if (!cellFirst && pinned !== null) write(cell, pinned)
  }
  const tapDigit = (digit: number) => {
    if (cellFirst) {
      if (selected !== null) write(selected, digit)
    } else setPinned((p) => (p === digit ? null : digit))
  }

  const play = async () => {
    if (checking) return
    setStatus({ kind: 'checking' })
    try {
      const result = await store.engine.check(formatGrid(values))
      if (!live.current) return
      if (result.solutions === 0) return setStatus({ kind: 'error', text: 'This puzzle has no solution.' })
      if (result.solutions === 2) return setStatus({ kind: 'error', text: 'This puzzle has more than one solution.' })
      await store.startCustom([...values], parseGrid(result.solution!), customLevel(result.level!))
      navigate('/play')
    } catch (e) {
      if (!live.current) return
      setStatus({ kind: 'error', text: e instanceof EngineLoadError ? 'Couldn’t load the puzzle checker. Try again.' : 'Couldn’t check this puzzle.' })
    }
  }

  // Keyboard as in the game: arrows move, 1-9 write, Backspace erases, Ctrl+Z undoes, Ctrl+V pastes.
  const keyRef = useRef<(e: KeyboardEvent) => void>(() => {})
  keyRef.current = (e: KeyboardEvent) => {
    const target = e.target as HTMLElement | null
    if (pasting || (target && ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName))) return
    const key = e.key
    const mod = e.ctrlKey || e.metaKey
    if (mod && key.toLowerCase() === 'z') return e.preventDefault(), undo()
    if (mod || e.altKey) return
    if (key === 'Enter' && target?.closest('.board')) return e.preventDefault()
    const arrows: Record<string, [number, number]> = { ArrowUp: [-1, 0], ArrowDown: [1, 0], ArrowLeft: [0, -1], ArrowRight: [0, 1] }
    if (arrows[key]) {
      e.preventDefault()
      const [dr, dc] = arrows[key]
      return setSelected((s) => (s === null ? 40 : ((Math.floor(s / 9) + dr + 9) % 9) * 9 + (((s % 9) + dc + 9) % 9)))
    }
    if (selected === null) return
    if (/^[1-9]$/.test(key)) return write(selected, Number(key))
    if (key === '0' || key === 'Backspace' || key === 'Delete') return e.preventDefault(), erase(selected)
  }
  const pasteRef = useRef<(e: ClipboardEvent) => void>(() => {})
  pasteRef.current = (e: ClipboardEvent) => {
    const target = e.target as HTMLElement | null
    if (pasting || (target && ['INPUT', 'TEXTAREA'].includes(target.tagName))) return
    const text = e.clipboardData?.getData('text')
    if (text === undefined) return
    e.preventDefault()
    paste(text)
  }
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => keyRef.current(e)
    const onPaste = (e: ClipboardEvent) => pasteRef.current(e)
    window.addEventListener('keydown', onKey)
    window.addEventListener('paste', onPaste)
    return () => {
      window.removeEventListener('keydown', onKey)
      window.removeEventListener('paste', onPaste)
    }
  }, [])

  const board = (
    <Board
      game={game}
      selected={selected}
      highlight={highlight}
      errors={errors}
      hint={null}
      settings={settings}
      onCell={tapCell}
      onFocusCell={setSelected}
      onAltCell={() => {}}
      givenErrors
    />
  )
  const keys = (
    <Keypad
      remaining={remaining}
      pinned={cellFirst ? null : pinned}
      notesMode={false}
      settings={{ ...settings, digitCounter: false }}
      long={wide}
      onDigit={tapDigit}
      onAltDigit={() => {}}
    />
  )
  const tools = (
    <div className={`tools enter-tools${landscape ? ' compact' : ''}`} style={{ '--tools': 3 } as CSSProperties}>
      {[
        { label: 'Undo', Icon: Undo2, onClick: undo, disabled: !past.length || checking },
        { label: 'Clear', Icon: Trash2, onClick: () => change(EMPTY), disabled: values.every((v) => !v) || checking },
        { label: 'Paste', Icon: ClipboardPaste, onClick: () => setPasting(true), disabled: checking },
      ].map(({ label, Icon, onClick, disabled }) => (
        <button key={label} type="button" className="tool" aria-label={label} title={landscape ? label : undefined} disabled={disabled} onClick={onClick}>
          <Icon size={18} strokeWidth={1.75} />
          {!landscape && <span>{label}</span>}
        </button>
      ))}
    </div>
  )
  const message = status.kind === 'error' && (
    <p className="enter-message" role="status">
      {status.text}
    </p>
  )
  const playButton = (
    <button type="button" className={`btn primary${landscape ? '' : ' big'}`} disabled={checking || values.every((v) => !v)} onClick={() => void play()}>
      {checking ? 'Checking…' : 'Play'}
    </button>
  )
  const back = (
    <button type="button" className="icon-btn" aria-label="Back to menu" onClick={() => navigate('/play')}>
      <ChevronLeft size={22} />
    </button>
  )
  const title = <span className="level-name">Enter a puzzle</span>

  const content = wide ? (
    <div className="game-wide">
      {board}
      <div className="side-panel">
        <div className="side-head">
          <span className="level-label">ENTER A PUZZLE</span>
        </div>
        {keys}
        {tools}
        {message}
        {playButton}
        {layout.sidebar && <p className="shortcuts">Arrows move · 1–9 place · Backspace or 0 erase · Ctrl+V paste · Ctrl+Z undo</p>}
      </div>
    </div>
  ) : landscape ? (
    <div className="game-landscape">
      {board}
      <div className="side-panel">
        <div className="game-header">
          {back}
          {title}
        </div>
        {keys}
        {tools}
        {message}
        {playButton}
      </div>
    </div>
  ) : (
    <>
      {board}
      {keys}
      {tools}
      {message}
      {playButton}
    </>
  )

  return (
    <main className={`game game-${layout.kind} enter`} onMouseDown={(e) => (e.target as Element).closest('button') && e.preventDefault()}>
      {!wide && !landscape && (
        <div className="game-header">
          {back}
          <div className="game-title">{title}</div>
        </div>
      )}
      {wide && !layout.sidebar && <div className="game-header">{back}</div>}
      {content}
      {pasting && <PasteDialog sheet={layout.sheet} onPaste={(text) => paste(text, true) && setPasting(false)} onCancel={() => setPasting(false)} />}
    </main>
  )
}

function PasteDialog({ sheet, onPaste, onCancel }: { sheet: boolean; onPaste: (text: string) => boolean | void; onCancel: () => void }) {
  const [text, setText] = useState('')
  const [invalid, setInvalid] = useState(false)
  const area = useRef<HTMLTextAreaElement>(null)
  // The dialog focuses its last button when it opens; the text box takes the focus after that.
  useEffect(() => {
    const frame = requestAnimationFrame(() => area.current?.focus())
    return () => cancelAnimationFrame(frame)
  }, [])
  return (
    <Dialog
      title="Paste a puzzle"
      sheet={sheet}
      onCancel={onCancel}
      actions={[
        { label: 'Cancel', kind: 'ghost', onClick: onCancel },
        { label: 'Use', kind: 'primary', onClick: () => setInvalid(onPaste(text) === false) },
      ]}
    >
      <p className={invalid ? 'enter-message' : undefined}>{invalid ? `That isn’t a puzzle. ${PASTE_HELP}` : PASTE_HELP}</p>
      <textarea
        ref={area}
        className="paste-box"
        aria-label="Puzzle text"
        rows={4}
        spellCheck={false}
        value={text}
        onChange={(e) => {
          setText(e.target.value)
          setInvalid(false)
        }}
      />
    </Dialog>
  )
}
