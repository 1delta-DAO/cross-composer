import { useMemo } from "react"
import type { RawCurrency, RawCurrencyAmount } from "../../../types/currency"
import { formatDisplayAmount } from "../../swap/swapUtils"
import { getTokenPrice } from "../../swap/swapUtils"
import { CurrencyHandler } from "../../../sdk/types"
import type { Address } from "viem"

interface TransactionSummaryProps {
  srcCurrency?: RawCurrency
  dstCurrency?: RawCurrency
  inputAmount?: string
  outputAmount?: string
  currencyAmount?: RawCurrencyAmount
  srcPricesMerged?: Record<string, { usd: number }>
  dstPricesMerged?: Record<string, { usd: number }>
  route?: string
  chains?: Record<string, { data?: { name?: string } }>
}

export function TransactionSummary({
  srcCurrency,
  dstCurrency,
  inputAmount,
  outputAmount: outputAmountProp,
  currencyAmount,
  srcPricesMerged,
  dstPricesMerged,
  route,
  chains,
}: TransactionSummaryProps) {
  const outputAmount = useMemo(() => {
    if (outputAmountProp) return outputAmountProp
    if (currencyAmount) {
      const amount = CurrencyHandler.toExactNumber(currencyAmount)
      return amount > 0 ? amount.toString() : undefined
    }
    return undefined
  }, [outputAmountProp, currencyAmount])

  const shouldShow = useMemo(() => {
    return srcCurrency && dstCurrency && inputAmount && Number(inputAmount) > 0 && outputAmount && Number(outputAmount) > 0
  }, [srcCurrency, dstCurrency, inputAmount, outputAmount])

  const srcPrice = useMemo(() => {
    if (!srcCurrency) return undefined
    return getTokenPrice(srcCurrency.chainId, srcCurrency.address as Address, srcPricesMerged)
  }, [srcCurrency, srcPricesMerged])

  const dstPrice = useMemo(() => {
    if (!dstCurrency) return undefined
    return getTokenPrice(dstCurrency.chainId, dstCurrency.address as Address, dstPricesMerged)
  }, [dstCurrency, dstPricesMerged])

  const inputUsd = useMemo(() => {
    if (!inputAmount || !srcPrice) return undefined
    return Number(inputAmount) * srcPrice
  }, [inputAmount, srcPrice])

  const outputUsd = useMemo(() => {
    if (!outputAmount || !dstPrice) return undefined
    return Number(outputAmount) * dstPrice
  }, [outputAmount, dstPrice])

  const srcChainName = useMemo(() => {
    if (!srcCurrency?.chainId || !chains) return srcCurrency?.chainId
    return chains[srcCurrency.chainId]?.data?.name || srcCurrency.chainId
  }, [srcCurrency?.chainId, chains])

  const dstChainName = useMemo(() => {
    if (!dstCurrency?.chainId || !chains) return dstCurrency?.chainId
    return chains[dstCurrency.chainId]?.data?.name || dstCurrency.chainId
  }, [dstCurrency?.chainId, chains])

  if (!shouldShow) return null

  const formattedInput = formatDisplayAmount(inputAmount || "0")
  const formattedOutput = formatDisplayAmount(outputAmount || "0")

  return (
    <div className="card bg-base-200 shadow-sm border border-base-300 mt-4">
      <div className="card-body p-4">
        <div className="text-sm font-semibold mb-3">Transaction Details</div>
        <div className="space-y-3">
          <div>
            <div className="flex justify-between items-center mb-1">
              <span className="text-sm opacity-70">You'll pay:</span>
              <span className="font-medium">
                {formattedInput} {srcCurrency?.symbol}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-xs opacity-50"></span>
              <div className="text-xs opacity-60">
                {inputUsd !== undefined && isFinite(inputUsd) ? `$${inputUsd.toFixed(2)}` : ""}
                {srcChainName && <span className="ml-2">({srcChainName})</span>}
              </div>
            </div>
          </div>

          <div>
            <div className="flex justify-between items-center mb-1">
              <span className="text-sm opacity-70">You'll receive:</span>
              <span className="font-medium">
                {formattedOutput} {dstCurrency?.symbol}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-xs opacity-50"></span>
              <div className="text-xs opacity-60">
                {outputUsd !== undefined && isFinite(outputUsd) ? `$${outputUsd.toFixed(2)}` : ""}
                {dstChainName && <span className="ml-2">({dstChainName})</span>}
              </div>
            </div>
          </div>

          {route && (
            <div className="pt-2 border-t border-base-300">
              <div className="text-xs opacity-60">Route: {route}</div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
