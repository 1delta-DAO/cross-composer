import { useRef, useCallback } from 'react'

export const REFRESH_INTERVAL_MS = 30_000

export function useQuoteRefreshHelpers() {
  const refreshTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const clearRefreshTimeout = useCallback(() => {
    if (refreshTimeoutRef.current) {
      clearTimeout(refreshTimeoutRef.current)
      refreshTimeoutRef.current = null
    }
  }, [])

  const scheduleRefresh = useCallback(
    (callback: () => void) => {
      clearRefreshTimeout()
      refreshTimeoutRef.current = setTimeout(() => {
        callback()
      }, REFRESH_INTERVAL_MS)
    },
    [clearRefreshTimeout]
  )

  const cleanup = useCallback(() => {
    clearRefreshTimeout()
  }, [clearRefreshTimeout])

  return {
    refreshTimeoutRef,
    clearRefreshTimeout,
    scheduleRefresh,
    cleanup,
  }
}
