import { useEffect, useRef } from 'react'
import type { Game } from '../../game/game'
import type { HintSession } from '../../game/hint'
import type { Settings } from '../../game/settings'
import { cellName } from '../format'

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
}

const DIGITS = [1, 2, 3, 4, 5, 6, 7, 8, 9]

function sameZone(a: number, b: number): boolean {
  const ra = Math.floor(a / 9), ca = a % 9, rb = Math.floor(b / 9), cb = b % 9
  return ra === rb || ca === cb || (Math.floor(ra / 3) === Math.floor(rb / 3) && Math.floor(ca / 3) === Math.floor(cb / 3))
}

export function Board({ game, selected, highlight, errors, hint, settings, onCell, onFocusCell }: Props) {
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
  const hintCells = new Set<number>()
  let target = -1
  let struck = 0
  let mistakes = new Set<number>()
  if (card?.stage === 'wrong') mistakes = new Set(card.cells)
  if (card?.stage === 'cells' || card?.stage === 'conclusion') {
    for (const c of card.hint.cells) hintCells.add(c)
    hintCells.add(card.hint.cell)
    // The conclusion marks the cell in the error tone only for an elimination, as on the canvas.
    if (card.stage === 'conclusion' && card.hint.kind === 'eliminate') {
      target = card.hint.cell
      struck = card.hint.values.reduce((m, v) => m | (1 << v), 0)
    }
  }
  const hintOpen = !!card
  const showSelection = !hintOpen && selected !== null

  return (
    <div ref={ref} className="board" role="grid" aria-label="Sudoku board">
      {values.map((v, i) => {
        const given = game.givens[i] !== 0
        const isError = errors.has(i) || mistakes.has(i)
        const classes = ['cell']
        if (i % 9 === 2 || i % 9 === 5) classes.push('box-right')
        if (Math.floor(i / 9) === 2 || Math.floor(i / 9) === 5) classes.push('box-bottom')
        if (i === target || mistakes.has(i)) classes.push('hint-target')
        else if (hintCells.has(i)) classes.push('hint')
        else if (showSelection && i === selected) classes.push('selected')
        else if (!hintOpen && settings.digitHighlight && highlight && v === highlight) classes.push('same')
        else if (colors[i]) classes.push(`paint-${colors[i]}`)
        else if (showSelection && settings.zoneShading && sameZone(i, selected!)) classes.push('zone')
        if (colors[i]) classes.push('painted')
        if ((showSelection && i === selected) || hintCells.has(i) || mistakes.has(i)) classes.push('ring')
        if (mistakes.has(i)) classes.push('ring-error')
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
          >
            {v ? (
              <span className={`value${given ? ' given' : ''}${isError && !given ? ' error' : ''}`}>{v}</span>
            ) : notes[i] || (i === target && struck) ? (
              <span className="notes" aria-hidden="true">
                {DIGITS.map((d) => {
                  const on = (notes[i] & (1 << d)) !== 0
                  const strike = i === target && (struck & (1 << d)) !== 0 && on
                  const hi = !hintOpen && settings.digitHighlight && on && d === highlight
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
