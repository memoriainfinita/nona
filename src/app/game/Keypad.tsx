import type { Settings } from '../../game/settings'

interface Props {
  remaining: number[]
  pinned: number | null
  notesMode: boolean
  settings: Settings
  /** Long labels ("3 left", "done") on the wide layouts. */
  long: boolean
  onDigit: (digit: number) => void
}

export function Keypad({ remaining, pinned, notesMode, settings, long, onDigit }: Props) {
  return (
    <div className={`keypad${notesMode ? ' notes-mode' : ''}`}>
      {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((d) => {
        const left = remaining[d]
        const done = left === 0
        const classes = ['key']
        if (done) classes.push(settings.completedDigits === 'hide' ? 'hidden' : 'done')
        if (pinned === d) classes.push('pinned')
        const count = !settings.digitCounter ? '' : done ? (long ? 'done' : '') : long ? `${left} left` : String(left)
        return (
          <button
            key={d}
            type="button"
            className={classes.join(' ')}
            aria-label={done ? `${d}, complete` : `${d}, ${left} left`}
            aria-pressed={settings.inputMode === 'digit-first' ? pinned === d : undefined}
            onClick={() => onDigit(d)}
          >
            <span className="key-digit">{d}</span>
            {settings.digitCounter && <span className="key-count">{count}</span>}
          </button>
        )
      })}
    </div>
  )
}

export const PAINT_NAMES = ['Red', 'Orange', 'Yellow', 'Green', 'Teal', 'Blue', 'Violet', 'Pink']

interface PaletteProps {
  current: number | null
  /** Show the colour names on the swatches (wide layouts). */
  named: boolean
  onColor: (color: number) => void
}

export function Palette({ current, named, onColor }: PaletteProps) {
  const swatches = [...PAINT_NAMES.map((name, i) => ({ name, color: i + 1 })), { name: 'No color', color: 0 }]
  return (
    <div className="keypad palette" role="radiogroup" aria-label="Cell color">
      {swatches.map(({ name, color }) => (
        <button
          key={color}
          type="button"
          role="radio"
          aria-checked={current === color}
          aria-label={name}
          className={`swatch${color ? ` paint-${color}` : ' clear'}${current === color ? ' checked' : ''}`}
          onClick={() => onColor(color)}
        >
          {named ? <span>{name}</span> : color === 0 ? <XMark /> : null}
        </button>
      ))}
    </div>
  )
}

function XMark() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
      <path d="M18 6 6 18" />
      <path d="m6 6 12 12" />
    </svg>
  )
}
