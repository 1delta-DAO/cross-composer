import { useQuery } from "@tanstack/react-query"
import type { Address } from "viem"
import { useEffect } from "react"
import { setPricesFromDexscreener } from "../../lib/trade-helpers/prices"

export type PricesRecord = Record<string, Record<string, { usd: number }>>

const DEXSCREENER_TOKEN_URL = (addresses: string[]) => `https://api.dexscreener.com/latest/dex/tokens/${addresses.join(",")}`

const CHAIN_ID_MAP: Record<string, string[]> = {
  "1": ["ethereum", "1"],
  "10": ["optimism", "10"],
  "56": ["bsc", "56"],
  "137": ["polygon", "137"],
  "42161": ["arbitrum", "42161"],
  "43114": ["avalanche", "43114"],
  "8453": ["base", "8453"],
  "5000": ["mantle", "5000"],
  "1284": ["moonbeam", "1284"],
  "1285": ["moonriver", "1285"],
  "9745": ["opbnb", "9745"],
}

function getDexscreenerChainIds(chainId: string): string[] {
  return CHAIN_ID_MAP[chainId] || [chainId.toLowerCase(), chainId]
}

type DexscreenerResponse = {
  schemaVersion?: string
  pairs?: Array<{
    chainId?: string
    priceUsd?: string
    baseToken?: { address?: string }
    liquidity?: { usd?: number }
    volume?: { h24?: number }
  }>
}

async function fetchPrices(chainId: string, addresses: Address[]): Promise<PricesRecord> {
  const out: Record<string, { usd: number }> = {}
  if (addresses.length === 0) return { [chainId]: out }

  const uniq = Array.from(new Set(addresses.map((a) => a.toLowerCase())))
  const validChainIds = getDexscreenerChainIds(chainId)

  try {
    const res = await fetch(DEXSCREENER_TOKEN_URL(uniq))
    if (!res.ok) return { [chainId]: out }

    const json = (await res.json()) as DexscreenerResponse

    const priceMap: Record<string, { price: number; liquidity?: number; volume?: number }> = {}

    if (json.pairs) {
      for (const pair of json.pairs) {
        if (pair.priceUsd && pair.baseToken?.address) {
          const pairChainId = pair.chainId?.toLowerCase() || pair.chainId
          const addr = pair.baseToken.address.toLowerCase()

          if (pairChainId && !validChainIds.some((validId) => validId.toLowerCase() === pairChainId.toLowerCase())) {
            continue
          }

          const price = Number(pair.priceUsd)
          if (!isFinite(price) || price <= 0) continue

          const liquidity = pair.liquidity?.usd ? Number(pair.liquidity.usd) : 0
          const volume = pair.volume?.h24 ? Number(pair.volume.h24) : 0

          const existing = priceMap[addr]
          if (!existing) {
            priceMap[addr] = { price, liquidity, volume }
          } else {
            const existingLiquidity = existing.liquidity || 0
            const existingVolume = existing.volume || 0
            if (liquidity > existingLiquidity || (liquidity === existingLiquidity && volume > existingVolume)) {
              priceMap[addr] = { price, liquidity, volume }
            }
          }
        }
      }
    }

    for (const addr of uniq) {
      const entry = priceMap[addr]
      if (entry) {
        out[addr] = { usd: entry.price }
      }
    }
  } catch {}

  return { [chainId]: out }
}

export function useDexscreenerPrices(params: { chainId: string; addresses: Address[]; enabled?: boolean }) {
  const { chainId, addresses, enabled = true } = params
  const query = useQuery({
    queryKey: [
      "prices",
      chainId,
      addresses
        .map((a) => a.toLowerCase())
        .sort()
        .join(","),
    ],
    enabled: enabled && Boolean(chainId && addresses && addresses.length > 0),
    queryFn: () => fetchPrices(chainId, addresses),
    staleTime: 1000 * 60 * 2,
    refetchOnWindowFocus: false,
  })

  useEffect(() => {
    if (query.data) {
      setPricesFromDexscreener(query.data)
    }
  }, [query.data])

  return query
}
