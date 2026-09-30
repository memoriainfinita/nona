import type { Level } from '../bank/bank'

export const LEVEL_NAMES: Record<Level, string> = {
  easy: 'Easy',
  medium: 'Medium',
  intermediate: 'Intermediate',
  hard: 'Hard',
  expert: 'Expert',
  master: 'Master',
}

/** m:ss, or h:mm:ss from an hour. */
export function formatTime(ms: number): string {
  const total = Math.floor(ms / 1000)
  const h = Math.floor(total / 3600)
  const m = Math.floor((total % 3600) / 60)
  const s = String(total % 60).padStart(2, '0')
  return h ? `${h}:${String(m).padStart(2, '0')}:${s}` : `${m}:${s}`
}

/** Clock on the game screen: mm:ss, or h:mm:ss from an hour. */
export function formatClock(ms: number): string {
  const t = formatTime(ms)
  return t.length === 4 ? `0${t}` : t
}

/** "TUE 29 SEP" (short) or "TUESDAY 29 SEPTEMBER" (long) for a UTC date YYYY-MM-DD. */
export function formatDailyDate(date: string, long = false): string {
  const d = new Date(`${date}T12:00:00Z`)
  const opts: Intl.DateTimeFormatOptions = long
    ? { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' }
    : { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' }
  const parts = new Intl.DateTimeFormat('en-US', opts).formatToParts(d)
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? ''
  return `${get('weekday')} ${get('day')} ${get('month')}`.toUpperCase()
}

/** "Today", "Yesterday" or "Mon 28" in the device's local time. */
export function formatHistoryDate(time: number, now = Date.now()): string {
  const day = (t: number) => {
    const d = new Date(t)
    return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime()
  }
  const diff = Math.round((day(now) - day(time)) / 86_400_000)
  if (diff === 0) return 'Today'
  if (diff === 1) return 'Yesterday'
  const d = new Date(time)
  return `${d.toLocaleDateString('en-GB', { weekday: 'short' })} ${d.getDate()}`
}

/** One-letter weekday for the activity chart. */
export function weekdayLetter(date: string): string {
  const [y, m, d] = date.split('-').map(Number)
  return new Date(y, m - 1, d).toLocaleDateString('en-GB', { weekday: 'narrow' })
}

/** Cell name as the hint card writes it: R1C1. */
export function cellName(cell: number): string {
  return `R${Math.floor(cell / 9) + 1}C${(cell % 9) + 1}`
}

export function joinDigits(values: readonly number[]): string {
  if (values.length <= 1) return values.join('')
  return `${values.slice(0, -1).join(', ')} and ${values.at(-1)}`
}
