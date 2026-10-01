import init, { check, hint } from '../../engine/pkg/nona_engine.js'
import type { EngineRequest, EngineResponse } from './protocol'

const scope = self as unknown as {
  onmessage: (event: MessageEvent<EngineRequest>) => void
  postMessage: (message: EngineResponse) => void
}

let ready: Promise<unknown> | undefined

scope.onmessage = async ({ data }) => {
  const { id } = data
  try {
    await (ready ??= init())
  } catch (e) {
    scope.postMessage({ id, ok: false, error: 'load', message: String(e) })
    return
  }
  try {
    const json = data.type === 'hint' ? hint(data.puzzle, data.masks) : check(data.puzzle)
    scope.postMessage({ id, ok: true, result: JSON.parse(json) })
  } catch (e) {
    scope.postMessage({ id, ok: false, error: 'engine', message: String(e) })
  }
}
