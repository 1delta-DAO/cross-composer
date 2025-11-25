import { useState, useMemo, useEffect, useRef } from "react"
import { CurrencyHandler, SupportedChainId } from "../../../../sdk/types"
import { DestinationActionHandler } from "../../shared/types"
import { buildCalls } from "./callBuilder"
import { XCDOT_ADDRESS, STELLA_STDOT_ADDRESS } from "../../../../lib/consts"
import { StellaStakingCard } from "./StellaStakingCard"
import type { RawCurrency } from "../../../../types/currency"
import { parseUnits } from "viem"
import { reverseQuote } from "../../../../lib/reverseQuote"
import { useDebounce } from "../../../../hooks/useDebounce"
import { fetchAllAggregatorTrades } from "../../../../lib/trade-helpers/aggregatorSelector"
import { TradeType } from "@1delta/lib-utils"
import type { Address } from "viem"
import { useTokenPrice } from "../../../../hooks/prices/useTokenPrice"
import { zeroAddress } from "viem"
import { useConnection } from "wagmi"
import { MOCK_RECEIVER_ADDRESS } from "../../../../lib/consts"

type TokenListsMeta = Record<string, Record<string, { symbol?: string; decimals: number; address: string; chainId: string }>>

interface StellaStakingPanelProps {
  tokenLists?: TokenListsMeta
  setDestinationInfo?: DestinationActionHandler
  srcCurrency?: RawCurrency
  dstCurrency?: RawCurrency
  slippage?: number
  resetKey?: number
}

export function StellaStakingPanel({ tokenLists, setDestinationInfo, srcCurrency, dstCurrency, slippage = 0.5, resetKey }: StellaStakingPanelProps) {
  const { address } = useConnection()
  const receiverAddress = address || MOCK_RECEIVER_ADDRESS

  const [outputAmount, setOutputAmount] = useState("")
  const [isSelected, setIsSelected] = useState(false)
  const [quote, setQuote] = useState<{ trade: any } | null>(null)
  const [loadingQuote, setLoadingQuote] = useState(false)
  const [quoteError, setQuoteError] = useState<string | null>(null)
  const loadingRef = useRef(false)

  const chainId = SupportedChainId.MOONBEAM
  const debouncedOutputAmount = useDebounce(outputAmount, 1000)

  const xcDOTToken = useMemo(() => {
    if (!tokenLists || !chainId) return undefined
    return tokenLists[chainId]?.[XCDOT_ADDRESS.toLowerCase()]
  }, [tokenLists, chainId])

  const xcDOTCurrency = useMemo(() => {
    if (!xcDOTToken || !chainId) return undefined
    return {
      chainId: String(chainId),
      address: XCDOT_ADDRESS,
      decimals: xcDOTToken.decimals,
      symbol: xcDOTToken.symbol || "XCDOT",
    } as RawCurrency
  }, [xcDOTToken, chainId])

  // Get price address for srcCurrency (handle native tokens)
  const srcTokenPriceAddr = useMemo(() => {
    if (!srcCurrency) return undefined
    if (srcCurrency.address.toLowerCase() === zeroAddress.toLowerCase()) {
      return CurrencyHandler.wrappedAddressFromAddress(srcCurrency.chainId, zeroAddress) as Address | undefined
    }
    return srcCurrency.address as Address
  }, [srcCurrency])

  const shouldFetchXcDOTPrice = Boolean(chainId && outputAmount && Number(outputAmount) > 0)
  const shouldFetchSrcTokenPrice = Boolean(srcCurrency && srcTokenPriceAddr && outputAmount && Number(outputAmount) > 0)

  const { price: xcDOTPrice, isLoading: isLoadingXcDOTPrice } = useTokenPrice({
    chainId: String(chainId),
    tokenAddress: XCDOT_ADDRESS,
    enabled: shouldFetchXcDOTPrice,
  })

  const { price: srcTokenPrice, isLoading: isLoadingSrcTokenPrice } = useTokenPrice({
    chainId: srcCurrency?.chainId || "",
    tokenAddress: srcTokenPriceAddr,
    enabled: shouldFetchSrcTokenPrice,
  })

  const calculatedInputAmount = useMemo(() => {
    if (!debouncedOutputAmount || !xcDOTToken) {
      return undefined
    }

    const amount = Number(debouncedOutputAmount)
    if (!amount || amount <= 0) {
      return undefined
    }

    // We need DOT (xcDOT) price and source token price for reverse quote
    if (xcDOTPrice === undefined || srcTokenPrice === undefined) {
      return undefined
    }

    try {
      // User enters DOT amount (output), we calculate how much source token (input) is needed
      // reverseQuote(decimalsOut, amountOut, priceIn, priceOut)
      // - decimalsOut: DOT/xcDOT decimals
      // - amountOut: DOT amount in wei
      // - priceIn: source token price
      // - priceOut: DOT/xcDOT price
      const amountInWei = parseUnits(debouncedOutputAmount, xcDOTToken.decimals)
      const inputAmount = reverseQuote(xcDOTToken.decimals, amountInWei.toString(), srcTokenPrice, xcDOTPrice, slippage)
      return inputAmount
    } catch (error) {
      console.error("Error calculating reverse quote:", error)
      return undefined
    }
  }, [debouncedOutputAmount, xcDOTToken, xcDOTPrice, srcTokenPrice, slippage])

  useEffect(() => {
    const fetchQuote = async () => {
      if (!srcCurrency || !xcDOTCurrency || !calculatedInputAmount) {
        setQuote(null)
        setQuoteError(null)
        return
      }

      const amount = Number(calculatedInputAmount)
      if (!amount || amount <= 0) {
        setQuote(null)
        setQuoteError(null)
        return
      }

      if (loadingRef.current) return

      loadingRef.current = true
      setLoadingQuote(true)
      setQuoteError(null)
      try {
        const amountInWei = parseUnits(calculatedInputAmount, srcCurrency.decimals)
        const fromCurrency = srcCurrency
        const toCurrency = xcDOTCurrency

        const trades = await fetchAllAggregatorTrades(srcCurrency.chainId, {
          chainId: srcCurrency.chainId,
          fromCurrency,
          toCurrency,
          swapAmount: amountInWei,
          slippage,
          caller: receiverAddress,
          receiver: receiverAddress,
          tradeType: TradeType.EXACT_OUTPUT,
          flashSwap: false,
          usePermit: true,
        } as any)

        if (trades.length > 0) {
          setQuote({ trade: trades[0].trade })
          setQuoteError(null)
        } else {
          setQuote(null)
          setQuoteError("No quote available. Please try a different amount.")
        }
      } catch (error) {
        console.error("Error fetching staking quote:", error)
        const errorMessage = error instanceof Error ? error.message : "Failed to fetch quote"
        setQuote(null)
        setQuoteError(errorMessage)
      } finally {
        setLoadingQuote(false)
        loadingRef.current = false
      }
    }

    fetchQuote()
  }, [srcCurrency, xcDOTCurrency, calculatedInputAmount, address, slippage])

  useEffect(() => {
    const autoSelect = async () => {
      if (!quote || !debouncedOutputAmount || !xcDOTToken || !address || isSelected) return

      const amount = Number(debouncedOutputAmount)
      if (!amount || amount <= 0) return

      const destinationCalls = await buildCalls({
        userAddress: address as any,
      })

      if (setDestinationInfo) {
        // User entered DOT amount, set it as the destination currency amount
        const outputAmountWei = parseUnits(debouncedOutputAmount, xcDOTToken.decimals)
        const currencyAmount = CurrencyHandler.fromRawAmount(xcDOTToken, outputAmountWei.toString())

        setDestinationInfo(currencyAmount, undefined, destinationCalls, "Staked DOT")
        setIsSelected(true)
        setTimeout(() => setIsSelected(false), 1000)
      }
    }

    autoSelect()
  }, [quote, debouncedOutputAmount, xcDOTToken, address, isSelected, setDestinationInfo])

  const handleAmountChange = (value: string) => {
    setOutputAmount(value)
    setIsSelected(false)
    setQuote(null)
    setQuoteError(null)
  }

  const handleSelect = async () => {
    if (!address || !debouncedOutputAmount || !xcDOTToken || !quote) return

    const amount = Number(debouncedOutputAmount)
    if (!amount || amount <= 0) {
      return
    }

    const destinationCalls = await buildCalls({
      userAddress: address as any,
    })

    if (setDestinationInfo) {
      // User entered DOT amount, set it as the destination currency amount
      const outputAmountWei = parseUnits(debouncedOutputAmount, xcDOTToken.decimals)
      const currencyAmount = CurrencyHandler.fromRawAmount(xcDOTToken, outputAmountWei.toString())

      setDestinationInfo(currencyAmount, undefined, destinationCalls, "Staked DOT")
      setIsSelected(true)
      setTimeout(() => setIsSelected(false), 1000)
    }
  }

  useEffect(() => {
    if (resetKey !== undefined && resetKey > 0) {
      setOutputAmount("")
      setIsSelected(false)
      setQuote(null)
      setQuoteError(null)
      setDestinationInfo?.(undefined, undefined, [])
    }
  }, [resetKey])

  return (
    <div className="space-y-3">
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <input
            className="input input-bordered flex-1"
            placeholder="DOT amount"
            value={outputAmount}
            onChange={(e) => handleAmountChange(e.target.value)}
            inputMode="decimal"
          />
        </div>

        {/* Status indicators */}
        {outputAmount && Number(outputAmount) > 0 && (
          <div className="space-y-1">
            {/* Step 1: Fetching prices */}
            {(isLoadingXcDOTPrice || isLoadingSrcTokenPrice) && (
              <div className="flex items-center gap-2 text-xs text-info">
                <span className="loading loading-spinner loading-xs"></span>
                <span>Fetching token prices...</span>
              </div>
            )}

            {/* Step 2: Calculating input amount */}
            {!isLoadingXcDOTPrice && !isLoadingSrcTokenPrice && (xcDOTPrice === undefined || srcTokenPrice === undefined) && (
              <div className="flex items-center gap-2 text-xs text-warning">
                <span>⚠️</span>
                <span>Waiting for prices to calculate required input...</span>
              </div>
            )}

            {/* Step 3: Show calculated input amount */}
            {calculatedInputAmount && srcCurrency && !isLoadingXcDOTPrice && !isLoadingSrcTokenPrice && (
              <div className="text-xs text-success">
                ✓ Requires ~{Number(calculatedInputAmount).toFixed(6)} {srcCurrency.symbol || "tokens"}
              </div>
            )}

            {/* Step 4: Fetching quote */}
            {loadingQuote && calculatedInputAmount && (
              <div className="flex items-center gap-2 text-xs text-info">
                <span className="loading loading-spinner loading-xs"></span>
                <span>Fetching swap quote...</span>
              </div>
            )}

            {/* Step 5: Error state */}
            {quoteError && !loadingQuote && (
              <div className="flex items-center gap-2 text-xs text-error">
                <span>❌</span>
                <span>{quoteError}</span>
              </div>
            )}

            {/* Step 6: Quote ready */}
            {quote && debouncedOutputAmount && Number(debouncedOutputAmount) > 0 && !loadingQuote && (
              <StellaStakingCard
                isSelected={isSelected}
                onSelect={handleSelect}
                outputAmount={debouncedOutputAmount}
                outputTokenSymbol={xcDOTToken?.symbol || "DOT"}
              />
            )}
          </div>
        )}
      </div>
    </div>
  )
}
