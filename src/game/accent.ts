/**
 * Custom accent (design.md, Ajustes): the player picks any colour and each theme gets its own
 * version, with the same hue and saturation and only the lightness moved until the contrast holds.
 */

/** Ground of each theme (`--bg`), and the contrast the accent needs on it. */
export const DARK_GROUND = '#121413'
export const LIGHT_GROUND = '#ffffff'
/** Dark: like indigo `#8C95F6` (6:1 or more). Light: 5:1 on white, white text on it too. */
export const DARK_MIN = 6
export const LIGHT_MIN = 5

const HEX = /^#[0-9a-f]{6}$/i

export function isHex(value: string): boolean {
  return HEX.test(value)
}

function rgb(hex: string): [number, number, number] {
  const n = parseInt(hex.slice(1), 16)
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}

function toHex(r: number, g: number, b: number): string {
  return `#${[r, g, b].map((v) => Math.round(Math.min(255, Math.max(0, v))).toString(16).padStart(2, '0')).join('')}`
}

function toHsl(hex: string): [number, number, number] {
  const [r, g, b] = rgb(hex).map((v) => v / 255)
  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  const l = (max + min) / 2
  const d = max - min
  if (!d) return [0, 0, l]
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min)
  const h = max === r ? (g - b) / d + (g < b ? 6 : 0) : max === g ? (b - r) / d + 2 : (r - g) / d + 4
  return [h / 6, s, l]
}

function fromHsl(h: number, s: number, l: number): string {
  if (!s) return toHex(l * 255, l * 255, l * 255)
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s
  const p = 2 * l - q
  const f = (t: number) => {
    if (t < 0) t += 1
    if (t > 1) t -= 1
    if (t < 1 / 6) return p + (q - p) * 6 * t
    if (t < 1 / 2) return q
    if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6
    return p
  }
  return toHex(f(h + 1 / 3) * 255, f(h) * 255, f(h - 1 / 3) * 255)
}

/** WCAG relative luminance. */
function luminance(hex: string): number {
  const [r, g, b] = rgb(hex).map((v) => {
    const c = v / 255
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
  })
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

/** WCAG contrast ratio, 1 to 21. */
export function contrast(a: string, b: string): number {
  const [x, y] = [luminance(a), luminance(b)]
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05)
}

/** Lighter (dark theme) or darker (light theme) in steps of 1% lightness until the contrast holds. */
function fit(hex: string, ground: string, min: number, lighter: boolean): string {
  const [h, s, l0] = toHsl(hex)
  let out = hex.toLowerCase()
  for (let l = l0; contrast(out, ground) < min; ) {
    l = lighter ? Math.min(1, l + 0.01) : Math.max(0, l - 0.01)
    out = fromHsl(h, s, l)
    if (l === 0 || l === 1) break
  }
  return out
}

/** The picked colour as each theme shows it; unchanged where it already has the contrast. */
export function accentVariants(hex: string): { dark: string; light: string } {
  return { dark: fit(hex, DARK_GROUND, DARK_MIN, true), light: fit(hex, LIGHT_GROUND, LIGHT_MIN, false) }
}
