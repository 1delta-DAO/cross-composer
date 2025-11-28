import { useRef } from 'react'

export const REFRESH_INTERVAL_MS = 30_000
export const REQUOTING_TIMEOUT_MS = 120_000

export function useQuoteRefreshHelpers() {
  const refreshTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const requotingStartTimeRef = useRef<number | null>(null)
  const requotingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const clearRefreshTimeout = () => {
    if (refreshTimeoutRef.current) {
      clearTimeout(refreshTimeoutRef.current)
      refreshTimeoutRef.current = null
    }
  }

  const clearRequotingTimeout = () => {
    if (requotingTimeoutRef.current) {
      clearTimeout(requotingTimeoutRef.current)
      requotingTimeoutRef.current = null
    }
  }

  const resetRequoting = () => {
    requotingStartTimeRef.current = null
    clearRequotingTimeout()
  }

  const checkRequotingTimeout = (): boolean => {
    if (requotingStartTimeRef.current === null) {
      requotingStartTimeRef.current = Date.now()
      return false
    }
    const elapsed = Date.now() - requotingStartTimeRef.current
    return elapsed >= REQUOTING_TIMEOUT_MS
  }

  const scheduleRefresh = (callback: () => void) => {
    clearRefreshTimeout()
    refreshTimeoutRef.current = setTimeout(() => {
      callback()
    }, REFRESH_INTERVAL_MS)
  }

  const cleanup = () => {
    clearRefreshTimeout()
    clearRequotingTimeout()
    resetRequoting()
  }

  return {
    refreshTimeoutRef,
    requotingStartTimeRef,
    requotingTimeoutRef,
    clearRefreshTimeout,
    clearRequotingTimeout,
    resetRequoting,
    checkRequotingTimeout,
    scheduleRefresh,
    cleanup,
  }
}
