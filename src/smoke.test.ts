import fc from 'fast-check'
import { expect, test } from 'vitest'

test('fast-check runs', () => {
  fc.assert(fc.property(fc.integer(), (n) => n + 0 === n))
  expect(true).toBe(true)
})
