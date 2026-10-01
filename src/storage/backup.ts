import { z } from 'zod'
import { LEVELS } from '../bank/bank'
import type { Game } from '../game/game'
import { type HistoryEntry, localDate } from '../game/records'
import { DEFAULT_SETTINGS, type Settings } from '../game/settings'
import { type Db, listGames, listHistory, loadSettings } from './db'

/** Current backup format version. Bump it with a migration from the previous one. */
export const BACKUP_VERSION = 1

export interface Backup {
  app: 'nona'
  version: number
  exportedAt: number
  games: Game[]
  history: HistoryEntry[]
  settings: Settings
}

/**
 * Migrations by the version they upgrade from: MIGRATIONS[n] turns version n data into n + 1.
 * Empty while there is only version 1.
 */
const MIGRATIONS: Record<number, (data: Record<string, unknown>) => Record<string, unknown>> = {}

const int = (min: number, max: number) => z.number().int().min(min).max(max)
const cells = (max: number) => z.array(int(0, max)).length(81)
const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/)
const level = z.enum(LEVELS)
const moves = z.array(
  z.array(
    z.object({
      field: z.enum(['values', 'notes', 'colors', 'eliminated']),
      cell: int(0, 80),
      from: int(0, 0x3fe),
      to: int(0, 0x3fe),
    }),
  ),
)

const transformSchema = z.object({
  rows: z.array(int(0, 8)).length(9),
  cols: z.array(int(0, 8)).length(9),
  rotation: int(0, 3),
  digits: z.array(int(0, 9)).length(10),
})

const gameSchema = z.object({
  id: z.string().min(1),
  level,
  seed: int(0, Number.MAX_SAFE_INTEGER).nullable(),
  daily: date.nullable(),
  transform: transformSchema,
  givens: cells(9),
  solution: cells(9),
  board: z.object({ values: cells(9), notes: cells(0x3fe), colors: cells(8), eliminated: cells(0x3fe) }),
  undo: moves,
  redo: moves,
  elapsedMs: z.number().min(0),
  hintsUsed: int(0, Number.MAX_SAFE_INTEGER),
  createdAt: z.number(),
  updatedAt: z.number(),
}) satisfies z.ZodType<Game>

const historySchema = z.object({
  id: z.string().min(1),
  level,
  seed: int(0, Number.MAX_SAFE_INTEGER).nullable(),
  daily: date.nullable(),
  timeMs: z.number().min(0),
  hintsUsed: int(0, Number.MAX_SAFE_INTEGER),
  completedAt: z.number(),
  transform: transformSchema.optional(),
  custom: z.object({ puzzle: z.string().regex(/^[1-9.]{81}$/), solution: z.string().regex(/^[1-9]{81}$/) }).optional(),
}) satisfies z.ZodType<HistoryEntry>

const settingsSchema = z
  .object({
    errors: z.enum(['none', 'conflicts', 'solution']),
    autoCleanNotes: z.boolean(),
    digitCounter: z.boolean(),
    completedDigits: z.enum(['dim', 'hide']),
    inputMode: z.enum(['digit-first', 'cell-first']),
    zoneShading: z.boolean(),
    digitHighlight: z.boolean(),
    timerVisible: z.boolean(),
    hintButton: z.boolean(),
    autoNotesButton: z.boolean(),
    autoPause: z.boolean(),
    theme: z.enum(['light', 'dark', 'system']),
    accent: z.enum(['indigo', 'amber', 'pink', 'violet', 'blue', 'teal', 'green']),
    textSize: z.enum(['S', 'M', 'L']),
    vibration: z.boolean(),
  })
  .partial() satisfies z.ZodType<Partial<Settings>>

const backupSchema = z.object({
  app: z.literal('nona'),
  version: z.literal(BACKUP_VERSION),
  exportedAt: z.number(),
  games: z.array(gameSchema),
  history: z.array(historySchema),
  settings: settingsSchema,
})

const envelope = z.object({ app: z.literal('nona'), version: z.number().int().min(1) })

export type ParseResult = { ok: true; backup: Backup } | { ok: false; error: 'invalid' | 'newer' }

/** Reads a backup file. Newer versions are rejected; older ones are migrated step by step. */
export function parseBackup(text: string): ParseResult {
  let data: unknown
  try {
    data = JSON.parse(text)
  } catch {
    return { ok: false, error: 'invalid' }
  }
  const head = envelope.safeParse(data)
  if (!head.success) return { ok: false, error: 'invalid' }
  if (head.data.version > BACKUP_VERSION) return { ok: false, error: 'newer' }
  let current = data as Record<string, unknown>
  for (let v = head.data.version; v < BACKUP_VERSION; v++) {
    const migrate = MIGRATIONS[v]
    if (!migrate) return { ok: false, error: 'invalid' }
    current = { ...migrate(current), version: v + 1 }
  }
  const parsed = backupSchema.safeParse(current)
  if (!parsed.success) return { ok: false, error: 'invalid' }
  return { ok: true, backup: { ...parsed.data, settings: { ...DEFAULT_SETTINGS, ...parsed.data.settings } } }
}

export async function createBackup(db: Db, now = Date.now()): Promise<{ filename: string; json: string }> {
  const [games, history, settings] = await Promise.all([listGames(db), listHistory(db), loadSettings(db)])
  const backup: Backup = { app: 'nona', version: BACKUP_VERSION, exportedAt: now, games, history, settings }
  return { filename: `nona-backup-${localDate(now)}.json`, json: JSON.stringify(backup) }
}

/** What the import screen shows before Merge, Replace or Cancel. */
export function summarize(backup: Backup): { games: number; history: number; exportedAt: number } {
  return { games: backup.games.length, history: backup.history.length, exportedAt: backup.exportedAt }
}

/**
 * Merge: games joined by id (with the same id, the most recently modified wins), history joined
 * by id, the device keeps its settings. Replace: the device's data is removed first and the
 * file's settings are used. Each runs in one transaction.
 */
export async function importBackup(db: Db, backup: Backup, mode: 'merge' | 'replace'): Promise<void> {
  const tx = db.transaction(['games', 'history', 'settings'], 'readwrite')
  const games = tx.objectStore('games')
  const history = tx.objectStore('history')
  if (mode === 'replace') {
    await Promise.all([games.clear(), history.clear(), tx.objectStore('settings').clear()])
    await Promise.all([
      ...backup.games.map((g) => games.put(g)),
      ...backup.history.map((h) => history.put(h)),
      tx.objectStore('settings').put(backup.settings, 'settings'),
    ])
  } else {
    for (const g of backup.games) {
      const existing = await games.get(g.id)
      if (!existing || g.updatedAt > existing.updatedAt) await games.put(g)
    }
    for (const h of backup.history) {
      if (!(await history.get(h.id))) await history.put(h)
    }
  }
  await tx.done
}
