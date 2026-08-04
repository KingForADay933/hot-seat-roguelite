import { createContext } from 'react'
import type { RunBundle } from '../../data/persistence/runRepository'

export interface RunContextValue {
  bundle: RunBundle | null
  loading: boolean
  startNewRun: () => Promise<void>
  simSeason: () => Promise<void>
}

export const RunContext = createContext<RunContextValue | null>(null)
