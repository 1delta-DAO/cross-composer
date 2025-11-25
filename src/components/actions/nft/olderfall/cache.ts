import type { OlderfallListing } from "./api"

type CacheEntry = {
  data: OlderfallListing[]
  timestamp: number
}

const CACHE_TTL = 15 * 60 * 1000

const cache = new Map<string, CacheEntry>()

export function getCachedListings(chainId: string): OlderfallListing[] | null {
  const entry = cache.get(chainId)
  if (!entry) {
    return null
  }

  const now = Date.now()
  if (now - entry.timestamp > CACHE_TTL) {
    cache.delete(chainId)
    return null
  }

  return entry.data
}

export function setCachedListings(chainId: string, listings: OlderfallListing[]): void {
  cache.set(chainId, {
    data: listings,
    timestamp: Date.now(),
  })
}

export function clearCache(): void {
  cache.clear()
}

export function clearCacheForChain(chainId: string): void {
  cache.delete(chainId)
}
