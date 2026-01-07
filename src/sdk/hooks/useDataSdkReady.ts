import { useState, useEffect } from 'react'
import { chains as getChains } from '@1delta/data-sdk'

function checkChainsReady(): boolean {
  try {
    const chains = getChains()
    return chains && Object.keys(chains).length > 0
  } catch {
    return false
  }
}

/**
 * Hook that resolves when data-sdk chain data is ready.
 */
export function useDataSdkReady() {
  const [ready, setReady] = useState<boolean>(() => checkChainsReady())

  useEffect(() => {
    if (ready) return

    const checkInterval = setInterval(() => {
      if (checkChainsReady()) {
        setReady(true)
        clearInterval(checkInterval)
      }
    }, 100)

    return () => clearInterval(checkInterval)
  }, [ready])

  return ready
}
