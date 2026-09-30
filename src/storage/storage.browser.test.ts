import { deleteDB } from 'idb'
import { afterEach, describe, expect, test } from 'vitest'
import { autoNotesMove, colorMove, commit, createGame, type Game } from '../game/game'
import type { HistoryEntry } from '../game/records'
import { DEFAULT_SETTINGS } from '../game/settings'
import { randomTransform } from '../game/transform'
import { seededRng } from '../game/rng'
import { BACKUP_VERSION, createBackup, importBackup, parseBackup, summarize } from './backup'
import {
  clearHistory,
  type Db,
  deleteGame,
  finishGame,
  getGame,
  listGames,
  listHistory,
  loadSettings,
  openNona,
  playedSeeds,
  saveGame,
  saveSettings,
} from './db'

const PUZZLE = '.981.6.........389....4...52.531.76.4...2...1.13.648.26...8....321.........4.312.'
const SOLUTION = '598136247164572389732948615285319764476825931913764852649281573321657498857493126'
const digits = (s: string) => [...s].map((ch) => (ch === '.' ? 0 : Number(ch)))

// A game with undo history, notes and colours, so round trips cover every field.
function game(id: string, updatedAt = 1000, seed = 1): Game {
  let g = createGame({
    id, level: 'medium', seed, daily: null, transform: randomTransform(seededRng(seed)),
    givens: digits(PUZZLE), solution: digits(SOLUTION), now: 0,
  })
  g = commit(g, autoNotesMove(g))
  g = commit(g, colorMove(g, 0, 4))
  return { ...g, elapsedMs: 12_345, updatedAt }
}

function entry(id: string, seed = 2): HistoryEntry {
  return { id, level: 'medium', seed, daily: null, timeMs: 60_000, hintsUsed: 0, completedAt: 5 }
}

const opened: { name: string; db: Db }[] = []
async function freshDb(): Promise<Db> {
  const name = `nona-test-${crypto.randomUUID()}`
  const db = await openNona(name)
  opened.push({ name, db })
  return db
}

afterEach(async () => {
  for (const { name, db } of opened.splice(0)) {
    db.close()
    await deleteDB(name)
  }
})

describe('IndexedDB', () => {
  test('games are saved, listed newest first and deleted', async () => {
    const db = await freshDb()
    await saveGame(db, game('a'), 100)
    await saveGame(db, game('b'), 200)
    expect((await listGames(db)).map((g) => g.id)).toEqual(['b', 'a'])
    expect(await getGame(db, 'a')).toEqual({ ...game('a'), updatedAt: 100 })
    await deleteGame(db, 'a')
    expect((await listGames(db)).map((g) => g.id)).toEqual(['b'])
  })

  test('finishing moves the game to the history', async () => {
    const db = await freshDb()
    await saveGame(db, game('a'))
    await finishGame(db, 'a', entry('h1'))
    expect(await listGames(db)).toEqual([])
    expect(await listHistory(db)).toEqual([entry('h1')])
  })

  test('played seeds cover history and games in progress of the level', async () => {
    const db = await freshDb()
    await saveGame(db, game('a', 1, 11))
    await finishGame(db, 'none', entry('h1', 22))
    await finishGame(db, 'none', { ...entry('h2', 33), level: 'hard' })
    expect(await playedSeeds(db, 'medium')).toEqual(new Set([11, 22]))
  })

  test('settings default until saved', async () => {
    const db = await freshDb()
    expect(await loadSettings(db)).toEqual(DEFAULT_SETTINGS)
    await saveSettings(db, { ...DEFAULT_SETTINGS, theme: 'dark' })
    expect((await loadSettings(db)).theme).toBe('dark')
  })

  test('clear history removes games and history, keeps settings', async () => {
    const db = await freshDb()
    await saveGame(db, game('a'))
    await finishGame(db, 'none', entry('h1'))
    await saveSettings(db, { ...DEFAULT_SETTINGS, accent: 'teal' })
    await clearHistory(db)
    expect(await listGames(db)).toEqual([])
    expect(await listHistory(db)).toEqual([])
    expect((await loadSettings(db)).accent).toBe('teal')
  })
})

describe('export and import', () => {
  async function populated(): Promise<Db> {
    const db = await freshDb()
    await saveGame(db, game('a'), 100)
    await finishGame(db, 'none', entry('h1'))
    await saveSettings(db, { ...DEFAULT_SETTINGS, accent: 'green' })
    return db
  }

  test('export, clear and import gives back the same data', async () => {
    const db = await populated()
    const before = { games: await listGames(db), history: await listHistory(db), settings: await loadSettings(db) }
    const { filename, json } = await createBackup(db, new Date(2026, 9, 5, 12).getTime())
    expect(filename).toBe('nona-backup-2026-10-05.json')
    await clearHistory(db)
    await saveSettings(db, DEFAULT_SETTINGS)
    const parsed = parseBackup(json)
    if (!parsed.ok) throw new Error(parsed.error)
    expect(summarize(parsed.backup)).toMatchObject({ games: 1, history: 1 })
    await importBackup(db, parsed.backup, 'replace')
    expect({ games: await listGames(db), history: await listHistory(db), settings: await loadSettings(db) }).toEqual(before)
  })

  test('merge: same game id, the most recently modified wins; history joined; device settings kept', async () => {
    const db = await freshDb()
    await saveGame(db, game('old-here'), 100)
    await saveGame(db, game('new-here'), 900)
    await finishGame(db, 'none', entry('h-device'))
    await saveSettings(db, { ...DEFAULT_SETTINGS, accent: 'pink' })
    const file = {
      app: 'nona', version: BACKUP_VERSION, exportedAt: 0,
      games: [
        { ...game('old-here'), elapsedMs: 1, updatedAt: 500 },
        { ...game('new-here'), elapsedMs: 2, updatedAt: 400 },
        game('only-file', 300),
      ],
      history: [entry('h-device'), entry('h-file')],
      settings: { ...DEFAULT_SETTINGS, accent: 'blue' },
    }
    const parsed = parseBackup(JSON.stringify(file))
    if (!parsed.ok) throw new Error(parsed.error)
    await importBackup(db, parsed.backup, 'merge')
    const games = new Map((await listGames(db)).map((g) => [g.id, g]))
    expect(games.get('old-here')!.elapsedMs).toBe(1)
    expect(games.get('new-here')!.updatedAt).toBe(900)
    expect(games.has('only-file')).toBe(true)
    expect((await listHistory(db)).map((h) => h.id).sort()).toEqual(['h-device', 'h-file'])
    expect((await loadSettings(db)).accent).toBe('pink')
  })

  test('replace: removes what the device had and uses the file settings', async () => {
    const db = await populated()
    const file = { app: 'nona', version: BACKUP_VERSION, exportedAt: 0, games: [game('x')], history: [], settings: { accent: 'violet' } }
    const parsed = parseBackup(JSON.stringify(file))
    if (!parsed.ok) throw new Error(parsed.error)
    await importBackup(db, parsed.backup, 'replace')
    expect((await listGames(db)).map((g) => g.id)).toEqual(['x'])
    expect(await listHistory(db)).toEqual([])
    expect(await loadSettings(db)).toEqual({ ...DEFAULT_SETTINGS, accent: 'violet' })
  })

  test('invalid files and newer versions are rejected before touching anything', () => {
    const valid = { app: 'nona', version: BACKUP_VERSION, exportedAt: 0, games: [], history: [], settings: {} }
    expect(parseBackup('not json')).toEqual({ ok: false, error: 'invalid' })
    expect(parseBackup(JSON.stringify({ ...valid, app: 'other' }))).toEqual({ ok: false, error: 'invalid' })
    expect(parseBackup(JSON.stringify({ ...valid, games: [{ id: 'x' }] }))).toEqual({ ok: false, error: 'invalid' })
    const badBoard = { ...game('x'), board: { ...game('x').board, values: [1, 2, 3] } }
    expect(parseBackup(JSON.stringify({ ...valid, games: [badBoard] }))).toEqual({ ok: false, error: 'invalid' })
    expect(parseBackup(JSON.stringify({ ...valid, version: BACKUP_VERSION + 1 }))).toEqual({ ok: false, error: 'newer' })
    expect(parseBackup(JSON.stringify(valid)).ok).toBe(true)
  })

  test('history entries saved without a transform still import', () => {
    const file = { app: 'nona', version: BACKUP_VERSION, exportedAt: 0, games: [], history: [entry('old')], settings: {} }
    const parsed = parseBackup(JSON.stringify(file))
    if (!parsed.ok) throw new Error(parsed.error)
    expect(parsed.backup.history[0].transform).toBeUndefined()
    const withTransform = { ...entry('new'), transform: game('x').transform }
    const again = parseBackup(JSON.stringify({ ...file, history: [withTransform] }))
    if (!again.ok) throw new Error(again.error)
    expect(again.backup.history[0]).toEqual(withTransform)
  })
})
