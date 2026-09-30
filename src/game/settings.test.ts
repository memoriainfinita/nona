import { expect, test } from 'vitest'
import { addTime, createGame } from './game'
import { DEFAULT_SETTINGS } from './settings'
import { IDENTITY } from './transform'

test('15 settings with the defaults of design.md', () => {
  expect(Object.keys(DEFAULT_SETTINGS)).toHaveLength(15)
  expect(DEFAULT_SETTINGS).toMatchObject({
    errors: 'solution',
    autoCleanNotes: true,
    inputMode: 'digit-first',
    completedDigits: 'dim',
    autoPause: true,
    theme: 'system',
    accent: 'indigo',
    textSize: 'M',
  })
})

test('play time accumulates with the game', () => {
  const empty = new Array(81).fill(0)
  let g = createGame({ id: 'g', level: 'easy', seed: 1, daily: null, transform: IDENTITY, givens: empty, solution: empty, now: 0 })
  g = addTime(addTime(g, 1500), 2500)
  expect(g.elapsedMs).toBe(4000)
  expect(addTime(g, -5)).toBe(g)
})
