import { describe, expect, test } from 'vitest'
import { customLevel, parsePasted } from './custom'

describe('a puzzle entered by the player', () => {
  test('engine levels map to app levels; Beginner is Easy and Extreme is Master', () => {
    expect(customLevel('Beginner')).toBe('easy')
    expect(customLevel('Medium')).toBe('medium')
    expect(customLevel('Master')).toBe('master')
    expect(customLevel('Extreme')).toBe('master')
    expect(() => customLevel('Unknown')).toThrow()
  })

  test('pasted text: 81 cells with . or 0 for empty, whitespace ignored', () => {
    const line = '.981.6.........389....4...52.531.76.4...2...1.13.648.26...8....321.........4.312.'
    const values = parsePasted(line)!
    expect(values).toHaveLength(81)
    expect(values.slice(0, 4)).toEqual([0, 9, 8, 1])
    const rows = line.replace(/\./g, '0').match(/.{9}/g)!.join('\n')
    expect(parsePasted(`  ${rows}\n`)).toEqual(values)
    expect(parsePasted(line.slice(1))).toBeNull()
    expect(parsePasted(line.replace('9', 'x'))).toBeNull()
  })
})
