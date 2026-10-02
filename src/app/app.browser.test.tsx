import { deleteDB } from 'idb'
import { StrictMode } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, test } from 'vitest'
import { userEvent } from 'vitest/browser'
import { App } from '../App'
// Custom properties only, no layout: the theme-color test reads --bg.
import '../styles/tokens.css'

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

/** `strict` renders as main.tsx does: StrictMode mounts every component twice in development. */
async function mount(strict = false) {
  root?.unmount()
  root = createRoot(host)
  root.render(strict ? <StrictMode><App dbName={dbName} /></StrictMode> : <App dbName={dbName} />)
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

  test('tapping the pinned digit again turns notes on; a third tap unpins it and turns notes off', async () => {
    await startGame()
    const five = () => button(/^5, /)
    const notesOn = () => button('Notes').getAttribute('aria-pressed') === 'true'
    five().click()
    await waitFor(() => five().getAttribute('aria-pressed') === 'true')
    expect(notesOn()).toBe(false)
    five().click()
    await waitFor(() => notesOn())
    expect(five().getAttribute('aria-pressed')).toBe('true')
    const i = emptyIndex()
    cells()[i].click()
    await waitFor(() => cells()[i].querySelector('.notes')?.textContent === '5')
    five().click()
    await waitFor(() => five().getAttribute('aria-pressed') === 'false' && !notesOn())
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

describe('settings', () => {
  test('the vibration switch shows only where the browser has vibrate', async () => {
    await mount()
    window.location.hash = '/settings'
    await waitFor(() => $('.settings'))
    const shown = $$('button[role="switch"]').some((b) => b.getAttribute('aria-label') === 'Vibration')
    expect(shown).toBe('vibrate' in navigator)
  })

  test('the theme-color meta follows the theme', async () => {
    const meta = document.createElement('meta')
    meta.name = 'theme-color'
    document.head.append(meta)
    try {
      await mount()
      window.location.hash = '/settings'
      await waitFor(() => $('.settings'))
      button('Light').click()
      await waitFor(() => meta.content === '#f6f4ef')
      button('Dark').click()
      await waitFor(() => meta.content === '#121413')
    } finally {
      meta.remove()
    }
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
    // Right-click on a digit: a note with Notes off, the value with Notes on.
    const j = emptyIndex()
    cells()[j].click()
    await userEvent.click(button(/^4, /), { button: 'right' })
    await waitFor(() => cells()[j].querySelector('.notes')?.textContent === '4')
    button('Notes').click()
    await waitFor(() => button('Notes').getAttribute('aria-pressed') === 'true')
    await userEvent.click(button(/^6, /), { button: 'right' })
    await waitFor(() => label(j).includes(', 6'))
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
    key('n')
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

describe('right-click', () => {
  test('number first: the pinned digit goes in the other notes mode', async () => {
    await startGame()
    button(/^5, /).click()
    await waitFor(() => button(/^5, /).getAttribute('aria-pressed') === 'true')
    const i = emptyIndex()
    await userEvent.click(cells()[i], { button: 'right' })
    await waitFor(() => cells()[i].querySelector('.notes')?.textContent === '5')
    expect(label(i)).toMatch(/empty$/)
    await userEvent.click(cells()[i], { button: 'right' })
    await waitFor(() => !cells()[i].querySelector('.notes'))
    button('Notes').click()
    await waitFor(() => button('Notes').getAttribute('aria-pressed') === 'true')
    await userEvent.click(cells()[i], { button: 'right' })
    await waitFor(() => label(i).includes(', 5'))
    button('Undo').click()
    await waitFor(() => label(i).endsWith('empty'))
  })
})

describe('focus', () => {
  // Real clicks and key presses: synthetic events don't press focused buttons.
  test('Enter does not repeat a click; Tab enters and leaves the board in one stop', async () => {
    await startGame()
    const five = button(/^5, /)
    await userEvent.click(five)
    await waitFor(() => five.getAttribute('aria-pressed') === 'true')
    await userEvent.keyboard('{Enter}')
    expect(five.getAttribute('aria-pressed')).toBe('true')
    const notes = button('Notes')
    await userEvent.click(notes)
    await waitFor(() => notes.getAttribute('aria-pressed') === 'true')
    await userEvent.keyboard('{Enter}')
    expect(notes.getAttribute('aria-pressed')).toBe('true')
    await userEvent.click(notes)
    const i = emptyIndex()
    await userEvent.click(cells()[i])
    await waitFor(() => label(i).includes(', 5'))
    await userEvent.keyboard('{Enter}')
    await new Promise((r) => setTimeout(r, 100))
    expect(label(i)).toContain(', 5')
    expect(document.activeElement?.classList.contains('cell')).toBe(false)

    // Keyboard: Tab reaches the board on the selected cell, arrows move focus and selection, Enter
    // on the board does nothing, the next Tab leaves it.
    cells()[i].focus()
    await userEvent.keyboard('{ArrowRight}')
    const next = i % 9 === 8 ? i - 8 : i + 1
    await waitFor(() => document.activeElement === cells()[next] && cells()[next].classList.contains('selected'))
    const before = label(next)
    await userEvent.keyboard('{Enter}')
    await new Promise((r) => setTimeout(r, 100))
    expect(label(next)).toBe(before)
    await userEvent.tab()
    expect(document.activeElement?.classList.contains('cell')).toBe(false)
    await userEvent.tab({ shift: true })
    expect(document.activeElement).toBe(cells()[next])
  })
})

describe('readable hints', () => {
  const primary = () => $<HTMLButtonElement>('.hint-card button.primary')!
  const ready = () => $('.hint-card') && !$('.hint-card button.primary[disabled]')
  const indexOf = (el: HTMLElement) => cells().indexOf(el)

  test('a grouped elimination: engine candidates on screen, every target struck, one Apply for all', async () => {
    await mount()
    button('Hard').click()
    await waitFor(() => $$('button').some((b) => b.textContent === 'Start Hard'))
    button('Start Hard').click()
    await waitFor(() => $('.board'))
    // Hints only, without notes on the board, until one removes candidates from several cells.
    let targets: { cell: number; digits: number[] }[] = []
    for (let n = 0; n < 200 && !targets.length; n++) {
      button('Hint').click()
      await waitFor(ready)
      primary().click()
      await waitFor(() => primary().textContent === 'Show conclusion')
      // Step 2: the pattern shows the engine candidates, with the key ones marked.
      const pattern = $$('.cell.hint').filter((c) => !c.querySelector('.value'))
      expect(pattern.length).toBeGreaterThan(0)
      for (const c of pattern) expect(c.querySelector('.notes .note.hi')).not.toBeNull()
      primary().click()
      await waitFor(() => primary().textContent === 'Apply')
      const struck = $$('.cell.hint-target')
      if (struck.length > 1) {
        targets = struck.map((c) => ({ cell: indexOf(c), digits: [...c.querySelectorAll('.note.struck')].map((d) => Number(d.textContent)) }))
        for (const t of targets) expect(t.digits.length).toBeGreaterThan(0)
      }
      primary().click()
      await waitFor(() => !$('.hint-card'))
    }
    expect(targets.length).toBeGreaterThan(1)
    // Fill notes uses the engine candidates: none of the removed digits comes back.
    button('Fill notes').click()
    await waitFor(() => $$('.cell .notes').length > 0)
    for (const t of targets) {
      const shown = [...cells()[t.cell].querySelectorAll('.note')].map((d) => Number(d.textContent)).filter(Boolean)
      for (const d of t.digits) expect(shown).not.toContain(d)
    }
    button('Undo').click()
    button('Undo').click()
    await waitFor(() => $$('.cell .notes').length === 0)
  }, 90_000)
})

describe('games', () => {
  test('solving with hints only reaches the victory screen and the stats', async () => {
    await startGame()
    for (let n = 0; n < 400 && !$('.victory'); n++) {
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
    $<HTMLButtonElement>('.history-row')!.click()
    await waitFor(() => $$('.dialog .board.readonly .cell').length === 81)
    const solved = $$('.dialog .board.readonly .value').map((v) => Number(v.textContent))
    expect(solved.every((v) => v >= 1 && v <= 9)).toBe(true)
    expect($('.dialog')!.textContent).not.toContain('Saved before')
    button('Play again').click()
    await waitFor(() => !$('.dialog') && $('.board[role="grid"] .cell'))
    const givens = cells().flatMap((c, i) => (c.getAttribute('aria-label')!.includes('given') ? [i] : []))
    expect(givens.length).toBeGreaterThan(0)
    for (const i of givens) expect(label(i)).toContain(`, ${solved[i]}, given`)
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

describe('enter a puzzle', () => {
  // A medium from the engine tests (Generator::with_seed(1)): one solution.
  const PUZZLE = '.981.6.........389....4...52.531.76.4...2...1.13.648.26...8....321.........4.312.'
  const givenCells = () => cells().flatMap((c, i) => (c.getAttribute('aria-label')!.includes('given') ? [i] : []))

  async function openEnter(strict = false) {
    await mount(strict)
    button('Enter a puzzle').click()
    await waitFor(() => $('.enter .board'))
  }

  async function pasteInDialog(text: string) {
    button('Paste').click()
    await waitFor(() => $('.paste-box'))
    await userEvent.fill($<HTMLTextAreaElement>('.paste-box')!, text)
    button('Use').click()
  }

  test('typed givens: the same digit again empties a cell; Undo and Clear; Play explains what is wrong', async () => {
    await openEnter()
    expect(button('Play').disabled).toBe(true)
    const five = button(/^5, /)
    five.click()
    await waitFor(() => five.getAttribute('aria-pressed') === 'true')
    cells()[0].click()
    await waitFor(() => label(0) === 'R1C1, 5, given')
    cells()[1].click()
    await waitFor(() => label(1).startsWith('R1C2, 5, given'))
    cells()[1].click()
    await waitFor(() => label(1) === 'R1C2, empty')
    button('Undo').click()
    await waitFor(() => label(1).startsWith('R1C2, 5, given'))
    button('Play').click()
    await waitFor(() => $('.enter-message')?.textContent === 'This puzzle has no solution.')
    button('Undo').click()
    await waitFor(() => label(1) === 'R1C2, empty' && !$('.enter-message'))
    button('Play').click()
    await waitFor(() => $('.enter-message')?.textContent === 'This puzzle has more than one solution.')
    expect($('.enter .board')).toBeTruthy()
    button('Clear').click()
    await waitFor(() => givenCells().length === 0)
  })

  test('a pasted puzzle with one solution is played as a normal game, marked Custom, and kept in the history', async () => {
    await openEnter()
    await pasteInDialog('not a puzzle')
    await waitFor(() => $('.dialog .enter-message'))
    await pasteInDialog(PUZZLE)
    await waitFor(() => !$('.dialog') && givenCells().length === [...PUZZLE].filter((c) => c !== '.').length)
    button('Play').click()
    await waitFor(() => $('.game:not(.enter) .board'))
    expect($('.level-name')!.textContent).toMatch(/^[A-Z][a-z]+ · Custom$/)
    for (const i of givenCells()) expect(label(i)).toContain(`, ${PUZZLE[i]}, given`)

    for (let n = 0; n < 400 && !$('.victory'); n++) {
      if (!$('.hint-card')) button('Hint').click()
      await waitFor(() => $('.victory') || ($('.hint-card') && !$('.hint-card button.primary[disabled]')))
      if ($('.victory')) break
      $<HTMLButtonElement>('.hint-card button.primary')!.click()
      await new Promise((r) => setTimeout(r, 0))
    }
    await waitFor(() => $('.victory'))
    expect($('.victory')!.textContent).toContain('· Custom')
    button('Menu').click()
    await waitFor(() => $('.home'))
    window.location.hash = '/stats'
    await waitFor(() => $('.stats'))
    expect($('.history-row')!.textContent).toContain('· Custom')
    $<HTMLButtonElement>('.history-row')!.click()
    await waitFor(() => $$('.dialog .board.readonly .cell').length === 81)
    button('Play again').click()
    await waitFor(() => !$('.dialog') && $('.board[role="grid"] .cell'))
    expect($('.level-name')!.textContent).toMatch(/ · Custom$/)
    for (const i of givenCells()) expect(label(i)).toContain(`, ${PUZZLE[i]}, given`)
    expect(givenCells().length).toBe([...PUZZLE].filter((c) => c !== '.').length)
  }, 60_000)

  test('in StrictMode, as in development, Play still starts the game', async () => {
    await openEnter(true)
    await pasteInDialog(PUZZLE)
    await waitFor(() => !$('.dialog') && givenCells().length > 0)
    button('Play').click()
    await waitFor(() => $('.game:not(.enter) .board'))
  })

  test('Ctrl+V on the screen pastes; text that is not a puzzle says what to paste', async () => {
    await openEnter()
    // Firefox gives a synthetic paste event no text: copy from a text box and paste for real.
    const paste = async (text: string) => {
      const box = document.createElement('textarea')
      box.value = text
      document.body.append(box)
      box.select()
      await userEvent.copy()
      box.remove()
      ;(document.activeElement as HTMLElement | null)?.blur()
      await userEvent.paste()
    }
    await paste('12345')
    await waitFor(() => $('.enter-message')?.textContent?.startsWith('Paste 81 cells'))
    await paste(PUZZLE.replace(/\./g, '0'))
    await waitFor(() => givenCells().length > 0 && !$('.enter-message'))
  })
})
