import { useMemo, useState, useEffect } from 'react'
import { SummaryRow } from './SummaryRow'
import { RouteSection } from './RouteSection'
import { CurrencyHandler, RawCurrency, RawCurrencyAmount } from '@1delta/lib-utils'
import { PricesRecord } from '../../hooks/prices/usePriceQuery'
import { formatDisplayAmount } from '../actionsTab/swapUtils'

interface TransactionSummaryProps {
  srcCurrency?: RawCurrency
  dstCurrency?: RawCurrency
  inputAmount?: string
  outputAmount?: string
  currencyAmount?: RawCurrencyAmount
  destinationActionLabel?: string
  route?: string
  chains?: Record<string, { data?: { name?: string } }>
  pricesData?: PricesRecord
  isLoadingPrices?: boolean
  isFetchingPrices?: boolean
}

export function TransactionSummary({
  srcCurrency,
  dstCurrency,
  inputAmount,
  outputAmount: outputAmountProp,
  currencyAmount,
  destinationActionLabel,
  route,
  chains,
  pricesData: pricesDataProp,
  isLoadingPrices: isLoadingPricesProp,
  isFetchingPrices: isFetchingPricesProp,
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
    const hasOutputAmount = outputAmount && Number(outputAmount) > 0
    return Boolean(srcCurrency && dstCurrency && hasOutputAmount)
  }, [srcCurrency, dstCurrency, outputAmount])

  const pricesData = pricesDataProp
  const isLoadingPrices = isLoadingPricesProp ?? false
  const isFetchingPrices = isFetchingPricesProp ?? false
  const isPricesLoading = isLoadingPrices || isFetchingPrices

  const srcPrice = useMemo(() => {
    if (!pricesData || !srcCurrency) return undefined
    const chainId = srcCurrency.chainId
    const addressKey = srcCurrency.address?.toLowerCase()
    return pricesData[chainId]?.[addressKey]?.usd
  }, [pricesData, srcCurrency])

  const dstPrice = useMemo(() => {
    if (!pricesData || !dstCurrency) return undefined
    const chainId = dstCurrency.chainId
    const addressKey = dstCurrency.address?.toLowerCase()
    return pricesData[chainId]?.[addressKey]?.usd
  }, [pricesData, dstCurrency])

  const [showCalculatingTimeout, setShowCalculatingTimeout] = useState(false)

  useEffect(() => {
    setShowCalculatingTimeout(false)
  }, [srcCurrency, dstCurrency])

  useEffect(() => {
    if (isPricesLoading) {
      setShowCalculatingTimeout(false)
      return
    }

    const hasInputAmount = inputAmount && Number(inputAmount) > 0
    const hasPrices = srcPrice !== undefined && dstPrice !== undefined

    if (hasInputAmount && hasPrices) {
      setShowCalculatingTimeout(false)
      return
    }

    if (!hasInputAmount) {
      if (!hasPrices) {
        const timer = setTimeout(() => {
          setShowCalculatingTimeout(true)
        }, 5000)
        return () => clearTimeout(timer)
      }
      setShowCalculatingTimeout(true)
      return
    }

    setShowCalculatingTimeout(false)
  }, [inputAmount, srcPrice, dstPrice, isPricesLoading])

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

  const hasInputAmount = inputAmount && Number(inputAmount) > 0
  const formattedInput = hasInputAmount
    ? formatDisplayAmount(inputAmount)
    : showCalculatingTimeout
      ? 'Price unavailable'
      : 'Calculating...'

  const formattedOutput = formatDisplayAmount(outputAmount || '0')

  if (!shouldShow) return null
  return (
    <div className="card bg-base-200 shadow-sm border border-base-300 mt-4">
      <div className="card-body p-4">
        <div className="text-sm font-semibold mb-3">Transaction Details</div>

        <div className="space-y-3">
          {/* You’ll Pay */}
          <SummaryRow
            label="You'll pay:"
            amount={formattedInput}
            currencySymbol={srcCurrency?.symbol}
            chainName={srcChainName}
            amountUsd={inputUsd}
            showFadedAmount={!hasInputAmount}
          />

          {/* You’ll Receive */}
          <SummaryRow
            label="You'll receive:"
            amount={formattedOutput}
            currencySymbol={dstCurrency?.symbol}
            chainName={dstChainName}
            amountUsd={outputUsd}
            destinationActionLabel={destinationActionLabel}
          />

          {route && <RouteSection route={route} />}
        </div>
      </div>
    </div>
  )
}
