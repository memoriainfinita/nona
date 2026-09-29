import { createRoot } from 'react-dom/client'
import { expect, test } from 'vitest'
import { App } from './App'

test('App mounts in Firefox', async () => {
  const el = document.createElement('div')
  document.body.append(el)
  createRoot(el).render(<App />)
  await expect.poll(() => el.querySelector('h1')?.textContent).toBe('nona')
})
