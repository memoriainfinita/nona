import { useEffect, useState } from 'react'

/**
 * phone: phone upright. phoneLandscape: phone on its side (board left, keys 3x3 right).
 * tablet: tablet upright. wide: tablet on its side or desktop (board left, side panel).
 * sidebar: desktop with a mouse (side bar with Play, Stats, Settings).
 */
export interface Layout {
  kind: 'phone' | 'phoneLandscape' | 'tablet' | 'wide'
  sidebar: boolean
  /** Dialogs as a bottom sheet (phone) or a centred card. */
  sheet: boolean
}

function measure(): Layout {
  const w = window.innerWidth
  const h = window.innerHeight
  const landscape = w > h
  const kind: Layout['kind'] = landscape ? (h < 600 ? 'phoneLandscape' : 'wide') : w < 700 ? 'phone' : 'tablet'
  const finePointer = window.matchMedia('(hover: hover) and (pointer: fine)').matches
  return { kind, sidebar: kind === 'wide' && w >= 1024 && finePointer, sheet: kind === 'phone' || kind === 'phoneLandscape' }
}

export function useLayout(): Layout {
  const [layout, setLayout] = useState(measure)
  useEffect(() => {
    const update = () =>
      setLayout((prev) => {
        const next = measure()
        return prev.kind === next.kind && prev.sidebar === next.sidebar ? prev : next
      })
    window.addEventListener('resize', update)
    return () => window.removeEventListener('resize', update)
  }, [])
  return layout
}
