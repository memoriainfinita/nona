import type { Hint, HintResponse } from './protocol'

/** The engine could not be loaded. The UI offers Retry; the hint does not count. */
export class EngineLoadError extends Error {
  override name = 'EngineLoadError'
}

/** The engine rejected the request (e.g. an invalid puzzle). */
export class EngineError extends Error {
  override name = 'EngineError'
}

export type WorkerFactory = () => Worker

const defaultFactory: WorkerFactory = () =>
  new Worker(new URL('./hint.worker.ts', import.meta.url), { type: 'module' })

interface Pending {
  resolve: (hint: Hint | null) => void
  reject: (error: Error) => void
}

/**
 * Hint engine in a Web Worker. The worker and the WASM module load on the first hint.
 * After a load failure the worker is dropped, so the next call (Retry) starts a fresh one.
 */
export class HintEngine {
  private worker: Worker | undefined
  private pending = new Map<number, Pending>()
  private nextId = 0
  private readonly createWorker: WorkerFactory

  constructor(createWorker: WorkerFactory = defaultFactory) {
    this.createWorker = createWorker
  }

  hint(puzzle: string, masks: Uint16Array): Promise<Hint | null> {
    const worker = this.ensureWorker()
    const id = this.nextId++
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject })
      worker.postMessage({ id, puzzle, masks })
    })
  }

  terminate(): void {
    this.fail(new EngineLoadError('engine terminated'))
  }

  private ensureWorker(): Worker {
    if (this.worker) return this.worker
    const worker = this.createWorker()
    worker.onmessage = ({ data }: MessageEvent<HintResponse>) => {
      const pending = this.pending.get(data.id)
      if (!pending) return
      this.pending.delete(data.id)
      if (data.ok) pending.resolve(data.hint)
      else if (data.error === 'load') this.fail(new EngineLoadError(data.message), pending)
      else pending.reject(new EngineError(data.message))
    }
    worker.onerror = (event) => {
      event.preventDefault()
      this.fail(new EngineLoadError(event.message || 'worker failed to load'))
    }
    this.worker = worker
    return worker
  }

  /** Drops the worker and rejects every pending request. */
  private fail(error: Error, first?: Pending): void {
    this.worker?.terminate()
    this.worker = undefined
    first?.reject(error)
    for (const pending of this.pending.values()) pending.reject(error)
    this.pending.clear()
  }
}
