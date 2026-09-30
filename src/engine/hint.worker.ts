import init, { hint } from '../../engine/pkg/nona_engine.js'
import type { HintRequest, HintResponse } from './protocol'

const scope = self as unknown as {
  onmessage: (event: MessageEvent<HintRequest>) => void
  postMessage: (message: HintResponse) => void
}

let ready: Promise<unknown> | undefined

scope.onmessage = async ({ data: { id, puzzle, masks } }) => {
  try {
    await (ready ??= init())
  } catch (e) {
    scope.postMessage({ id, ok: false, error: 'load', message: String(e) })
    return
  }
  try {
    scope.postMessage({ id, ok: true, hint: JSON.parse(hint(puzzle, masks)) })
  } catch (e) {
    scope.postMessage({ id, ok: false, error: 'engine', message: String(e) })
  }
}
