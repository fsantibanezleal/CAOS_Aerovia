import type { EngineRequest, EngineResponse } from '../contracts'
import { curve, optimizeSpeed, sensitivity, solveNetwork } from './index'

export function dispatch(request: EngineRequest): EngineResponse {
  const { id, kind, network, options } = request
  try {
    switch (kind) {
      case 'solve': return { id, kind, result: solveNetwork(network, options) }
      case 'optimize': return { id, kind, result: optimizeSpeed(network, options) }
      case 'sensitivity': return { id, kind, result: sensitivity(network, options) }
      case 'curve': return { id, kind, result: curve(network, options) }
      default: throw new Error('Unknown engine operation.')
    }
  } catch (error) {
    return { id, kind, error: error instanceof Error ? error.message : 'The numerical operation failed.' }
  }
}

// Also importable in Node-based tests; no browser-global side effects there.
if (typeof self !== 'undefined' && typeof document === 'undefined') {
  self.addEventListener('message', (event: MessageEvent<EngineRequest>) => {
    self.postMessage(dispatch(event.data))
  })
}
