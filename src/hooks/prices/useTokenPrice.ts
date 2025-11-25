import type { Address } from "viem"
import { useMemo } from "react"
import { usePriceQuery } from "./usePriceQuery"
import { getCurrency } from "../../lib/trade-helpers/utils"

export function useTokenPrice(params: { chainId: string; tokenAddress?: Address; enabled?: boolean }) {
  const { chainId, tokenAddress, enabled = true } = params

  const currency = useMemo(() => {
    if (!chainId || !tokenAddress) return undefined
    return getCurrency(chainId, tokenAddress)
  }, [chainId, tokenAddress])

  const { data, isLoading, ...rest } = usePriceQuery({
    currencies: currency ? [currency] : [],
    enabled: enabled && Boolean(currency),
  })

  const price = tokenAddress && currency && data?.[currency.chainId]?.[currency.address.toLowerCase()]?.usd

  return {
    price,
    isLoading,
    ...rest,
  }
}
