import { useState, useEffect, useRef, useMemo, useCallback } from 'react'
import type { Address } from 'viem'
import { DUMMY_ADDRESS } from '../../lib/consts'
import { useToast } from '../../components/common/ToastHost'
import type { ActionCall } from '../../lib/types/actionCalls'
import type { RawCurrency, RawCurrencyAmount } from '../../types/currency'
import { usePriceQuery } from '../../hooks/prices/usePriceQuery'
import type { PricesRecord } from '../../hooks/prices/usePriceQuery'
import { useConnection } from 'wagmi'
import { fetchQuotes, type Quote } from './useQuoteFetcher'
import { useQuoteValidation } from './useQuoteValidation'
import { useQuoteRefreshHelpers, REFRESH_INTERVAL_MS } from './useQuoteRefresh'
import {
  generateDestinationCallsKey,
  generateQuoteKey,
  generateCurrencyKey,
  areQuoteKeysEqual,
} from './useTradeQuotes/stateHelpers'
import { validateInputs, detectChainTransition } from './useTradeQuotes/inputValidation'

export function useTradeQuotes({
  srcAmount,
  dstCurrency,
  slippage,
  txInProgress,
  destinationCalls,
  minRequiredAmount,
  enableRequoting,
}: {
  srcAmount?: RawCurrencyAmount
  dstCurrency?: RawCurrency
  slippage: number
  txInProgress: boolean
  destinationCalls?: ActionCall[]
  minRequiredAmount?: RawCurrencyAmount
  enableRequoting?: boolean
}) {
  const { address: userAddress } = useConnection()
  const receiverAddress = userAddress || DUMMY_ADDRESS
  const toast = useToast()

  const [quoting, setQuoting] = useState(false)
  const [quotes, setQuotes] = useState<Quote[]>([])
  const [selectedQuoteIndex, setSelectedQuoteIndex] = useState(0)
  const [amountWei, setAmountWei] = useState<string | undefined>(undefined)
  const [refreshTick, setRefreshTick] = useState(0)

  const requestInProgressRef = useRef(false)
  const abortControllerRef = useRef<AbortController | null>(null)
  const lastQuotedKeyRef = useRef<string | null>(null)
  const lastQuotedAtRef = useRef<number>(0)
  const prevSrcKeyRef = useRef<string>('')
  const prevDstKeyRef = useRef<string>('')
  const prevIsSameChainRef = useRef<boolean | null>(null)
  const isUserSelectionRef = useRef<boolean>(false)

  const refreshHelpers = useQuoteRefreshHelpers()

  const validation = useQuoteValidation(enableRequoting ?? false, slippage)

  const srcCurrency = useMemo(() => srcAmount?.currency, [srcAmount])
  const srcKey = useMemo(() => generateCurrencyKey(srcCurrency), [srcCurrency])
  const dstKey = useMemo(() => generateCurrencyKey(dstCurrency), [dstCurrency])
  const destinationCallsKey = useMemo(
    () => generateDestinationCallsKey(destinationCalls),
    [destinationCalls]
  )

  const axelarPriceCurrencies = useMemo(() => {
    const currencies: RawCurrency[] = []
    if (srcCurrency) currencies.push(srcCurrency)
    if (dstCurrency) currencies.push(dstCurrency)
    return currencies
  }, [srcCurrency, dstCurrency])

  const { data: axelarPrices } = usePriceQuery({
    currencies: axelarPriceCurrencies,
    enabled: axelarPriceCurrencies.length > 0,
  })

  const clearQuotesAndReset = useCallback(() => {
    setQuotes([])
    setSelectedQuoteIndex(0)
    isUserSelectionRef.current = false
    setQuoting(false)
    requestInProgressRef.current = false
    lastQuotedKeyRef.current = null
    refreshHelpers.cleanup()
    if (abortControllerRef.current) {
      abortControllerRef.current.abort()
      abortControllerRef.current = null
    }
  }, [refreshHelpers])

  useEffect(() => {
    if (prevSrcKeyRef.current !== srcKey || prevDstKeyRef.current !== dstKey) {
      if (quotes.length > 0 && !txInProgress) {
        clearQuotesAndReset()
      }
      prevSrcKeyRef.current = srcKey
      prevDstKeyRef.current = dstKey
    }
  }, [srcKey, dstKey, quotes.length, txInProgress, clearQuotesAndReset])

  const prevDestinationCallsKeyRef = useRef<string>('')
  useEffect(() => {
    if (prevDestinationCallsKeyRef.current !== destinationCallsKey) {
      if (quotes.length > 0 && !txInProgress) {
        clearQuotesAndReset()
      }
      if (!txInProgress) {
        lastQuotedKeyRef.current = null
      }
      prevDestinationCallsKeyRef.current = destinationCallsKey
    }
  }, [destinationCallsKey, quotes.length, txInProgress, clearQuotesAndReset])

  const prevTxInProgressRef = useRef(txInProgress)
  useEffect(() => {
    if (txInProgress) {
      console.debug('Skipping quote fetch: transaction in progress')
      setQuoting(false)
      requestInProgressRef.current = false
      if (abortControllerRef.current) {
        abortControllerRef.current.abort()
        abortControllerRef.current = null
      }
      refreshHelpers.cleanup()
      prevTxInProgressRef.current = txInProgress
      return
    }

    if (prevTxInProgressRef.current && !txInProgress) {
      console.debug('Transaction completed, resetting quote cache')
      lastQuotedKeyRef.current = null
      requestInProgressRef.current = false
      setQuoting(false)
      refreshHelpers.cleanup()
    }
    prevTxInProgressRef.current = txInProgress
  }, [txInProgress, refreshHelpers])

  useEffect(() => {
    if (txInProgress) {
      return
    }

    const inputValidation = validateInputs(srcAmount, dstCurrency)

    if (!inputValidation.isValid) {
      clearQuotesAndReset()
      return
    }

    const wasSameChain = prevIsSameChainRef.current
    const transitionedBetweenBridgeAndSwap = detectChainTransition(
      inputValidation.isSameChain,
      wasSameChain
    )

    if (transitionedBetweenBridgeAndSwap) {
      console.debug('Transitioned between bridge and swap, clearing quote cache')
      clearQuotesAndReset()
    }
    prevIsSameChainRef.current = inputValidation.isSameChain

    if (requestInProgressRef.current) {
      console.debug('Request already in progress, skipping...')
      return
    }

    const currentKey = generateQuoteKey(
      srcAmount,
      dstCurrency,
      slippage,
      receiverAddress,
      destinationCallsKey
    )

    const now = Date.now()
    const sameAsLast = areQuoteKeysEqual(lastQuotedKeyRef.current, currentKey)
    const elapsed = now - lastQuotedAtRef.current

    if (lastQuotedKeyRef.current !== null && lastQuotedKeyRef.current !== currentKey) {
      lastQuotedKeyRef.current = null
      isUserSelectionRef.current = false
      refreshHelpers.resetRequoting()
    }

    if (sameAsLast && !transitionedBetweenBridgeAndSwap && elapsed < REFRESH_INTERVAL_MS) {
      console.debug('Skipping re-quote: inputs unchanged and refresh interval not reached')
      return
    }

    if (refreshHelpers.checkRequotingTimeout()) {
      console.debug('Requoting timeout reached (2 minutes), stopping to prevent API rate limiting')
      setQuoting(false)
      requestInProgressRef.current = false
      if (abortControllerRef.current) {
        abortControllerRef.current.abort()
        abortControllerRef.current = null
      }
      refreshHelpers.cleanup()
      return
    }

    if (abortControllerRef.current) {
      abortControllerRef.current.abort()
    }

    let cancel = false
    requestInProgressRef.current = true
    setQuoting(true)

    const controller = new AbortController()
    abortControllerRef.current = controller

    refreshHelpers.clearRefreshTimeout()

    const fetchQuote = async () => {
      try {
        const isRefresh = areQuoteKeysEqual(lastQuotedKeyRef.current, currentKey)
        lastQuotedKeyRef.current = currentKey
        lastQuotedAtRef.current = Date.now()

        if (!srcAmount || !dstCurrency) {
          throw new Error('Failed to convert tokens to SDK format')
        }

        const allQuotes = await fetchQuotes({
          srcAmount,
          dstCurrency,
          slippage,
          receiverAddress: receiverAddress as Address,
          destinationCalls,
          controller,
          axelarPrices: (axelarPrices || {}) as PricesRecord,
        })

        if (cancel || controller.signal.aborted) {
          console.debug('Request cancelled or aborted')
          return
        }

        if (allQuotes.length > 0) {
          console.debug('Quotes received:', allQuotes.length)

          setAmountWei(srcAmount.amount.toString())

          setQuotes(allQuotes)
          setSelectedQuoteIndex((prevIndex) => {
            const isValidIndex = prevIndex >= 0 && prevIndex < allQuotes.length
            const shouldPreserve = isRefresh && isValidIndex && isUserSelectionRef.current
            return shouldPreserve ? prevIndex : 0
          })
          if (!isRefresh || !isUserSelectionRef.current) {
            isUserSelectionRef.current = false
          }

          validation.validateAndUpdateQuotes(
            allQuotes,
            minRequiredAmount,
            isRefresh,
            isUserSelectionRef.current
          )

          refreshHelpers.resetRequoting()
        } else {
          throw new Error('No quote available from any aggregator/bridge')
        }
      } catch (error) {
        if (cancel || controller.signal.aborted) {
          console.debug('Request cancelled during error handling')
          return
        }
        const errorMessage = error instanceof Error ? error.message : 'Failed to fetch quote'
        toast.showError(errorMessage)
        setQuotes([])
        setSelectedQuoteIndex(0)
        isUserSelectionRef.current = false
        console.error('Quote fetch error:', error)
      } finally {
        if (!cancel && !controller.signal.aborted) {
          setQuoting(false)
        }
        requestInProgressRef.current = false
        if (abortControllerRef.current === controller) {
          abortControllerRef.current = null
        }
        if (!cancel && !controller.signal.aborted && !txInProgress) {
          const scheduledKey = lastQuotedKeyRef.current
          refreshHelpers.scheduleRefresh(() => {
            if (scheduledKey === lastQuotedKeyRef.current && !txInProgress) {
              setRefreshTick((x: number) => x + 1)
            }
          })
        }
      }
    }

    fetchQuote()

    return () => {
      cancel = true
      controller.abort()
      requestInProgressRef.current = false
      if (abortControllerRef.current === controller) {
        abortControllerRef.current = null
      }
      refreshHelpers.cleanup()
    }
  }, [
    srcAmount,
    dstCurrency,
    userAddress,
    slippage,
    refreshTick,
    txInProgress,
    srcCurrency,
    destinationCallsKey,
    destinationCalls,
    receiverAddress,
    minRequiredAmount,
    enableRequoting,
    axelarPrices,
    validation,
    refreshHelpers,
    clearQuotesAndReset,
    toast,
  ])

  useEffect(() => {
    validation.checkSelectedQuoteValidation(quotes, selectedQuoteIndex, minRequiredAmount)
  }, [quotes, selectedQuoteIndex, minRequiredAmount, validation])

  const refreshQuotes = useCallback(() => {
    setRefreshTick((x: number) => x + 1)
  }, [])

  const abortQuotes = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort()
      abortControllerRef.current = null
    }
    refreshHelpers.cleanup()
    requestInProgressRef.current = false
    setQuoting(false)
    lastQuotedKeyRef.current = null
  }, [refreshHelpers])

  const wrappedSetSelectedQuoteIndex = useCallback((index: number) => {
    isUserSelectionRef.current = true
    setSelectedQuoteIndex(index)
  }, [])

  return {
    quotes,
    quoting,
    selectedQuoteIndex,
    setSelectedQuoteIndex: wrappedSetSelectedQuoteIndex,
    amountWei,
    refreshQuotes,
    abortQuotes,
    highSlippageLossWarning: validation.highSlippageLossWarning,
    currentBuffer: validation.currentBuffer,
  }
}
