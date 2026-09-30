import { Eraser, Lightbulb, PaintBucket, Pencil, Redo2, Sparkles, Undo2 } from 'lucide-react'
import type { ComponentType, CSSProperties } from 'react'
import type { Settings } from '../../game/settings'

interface Props {
  settings: Settings
  notesMode: boolean
  eraseMode: boolean
  colorMode: boolean
  canUndo: boolean
  canRedo: boolean
  /** Icons only (phone on its side). */
  compact: boolean
  /** "Fill" instead of "Fill notes" on the phone. */
  short: boolean
  onUndo: () => void
  onRedo: () => void
  onNotes: () => void
  onColor: () => void
  onErase: () => void
  onFill: () => void
  onHint: () => void
}

interface Tool {
  label: string
  Icon: ComponentType<{ size?: number; strokeWidth?: number }>
  onClick: () => void
  pressed?: boolean
  disabled?: boolean
}

export function Tools(p: Props) {
  const tools: Tool[] = [
    { label: 'Undo', Icon: Undo2, onClick: p.onUndo, disabled: !p.canUndo },
    { label: 'Redo', Icon: Redo2, onClick: p.onRedo, disabled: !p.canRedo },
    { label: 'Notes', Icon: Pencil, onClick: p.onNotes, pressed: p.notesMode },
    { label: 'Color', Icon: PaintBucket, onClick: p.onColor, pressed: p.colorMode },
    { label: 'Erase', Icon: Eraser, onClick: p.onErase, pressed: p.eraseMode },
  ]
  if (p.settings.autoNotesButton) tools.push({ label: p.short ? 'Fill' : 'Fill notes', Icon: Sparkles, onClick: p.onFill })
  if (p.settings.hintButton) tools.push({ label: 'Hint', Icon: Lightbulb, onClick: p.onHint })
  return (
    <div className={`tools${p.compact ? ' compact' : ''}`} style={{ '--tools': tools.length } as CSSProperties}>
      {tools.map(({ label, Icon, onClick, pressed, disabled }) => (
        <button
          key={label}
          type="button"
          className={`tool${pressed ? ' on' : ''}`}
          aria-label={label === 'Fill' ? 'Fill notes' : label}
          aria-pressed={pressed === undefined ? undefined : pressed}
          title={p.compact ? label : undefined}
          disabled={disabled}
          onClick={onClick}
        >
          <Icon size={18} strokeWidth={1.75} />
          {!p.compact && <span>{label}</span>}
        </button>
      ))}
    </div>
  )
}
