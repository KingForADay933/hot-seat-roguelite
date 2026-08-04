import { useContext } from 'react'
import { RunContext } from './runContext.core'

export function useRun() {
  const ctx = useContext(RunContext)
  if (!ctx) throw new Error('useRun must be used within a RunProvider')
  return ctx
}
