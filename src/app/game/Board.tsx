import { useEffect, useRef } from 'react'
import { engineCandidates, type Game } from '../../game/game'
import type { HintSession } from '../../game/hint'
import type { Settings } from '../../game/settings'
import { cellName } from '../format'
import { targetCells, unitCellsOf } from './hintText'

interface Props {
  game: Game
  selected: number | null
  /** Digit to highlight: the pinned one, else the selected cell's value. */
  highlight: number | null
  errors: Set<number>
  hint: HintSession | null
  settings: Settings
  onCell: (cell: number) => void
  /** Keyboard focus reached a cell: select it. */
  onFocusCell: (cell: number) => void
  /** Right mouse button on a cell. */
  onAltCell: (cell: number) => void
}

const DIGITS = [1, 2, 3, 4, 5, 6, 7, 8, 9]

function sameZone(a: number, b: number): boolean {
  const ra = Math.floor(a / 9), ca = a % 9, rb = Math.floor(b / 9), cb = b % 9
  return ra === rb || ca === cb || (Math.floor(ra / 3) === Math.floor(rb / 3) && Math.floor(ca / 3) === Math.floor(cb / 3))
}

export function Board({ game, selected, highlight, errors, hint, settings, onCell, onFocusCell, onAltCell }: Props) {
  // One Tab stop for the whole board: the selected cell (or the first). While the board has
  // focus, it follows the selection, so arrows move both.
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const board = ref.current
    if (selected === null || !board?.contains(document.activeElement)) return
    board.querySelectorAll<HTMLElement>('.cell')[selected]?.focus()
  }, [selected])

  const { values, notes, colors } = game.board
  const card = hint?.card
  // Hint roles (design.md, Pistas legibles): pattern, targets (step 3) and unit. Pattern and
  // target cells show the engine candidates, with the key ones marked and the removed ones struck.
  const pattern = new Set<number>()
  const targets = new Set<number>()
  const unit = new Set<number>()
  const marks = new Map<number, number>()
  const struck = new Map<number, number>()
  let shown: Uint16Array | null = null
  let mistakes = new Set<number>()
  if (card?.stage === 'wrong') mistakes = new Set(card.cells)
  if (card?.stage === 'cells' || card?.stage === 'conclusion') {
    const h = card.hint
    for (const c of h.pattern) pattern.add(c)
    for (const c of unitCellsOf(h)) unit.add(c)
    for (const [c, d] of h.marks) marks.set(c, (marks.get(c) ?? 0) | (1 << d))
    if (card.stage === 'conclusion') {
      // The conclusion marks cells in the error tone only for eliminations, as on the canvas.
      for (const e of h.eliminations) {
        targets.add(e.cell)
        struck.set(e.cell, e.values.reduce((m, v) => m | (1 << v), 0))
      }
      for (const c of targetCells(h)) pattern.add(c)
    }
    shown = engineCandidates(game)
  }
  const hintOpen = !!card
  const showSelection = !hintOpen && selected !== null

  return (
    <div ref={ref} className="board" role="grid" aria-label="Sudoku board" onContextMenu={(e) => e.preventDefault()}>
      {values.map((v, i) => {
        const given = game.givens[i] !== 0
        const isError = errors.has(i) || mistakes.has(i)
        const classes = ['cell']
        if (i % 9 === 2 || i % 9 === 5) classes.push('box-right')
        if (Math.floor(i / 9) === 2 || Math.floor(i / 9) === 5) classes.push('box-bottom')
        if (targets.has(i) || mistakes.has(i)) classes.push('hint-target')
        else if (pattern.has(i)) classes.push('hint')
        else if (showSelection && i === selected) classes.push('selected')
        else if (!hintOpen && settings.digitHighlight && highlight && v === highlight) classes.push('same')
        else if (colors[i]) classes.push(`paint-${colors[i]}`)
        else if (unit.has(i)) classes.push('zone')
        else if (showSelection && settings.zoneShading && sameZone(i, selected!)) classes.push('zone')
        if (colors[i]) classes.push('painted')
        if ((showSelection && i === selected) || pattern.has(i) || targets.has(i) || mistakes.has(i)) classes.push('ring')
        if (mistakes.has(i)) classes.push('ring-error')
        const candidates = shown && (pattern.has(i) || targets.has(i)) ? shown[i] : notes[i]
        const strikes = struck.get(i) ?? 0
        const marked = marks.get(i) ?? 0
        const label = `${cellName(i)}, ${v ? `${v}${given ? ', given' : ''}${isError ? ', mistake' : ''}` : 'empty'}`
        return (
          <button
            key={i}
            type="button"
            role="gridcell"
            className={classes.join(' ')}
            aria-label={label}
            data-color={colors[i] || undefined}
            tabIndex={i === (selected ?? 0) ? 0 : -1}
            onFocus={() => i !== selected && onFocusCell(i)}
            onClick={() => onCell(i)}
            onPointerDown={(e) => e.button === 2 && e.pointerType === 'mouse' && onAltCell(i)}
          >
            {v ? (
              <span className={`value${given ? ' given' : ''}${isError && !given ? ' error' : ''}`}>{v}</span>
            ) : candidates ? (
              <span className="notes" aria-hidden="true">
                {DIGITS.map((d) => {
                  const on = (candidates & (1 << d)) !== 0
                  const strike = on && (strikes & (1 << d)) !== 0
                  const hi = on && (hintOpen ? (marked & (1 << d)) !== 0 : settings.digitHighlight && d === highlight)
                  return (
                    <span key={d} className={strike ? 'note struck' : hi ? 'note hi' : 'note'}>
                      {on ? d : ''}
                    </span>
                  )
                })}
              </span>
            ) : null}
          </button>
        )
      })}
    </div>
  )
}
