import { createContext, useCallback, useContext, useState, type ReactNode } from 'react'
import type { Quote } from '../sdk/hooks/useQuoteFetcher'
import type { ActionCall } from '../components/actions/shared/types'
import type { RawCurrency } from '../types/currency'

export type QuoteTraceEntry = {
  id: string
  timestamp: number
  quotes: Quote[]
  error?: string
  actionInfo?: {
    actionType?: string
    actionLabel?: string
    actionId?: string
    destinationCalls?: ActionCall[]
  }
  requestInfo?: {
    srcCurrency?: RawCurrency
    dstCurrency?: RawCurrency
    amount?: string
    slippage?: number
  }
  success: boolean
}

type QuoteTraceContextValue = {
  entries: QuoteTraceEntry[]
  addTrace: (entry: Omit<QuoteTraceEntry, 'id' | 'timestamp'>) => void
  clearAll: () => void
}

const QuoteTraceContext = createContext<QuoteTraceContextValue | undefined>(undefined)

export function QuoteTraceProvider({ children }: { children: ReactNode }) {
  const [entries, setEntries] = useState<QuoteTraceEntry[]>([])

  const addTrace = useCallback((entry: Omit<QuoteTraceEntry, 'id' | 'timestamp'>) => {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2)}`
    const timestamp = Date.now()
    const full: QuoteTraceEntry = { ...entry, id, timestamp }
    setEntries((prev) => [full, ...prev])
  }, [])

  const clearAll = useCallback(() => {
    setEntries([])
  }, [])

  return (
    <QuoteTraceContext.Provider value={{ entries, addTrace, clearAll }}>
      {children}
    </QuoteTraceContext.Provider>
  )
}

export function useQuoteTrace() {
  const context = useContext(QuoteTraceContext)
  if (!context) {
    return {
      entries: [],
      addTrace: () => {},
      clearAll: () => {},
    }
  }
  return context
}
