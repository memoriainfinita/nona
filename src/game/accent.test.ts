import fc from 'fast-check'
import { expect, test } from 'vitest'
import { accentVariants, contrast, DARK_GROUND, DARK_MIN, isHex, LIGHT_GROUND, LIGHT_MIN } from './accent'

const hex = fc.integer({ min: 0, max: 0xffffff }).map((n) => `#${n.toString(16).padStart(6, '0')}`)

test('contrast: WCAG ratios', () => {
  expect(contrast('#000000', '#ffffff')).toBeCloseTo(21)
  expect(contrast('#ffffff', '#ffffff')).toBe(1)
  expect(contrast('#4b55c4', '#ffffff')).toBeGreaterThan(6)
})

test('every colour gets both versions with the contrast of its theme', () => {
  fc.assert(
    fc.property(hex, (c) => {
      const { dark, light } = accentVariants(c)
      expect(isHex(dark) && isHex(light)).toBe(true)
      expect(contrast(dark, DARK_GROUND)).toBeGreaterThanOrEqual(DARK_MIN)
      expect(contrast(light, LIGHT_GROUND)).toBeGreaterThanOrEqual(LIGHT_MIN)
    }),
  )
})

test('a colour that already has the contrast stays as picked', () => {
  // The preset accents: dark indigo on the dark ground, light indigo on white.
  expect(accentVariants('#8C95F6').dark).toBe('#8c95f6')
  expect(accentVariants('#4b55c4').light).toBe('#4b55c4')
})

test('only the lightness moves: a light yellow darkens for the light theme and keeps its hue', () => {
  const { dark, light } = accentVariants('#e8d44d')
  expect(dark).toBe('#e8d44d')
  expect(light).not.toBe('#e8d44d')
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(light.slice(i, i + 2), 16))
  // Still a yellow: red and green well above blue.
  expect(r).toBeGreaterThan(b)
  expect(g).toBeGreaterThan(b)
})

test('isHex', () => {
  expect(isHex('#a1B2c3')).toBe(true)
  expect(isHex('a1b2c3')).toBe(false)
  expect(isHex('#abc')).toBe(false)
})
