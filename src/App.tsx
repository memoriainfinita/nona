import { lazy, Suspense, useEffect, useMemo, useState } from 'react'
import { GameScreen } from './app/game/GameScreen'
import { useLayout } from './app/layout'
import { navigate, useRoute } from './app/router'
import { Enter } from './app/screens/Enter'
import { Home } from './app/screens/Home'
import { Settings } from './app/screens/Settings'
import { Stats } from './app/screens/Stats'
import { StoreProvider, useStore } from './app/store'
import { Sidebar } from './app/ui'
import { accentVariants } from './game/accent'

// Loaded when first opened, so it stays out of the initial JS (size-limit).
const Daily = lazy(() => import('./app/screens/Daily').then((m) => ({ default: m.Daily })))

function useSystemDark(): boolean {
  const query = '(prefers-color-scheme: dark)'
  const [dark, setDark] = useState(() => window.matchMedia(query).matches)
  useEffect(() => {
    const mq = window.matchMedia(query)
    const onChange = () => setDark(mq.matches)
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [])
  return dark
}

function Shell() {
  const store = useStore()
  const { settings, activeId, setActiveId } = store
  const route = useRoute()
  const layout = useLayout()
  const systemDark = useSystemDark()
  const dark = settings.theme === 'system' ? systemDark : settings.theme === 'dark'

  useEffect(() => {
    const root = document.documentElement
    root.dataset.theme = dark ? 'dark' : 'light'
    root.dataset.accent = settings.accent
    // A custom accent has no rule in tokens.css: its version for this theme goes inline.
    const custom = settings.accent === 'custom' && settings.customAccent ? accentVariants(settings.customAccent) : null
    if (custom) root.style.setProperty('--accent', dark ? custom.dark : custom.light)
    else root.style.removeProperty('--accent')
    root.dataset.size = settings.textSize
    // Status bar of the installed app and of mobile browsers follows the theme.
    const bg = getComputedStyle(root).getPropertyValue('--bg').trim()
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', bg)
  }, [dark, settings.accent, settings.customAccent, settings.textSize])

  // The game on screen is captured when it is opened: finishing it removes it from the list.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const initial = useMemo(() => store.games.find((g) => g.id === activeId) ?? null, [activeId])
  const playing = route === '/play' && initial !== null

  const screen = playing ? (
    <GameScreen
      key={initial.id}
      initial={initial}
      layout={layout}
      onMenu={() => setActiveId(null)}
      onPlayAnother={(g) => setActiveId(g.id)}
    />
  ) : route === '/enter' ? (
    <Enter layout={layout} />
  ) : route === '/daily' ? (
    <Suspense fallback={null}>
      <Daily layout={layout} />
    </Suspense>
  ) : route === '/stats' ? (
    <Stats layout={layout} />
  ) : route === '/settings' ? (
    <Settings layout={layout} dark={dark} />
  ) : (
    <Home layout={layout} dark={dark} />
  )

  return (
    <div className={`app layout-${layout.kind}${layout.sidebar ? ' with-sidebar' : ''}`}>
      {layout.sidebar && (
        <Sidebar
          route={route}
          dark={dark}
          onPlay={() => {
            if (route === '/play') setActiveId(null)
            else navigate('/play')
          }}
        />
      )}
      {screen}
    </div>
  )
}

export function App({ dbName }: { dbName?: string }) {
  return (
    <StoreProvider dbName={dbName}>
      <Shell />
    </StoreProvider>
  )
}
