import { deleteDB } from 'idb'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, test } from 'vitest'
import { App } from '../App'

// Interaction tests on the real app in Firefox: each test gets its own IndexedDB.
let root: Root | undefined
let host: HTMLElement
let dbName: string

beforeEach(() => {
  window.location.hash = '/play'
  dbName = `nona-ui-${crypto.randomUUID()}`
  host = document.createElement('div')
  document.body.append(host)
})

afterEach(async () => {
  root?.unmount()
  root = undefined
  host.remove()
  await deleteDB(dbName)
})

async function mount() {
  root?.unmount()
  root = createRoot(host)
  root.render(<App dbName={dbName} />)
  await expect.poll(() => host.querySelector('main'), { timeout: 15_000 }).toBeTruthy()
}

const $ = <T extends Element = HTMLElement>(sel: string) => host.querySelector<T>(sel)
const $$ = (sel: string) => [...host.querySelectorAll<HTMLElement>(sel)]

function button(name: string | RegExp): HTMLButtonElement {
  const found = $$('button').find((b) => {
    const label = b.getAttribute('aria-label') ?? b.textContent ?? ''
    return typeof name === 'string' ? label === name : name.test(label)
  })
  if (!found) throw new Error(`no button ${name}`)
  return found as HTMLButtonElement
}

async function waitFor(fn: () => unknown) {
  await expect.poll(fn, { timeout: 10_000 }).toBeTruthy()
}

const cells = () => $$('.cell')
const emptyIndex = () => cells().findIndex((c) => c.getAttribute('aria-label')!.endsWith('empty'))
const label = (i: number) => cells()[i].getAttribute('aria-label')!

function key(k: string, opts: KeyboardEventInit = {}) {
  window.dispatchEvent(new KeyboardEvent('keydown', { key: k, bubbles: true, ...opts }))
}

async function startGame() {
  await mount()
  button(/^Start /).click()
  await waitFor(() => $('.board'))
}

describe('number first (default)', () => {
  test('a pinned digit goes into every tapped cell; tapping it again empties the cell', async () => {
    await startGame()
    const five = button(/^5, /)
    five.click()
    await waitFor(() => five.getAttribute('aria-pressed') === 'true')
    const i = emptyIndex()
    cells()[i].click()
    await waitFor(() => label(i).includes(', 5'))
    cells()[i].click()
    await waitFor(() => label(i).endsWith('empty'))
  })

  test('colour mode: the pinned colour paints a cell, and painting it again clears it', async () => {
    await startGame()
    button('Color').click()
    await waitFor(() => $('.palette'))
    button('Yellow').click()
    const i = emptyIndex()
    cells()[i].click()
    await waitFor(() => cells()[i].dataset.color === '3')
    cells()[i].click()
    await waitFor(() => cells()[i].dataset.color !== '3')
  })

  test('any move on the board closes the hint card', async () => {
    await startGame()
    button(/^1, /).click()
    button('Hint').click()
    await waitFor(() => $('.hint-card .hint-title') && !$('.hint-card button.primary[disabled]'))
    cells()[emptyIndex()].click()
    await waitFor(() => !$('.hint-card'))
  })
})

describe('notes tool', () => {
  test('Fill notes turns into Clear notes; clearing can be undone', async () => {
    await startGame()
    const notes = () => $$('.cell .notes').length
    expect(notes()).toBe(0)
    button('Fill notes').click()
    await waitFor(() => notes() > 0)
    const filled = notes()
    button('Clear notes').click()
    await waitFor(() => notes() === 0)
    await waitFor(() => button('Fill notes'))
    button('Undo').click()
    await waitFor(() => notes() === filled)
  })
})

describe('cell first', () => {
  test('select a cell, then the digit', async () => {
    await mount()
    window.location.hash = '/settings'
    await waitFor(() => $('.settings'))
    button('Cell first').click()
    await waitFor(() => button('Cell first').getAttribute('aria-pressed') === 'true')
    window.location.hash = '/play'
    await waitFor(() => $('.home'))
    button(/^Start /).click()
    await waitFor(() => $('.board'))
    const i = emptyIndex()
    cells()[i].click()
    button(/^3, /).click()
    await waitFor(() => label(i).includes(', 3'))
  })
})

describe('keyboard', () => {
  test('arrows, digits, undo/redo, erase, notes and colour keys', async () => {
    await startGame()
    key('ArrowUp') // first arrow selects the centre cell
    const target = emptyIndex()
    let at = 40
    while (at !== target) {
      const [r, c, tr, tc] = [Math.floor(at / 9), at % 9, Math.floor(target / 9), target % 9]
      key(r < tr ? 'ArrowDown' : r > tr ? 'ArrowUp' : c < tc ? 'ArrowRight' : 'ArrowLeft')
      at = r !== tr ? (r < tr ? at + 9 : at - 9) : c < tc ? at + 1 : at - 1
    }
    await waitFor(() => cells()[target].classList.contains('selected'))
    key('7')
    await waitFor(() => label(target).includes(', 7'))
    key('z', { ctrlKey: true })
    await waitFor(() => label(target).endsWith('empty'))
    key('y', { ctrlKey: true })
    await waitFor(() => label(target).includes(', 7'))
    key('Backspace')
    await waitFor(() => label(target).endsWith('empty'))
    key('m')
    await waitFor(() => button('Notes').getAttribute('aria-pressed') === 'true')
    key('4')
    await waitFor(() => cells()[target].querySelector('.notes')?.textContent === '4')
    key('c')
    await waitFor(() => $('.palette'))
    key('3')
    await waitFor(() => cells()[target].dataset.color === '3')
    key('0')
    await waitFor(() => cells()[target].dataset.color !== '3')
    key(' ')
    await waitFor(() => $('.paused-board, .pause-full'))
    key(' ')
    await waitFor(() => $('.board .cell'))
  })
})

describe('games', () => {
  test('solving with hints only reaches the victory screen and the stats', async () => {
    await startGame()
    for (let n = 0; n < 150 && !$('.victory'); n++) {
      if (!$('.hint-card')) button('Hint').click()
      await waitFor(() => $('.victory') || ($('.hint-card') && !$('.hint-card button.primary[disabled]')))
      if ($('.victory')) break
      $<HTMLButtonElement>('.hint-card button.primary')!.click()
      await new Promise((r) => setTimeout(r, 0))
    }
    await waitFor(() => $('.victory'))
    expect($('.victory')!.textContent).toContain('Solved with hints')
    expect($('.victory')!.textContent).not.toContain('New best')
    button('Menu').click()
    await waitFor(() => $('.home'))
    expect($('.home')!.textContent).toContain('No games in progress')
    window.location.hash = '/stats'
    await waitFor(() => $('.stats'))
    expect($('.tile-value')!.textContent).toBe('1')
  }, 60_000)

  test('a game in progress survives a reload; discard can be undone', async () => {
    await startGame()
    button(/^2, /).click()
    const i = emptyIndex()
    cells()[i].click()
    await waitFor(() => label(i).includes(', 2'))
    button('Back to menu').click()
    await waitFor(() => $('.home .ongoing'))
    await mount()
    await waitFor(() => $('.home .ongoing'))
    button(/^Discard /).click()
    await waitFor(() => !$('.home .ongoing') && $('.toast'))
    button('Undo').click()
    await waitFor(() => $('.home .ongoing'))
    $<HTMLButtonElement>('.ongoing-main')!.click()
    await waitFor(() => $('.board'))
    expect(label(i)).toContain(', 2')
  })
})
