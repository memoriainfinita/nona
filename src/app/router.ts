import { useEffect, useState } from 'react'

export type Route = '/play' | '/enter' | '/stats' | '/settings'
const ROUTES: readonly Route[] = ['/play', '/enter', '/stats', '/settings']

function current(): Route {
  const path = window.location.hash.replace(/^#/, '')
  return (ROUTES as readonly string[]).includes(path) ? (path as Route) : '/play'
}

/** Hash routes: #/play, #/enter, #/stats, #/settings. No links to puzzles. */
export function useRoute(): Route {
  const [route, setRoute] = useState(current)
  useEffect(() => {
    const onChange = () => setRoute(current())
    window.addEventListener('hashchange', onChange)
    return () => window.removeEventListener('hashchange', onChange)
  }, [])
  return route
}

export function navigate(route: Route): void {
  window.location.hash = route
}
