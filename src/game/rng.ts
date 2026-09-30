/** A source of uniform numbers in [0, 1). */
export type Rng = () => number

/** Deterministic PRNG (mulberry32). */
export function seededRng(seed: number): Rng {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** Deterministic PRNG seeded from a string (FNV-1a hash), e.g. a UTC date for the daily sudoku. */
export function stringRng(text: string): Rng {
  let h = 0x811c9dc5
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 0x01000193)
  return seededRng(h)
}

export function randomInt(rng: Rng, n: number): number {
  return Math.floor(rng() * n)
}

/** A uniformly shuffled copy (Fisher-Yates). */
export function shuffled<T>(items: readonly T[], rng: Rng): T[] {
  const out = [...items]
  for (let i = out.length - 1; i > 0; i--) {
    const j = randomInt(rng, i + 1)
    ;[out[i], out[j]] = [out[j], out[i]]
  }
  return out
}
