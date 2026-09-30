import { ChartNoAxesColumn, ChevronLeft, Grid3x3, SlidersHorizontal } from 'lucide-react'
import { type ReactNode, useEffect, useRef } from 'react'
import { navigate, type Route } from './router'

/** App icon: "the ninth filled with a 9" (design.md, Web). Always indigo, the brand colour. */
export function Logo({ size = 32, light = false }: { size?: number; light?: boolean }) {
  const dim = light ? '#D5D0C4' : '#353A38'
  const accent = light ? '#4B55C4' : '#8C95F6'
  const tile = light ? '#FFFFFF' : '#1B1E1D'
  const cells = [0, 1, 2].flatMap((r) => [0, 1, 2].map((c) => ({ r, c })))
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" role="img" aria-label="nona">
      <rect x="0.5" y="0.5" width="47" height="47" rx="10.5" fill={tile} stroke={light ? '#DAD6CC' : tile} />
      {cells.map(({ r, c }) => (
        <rect key={`${r}${c}`} x={8 + c * 11} y={8 + r * 11} width="10" height="10" rx="2.5" fill={r === 2 && c === 2 ? accent : dim} />
      ))}
      <g transform="translate(27.95 27.88) scale(0.3)" fill="none" stroke={tile} strokeWidth="3.83" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="23.5" cy="19.5" r="7.5" />
        <path d="M30.5 23 21 35.5" />
      </g>
    </svg>
  )
}

export function PageHeader({ title, back }: { title: string; back: boolean }) {
  return (
    <div className="page-header">
      {back && (
        <button type="button" className="icon-btn" aria-label="Back" onClick={() => navigate('/play')}>
          <ChevronLeft size={22} />
        </button>
      )}
      <h1>{title}</h1>
    </div>
  )
}

export function Sidebar({ route, dark, onPlay }: { route: Route; dark: boolean; onPlay: () => void }) {
  const item = (to: Route, label: string, icon: ReactNode) => (
    <a
      href={`#${to}`}
      aria-label={label}
      title={label}
      aria-current={route === to ? 'page' : undefined}
      className={route === to ? 'nav-item on' : 'nav-item'}
      onClick={to === '/play' ? onPlay : undefined}
    >
      {icon}
    </a>
  )
  return (
    <nav className="sidebar" aria-label="Main">
      <span className="brand">
        <Logo size={36} light={!dark} />
      </span>
      {item('/play', 'Play', <Grid3x3 size={20} />)}
      {item('/stats', 'Stats', <ChartNoAxesColumn size={20} />)}
      <span className="grow" />
      {item('/settings', 'Settings', <SlidersHorizontal size={20} />)}
    </nav>
  )
}

export interface DialogAction {
  label: string
  kind: 'primary' | 'ghost' | 'danger' | 'danger-solid'
  onClick: () => void
}

/** Bottom sheet on the phone, centred card on tablet and desktop. Esc and the scrim cancel. */
export function Dialog({
  title,
  children,
  actions,
  sheet,
  onCancel,
}: {
  title: string
  children: ReactNode
  actions: DialogAction[]
  sheet: boolean
  onCancel: () => void
}) {
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    ref.current?.querySelector<HTMLButtonElement>('.dialog-actions button:last-child')?.focus()
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onCancel()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onCancel])
  return (
    <div className={`scrim${sheet ? ' sheet' : ''}`} onClick={(e) => e.target === e.currentTarget && onCancel()}>
      <div ref={ref} className="dialog" role="dialog" aria-modal="true" aria-labelledby="dialog-title">
        <h2 id="dialog-title">{title}</h2>
        {children}
        <div className="dialog-actions">
          {actions.map((a) => (
            <button key={a.label} type="button" className={`btn ${a.kind}`} onClick={a.onClick}>
              {a.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}

export function Toast({ text, action, onAction }: { text: string; action: string; onAction: () => void }) {
  return (
    <div className="toast" role="status">
      <span>{text}</span>
      <button type="button" onClick={onAction}>
        {action}
      </button>
    </div>
  )
}
