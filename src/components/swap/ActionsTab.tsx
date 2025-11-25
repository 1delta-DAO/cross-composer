import { useState, useEffect, useMemo, useCallback, useRef } from "react"
import type { Address } from "viem"
import { zeroAddress } from "viem"
import { useChainId, useConnection } from "wagmi"
import { useChainsRegistry } from "../../sdk/hooks/useChainsRegistry"
import { useTokenLists } from "../../hooks/useTokenLists"
import { useEvmBalances } from "../../hooks/balances/useEvmBalances"
import { usePriceQuery } from "../../hooks/prices/usePriceQuery"
import { useTokenPrice } from "../../hooks/prices/useTokenPrice"
import { useDebounce } from "../../hooks/useDebounce"
import { CurrencyHandler, SupportedChainId } from "../../sdk/types"
import type { RawCurrency, RawCurrencyAmount } from "../../types/currency"
import { getCurrency } from "../../lib/trade-helpers/utils"
import { useQueryClient } from "@tanstack/react-query"
import { useSlippage } from "../../contexts/SlippageContext"
import { useSwapQuotes } from "../../sdk/hooks/useSwapQuotes"
import { usePriceImpact } from "../../hooks/usePriceImpact"
import ExecuteButton from "./ExecuteButton"
import { ActionsPanel } from "./ActionsPanel"
import { formatDisplayAmount, pickPreferredToken } from "./swapUtils"
import type { DestinationCall } from "../../lib/types/destinationAction"
import { reverseQuote } from "../../lib/reverseQuote"

type Props = {
  onResetStateChange?: (showReset: boolean, resetCallback?: () => void) => void
}

const DEFAULT_INPUT_CHAIN_ID = SupportedChainId.BASE

export function ActionsTab({ onResetStateChange }: Props) {
  const { address } = useConnection()
  const { data: chains } = useChainsRegistry()
  const { data: lists } = useTokenLists()
  const currentChainId = useChainId()

  const [inputCurrency, setInputCurrency] = useState<RawCurrency | undefined>(undefined)
  const [actionCurrency, setActionCurrency] = useState<RawCurrency | undefined>(undefined)
  const [amount, setAmount] = useState("")
  const [calculatedInputAmount, setCalculatedInputAmount] = useState<string>("")
  const [destinationInfo, setDestinationInfoState] = useState<{ currencyAmount?: RawCurrencyAmount } | undefined>(undefined)

  const inputChainId = inputCurrency?.chainId ?? DEFAULT_INPUT_CHAIN_ID
  const actionChainId = actionCurrency?.chainId

  const inputTokensMap = inputChainId ? lists?.[inputChainId] || {} : {}
  const inputAddrs = useMemo(() => (inputChainId ? (Object.keys(inputTokensMap) as Address[]).slice(0, 300) : []), [inputTokensMap, inputChainId])

  useEffect(() => {
    if (inputCurrency || !lists || !chains) return
    const native = chains?.[DEFAULT_INPUT_CHAIN_ID]?.data?.nativeCurrency?.symbol
    const force = DEFAULT_INPUT_CHAIN_ID === SupportedChainId.BASE ? "USDC" : undefined
    const tokensMap = lists[DEFAULT_INPUT_CHAIN_ID] || {}
    const pick = pickPreferredToken(tokensMap, force || native)
    if (!pick) return
    const meta = tokensMap[pick.toLowerCase()]
    if (!meta) return
    setInputCurrency({
      chainId: DEFAULT_INPUT_CHAIN_ID,
      address: pick,
      decimals: meta.decimals ?? 18,
      symbol: meta.symbol,
    })
  }, [inputCurrency, lists, chains])

  const inputAddressesWithNative = useMemo(() => {
    if (!inputChainId || !address) return []
    const addrs = [...inputAddrs]
    if (!addrs.includes(zeroAddress as Address)) {
      addrs.unshift(zeroAddress as Address)
    }
    return addrs
  }, [inputAddrs, inputChainId, address])

  const { data: inputBalances } = useEvmBalances({
    chainId: inputChainId,
    userAddress: address,
    tokenAddresses: inputAddressesWithNative,
  })

  const inputPriceCurrencies = useMemo(() => {
    if (!inputBalances?.[inputChainId] || !address || !inputChainId) return []

    const currencies: RawCurrency[] = []
    const seenAddresses = new Set<string>()

    for (const addr of inputAddressesWithNative) {
      const bal = inputBalances[inputChainId][addr.toLowerCase()]
      if (bal && Number(bal.value || 0) > 0) {
        const currency = getCurrency(inputChainId, addr)
        if (currency) {
          const key = currency.address.toLowerCase()
          if (!seenAddresses.has(key)) {
            seenAddresses.add(key)
            currencies.push(currency)
          }
        }
      }
    }

    return currencies
  }, [inputBalances, inputChainId, inputAddressesWithNative, address])

  const { data: inputPrices } = usePriceQuery({
    currencies: inputPriceCurrencies,
    enabled: inputPriceCurrencies.length > 0,
  })

  const inputTokenPriceAddr = useMemo(() => {
    if (!inputCurrency) return undefined
    if (inputCurrency.address.toLowerCase() === zeroAddress.toLowerCase()) {
      return CurrencyHandler.wrappedAddressFromAddress(inputCurrency.chainId, zeroAddress) as Address | undefined
    }
    return inputCurrency.address as Address
  }, [inputCurrency])

  const inputTokenPriceInCache = inputTokenPriceAddr && inputPrices?.[inputCurrency?.chainId || inputChainId]?.[inputTokenPriceAddr.toLowerCase()]

  const { price: inputTokenPrice } = useTokenPrice({
    chainId: inputCurrency?.chainId || inputChainId,
    tokenAddress: inputTokenPriceAddr,
    enabled: Boolean(inputCurrency && !inputTokenPriceInCache),
  })

  const inputPrice = useMemo(() => {
    if (inputTokenPrice !== undefined) return inputTokenPrice
    if (inputTokenPriceAddr && inputPrices?.[inputCurrency?.chainId || inputChainId]?.[inputTokenPriceAddr.toLowerCase()]?.usd) {
      return inputPrices[inputCurrency?.chainId || inputChainId][inputTokenPriceAddr.toLowerCase()].usd
    }
    return undefined
  }, [inputTokenPrice, inputTokenPriceAddr, inputPrices, inputCurrency, inputChainId])

  const actionTokenPriceAddr = useMemo(() => {
    if (!actionCurrency) return undefined
    if (actionCurrency.address.toLowerCase() === zeroAddress.toLowerCase()) {
      return CurrencyHandler.wrappedAddressFromAddress(actionCurrency.chainId, zeroAddress) as Address | undefined
    }
    return actionCurrency.address as Address
  }, [actionCurrency])

  const { price: actionTokenPrice } = useTokenPrice({
    chainId: actionCurrency?.chainId || actionChainId || "",
    tokenAddress: actionTokenPriceAddr,
    enabled: Boolean(actionCurrency),
  })

  const debouncedAmount = useDebounce(amount, 1000)
  const inputKey = useMemo(
    () => `${inputCurrency?.chainId || inputChainId}|${(inputCurrency?.address || "").toLowerCase()}`,
    [inputCurrency, inputChainId]
  )
  const actionKey = useMemo(
    () => `${actionCurrency?.chainId || actionChainId}|${(actionCurrency?.address || "").toLowerCase()}`,
    [actionCurrency, actionChainId]
  )
  const debouncedInputKey = useDebounce(inputKey, 1000)
  const debouncedActionKey = useDebounce(actionKey, 1000)

  const { slippage, setPriceImpact } = useSlippage()
  const [txInProgress, setTxInProgress] = useState(false)
  const [destinationCalls, setDestinationCalls] = useState<DestinationCall[]>([])
  const [actionResetKey, setActionResetKey] = useState(0)

  const isSwapOrBridge = useMemo(() => {
    return Boolean(inputCurrency && actionCurrency)
  }, [inputCurrency, actionCurrency])

  const { quotes, quoting, selectedQuoteIndex, setSelectedQuoteIndex, amountWei, refreshQuotes, abortQuotes } = useSwapQuotes({
    srcCurrency: inputCurrency,
    dstCurrency: actionCurrency,
    debouncedAmount,
    debouncedSrcKey: debouncedInputKey,
    debouncedDstKey: debouncedActionKey,
    slippage,
    txInProgress,
    destinationCalls,
  })

  const selectedTrade = quotes[selectedQuoteIndex]?.trade

  const quoteOut = useMemo(() => {
    if (!isSwapOrBridge || !selectedTrade?.outputAmount) return undefined
    try {
      const exact = CurrencyHandler.toExact(selectedTrade.outputAmount)
      return formatDisplayAmount(exact)
    } catch {
      return undefined
    }
  }, [selectedTrade, isSwapOrBridge])

  const priceImpact = usePriceImpact({
    selectedTrade,
    amount,
    quoteOut,
    srcToken: inputCurrency?.address as any,
    dstToken: actionCurrency?.address as any,
    srcChainId: inputChainId,
    dstChainId: actionChainId,
  })

  useEffect(() => {
    if (isSwapOrBridge) {
      setPriceImpact(priceImpact)
    }
  }, [priceImpact, setPriceImpact, isSwapOrBridge])

  const queryClient = useQueryClient()

  const setDestinationInfo = useCallback(
    (currencyAmount: RawCurrencyAmount | undefined, receiverAddress: string | undefined, destinationCalls: DestinationCall[]) => {
      if (!currencyAmount) {
        setDestinationInfoState(undefined)
        setCalculatedInputAmount("")
        setDestinationCalls([])
        setActionCurrency(undefined)
        return
      }

      const actionCur = currencyAmount.currency as RawCurrency
      setActionCurrency(actionCur)

      const amountHuman = CurrencyHandler.toExactNumber(currencyAmount)
      if (!amountHuman || amountHuman <= 0) {
        setDestinationInfoState(undefined)
        setCalculatedInputAmount("")
        setDestinationCalls([])
        setActionCurrency(undefined)
        return
      }

      const priceIn = inputPrice ?? 1
      const priceOut = actionTokenPrice ?? 1

      const decimalsOut = actionCur.decimals
      const amountIn = reverseQuote(decimalsOut, currencyAmount.amount.toString(), priceIn, priceOut)

      setCalculatedInputAmount(amountIn)
      setDestinationInfoState({ currencyAmount })
      setDestinationCalls(destinationCalls)

      setAmount(amountIn)
    },
    [inputCurrency, inputPrice, actionTokenPrice]
  )

  return (
    <div>
      <ActionsPanel
        resetKey={actionResetKey}
        srcCurrency={inputCurrency}
        dstCurrency={actionCurrency}
        currentChainId={currentChainId}
        tokenLists={lists}
        setDestinationInfo={setDestinationInfo}
        quotes={quotes}
        selectedQuoteIndex={selectedQuoteIndex}
        setSelectedQuoteIndex={setSelectedQuoteIndex}
        slippage={slippage}
        onSrcCurrencyChange={setInputCurrency}
        calculatedInputAmount={calculatedInputAmount}
        destinationInfo={destinationInfo}
      />

      {quotes.length > 0 && selectedTrade && (
        <div className="mt-4">
          <ExecuteButton
            trade={selectedTrade}
            srcCurrency={inputCurrency}
            dstCurrency={actionCurrency}
            amountWei={amountWei}
            destinationCalls={destinationCalls}
            chains={chains}
            onDone={(hashes) => {
              if (inputCurrency?.chainId && address) {
                queryClient.invalidateQueries({
                  queryKey: ["balances", inputCurrency.chainId, address],
                })
                queryClient.invalidateQueries({
                  queryKey: ["tokenBalance", inputCurrency.chainId, address],
                })
              }
              if (actionCurrency?.chainId && address) {
                queryClient.invalidateQueries({
                  queryKey: ["balances", actionCurrency.chainId, address],
                })
                queryClient.invalidateQueries({
                  queryKey: ["tokenBalance", actionCurrency.chainId, address],
                })
              }
              setDestinationInfo(undefined, undefined, [])

              if (hashes.src) {
                setActionResetKey((prev) => prev + 1)
              }
            }}
            onTransactionStart={() => {
              setTxInProgress(true)
              abortQuotes()
            }}
            onTransactionEnd={() => {
              setTxInProgress(false)
            }}
            onReset={() => {
              setAmount("")
              setTxInProgress(false)
            }}
            onResetStateChange={onResetStateChange}
          />
        </div>
      )}
    </div>
  )
}
