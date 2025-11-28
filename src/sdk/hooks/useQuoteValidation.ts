import { useState, useEffect, useCallback } from 'react'
import {
  validateQuoteOutput,
  calculateAdjustedBuffer,
  calculateReverseQuoteBuffer,
} from '../../lib/reverseQuote'
import type { RawCurrencyAmount } from '../../types/currency'
import type { Quote } from './useQuoteFetcher'

export interface UseQuoteValidationReturn {
  highSlippageLossWarning: boolean
  currentBuffer: number
  validateAndUpdateQuotes: (
    quotes: Quote[],
    minRequiredAmount?: RawCurrencyAmount,
    isRefresh?: boolean,
    isUserSelection?: boolean
  ) => {
    quotes: Quote[]
    highSlippageLossWarning: boolean
    currentBuffer: number
  }
  updateBufferForSlippage: (slippage: number) => void
  checkSelectedQuoteValidation: (
    quotes: Quote[],
    selectedIndex: number,
    minRequiredAmount?: RawCurrencyAmount
  ) => void
}

export function useQuoteValidation(
  enableRequoting: boolean,
  slippage: number
): UseQuoteValidationReturn {
  const [highSlippageLossWarning, setHighSlippageLossWarning] = useState(false)
  const [currentBuffer, setCurrentBuffer] = useState<number>(calculateReverseQuoteBuffer(slippage))

  const validateAndUpdateQuotes = useCallback(
    (
      quotes: Quote[],
      minRequiredAmount?: RawCurrencyAmount,
      isRefresh?: boolean,
      isUserSelection?: boolean
    ): {
      quotes: Quote[]
      highSlippageLossWarning: boolean
      currentBuffer: number
    } => {
      if (!enableRequoting || !minRequiredAmount || quotes.length === 0) {
        setHighSlippageLossWarning(false)
        return {
          quotes,
          highSlippageLossWarning: false,
          currentBuffer,
        }
      }

      const bestQuote = quotes[0]
      const outputAmount = bestQuote.trade.outputAmountRealized
      const validationResult = validateQuoteOutput(outputAmount, minRequiredAmount)

      if (!validationResult.isValid) {
        console.debug('Quote validation failed:', validationResult)

        if (validationResult.hasHighSlippageLoss) {
          const newBuffer = 0.05
          setHighSlippageLossWarning(true)
          setCurrentBuffer(newBuffer)
          return {
            quotes,
            highSlippageLossWarning: true,
            currentBuffer: newBuffer,
          }
        } else {
          const adjustedBuffer = calculateAdjustedBuffer(
            currentBuffer,
            validationResult.requiredBuffer,
            slippage
          )
          setHighSlippageLossWarning(false)
          setCurrentBuffer(adjustedBuffer)

          if (adjustedBuffer > currentBuffer) {
            console.debug(
              'Buffer adjusted, but quotes already fetched. Validation warning may apply.'
            )
          }

          return {
            quotes,
            highSlippageLossWarning: false,
            currentBuffer: adjustedBuffer,
          }
        }
      } else {
        setHighSlippageLossWarning(false)
        return {
          quotes,
          highSlippageLossWarning: false,
          currentBuffer,
        }
      }
    },
    [enableRequoting, slippage, currentBuffer]
  )

  const updateBufferForSlippage = useCallback((newSlippage: number) => {
    setCurrentBuffer(calculateReverseQuoteBuffer(newSlippage))
  }, [])

  useEffect(() => {
    updateBufferForSlippage(slippage)
  }, [slippage, updateBufferForSlippage])

  const checkSelectedQuoteValidation = useCallback(
    (quotes: Quote[], selectedIndex: number, minRequiredAmount?: RawCurrencyAmount) => {
      if (
        !enableRequoting ||
        !minRequiredAmount ||
        quotes.length === 0 ||
        selectedIndex >= quotes.length
      ) {
        setHighSlippageLossWarning(false)
        return
      }

      const selectedQuote = quotes[selectedIndex]
      const outputAmount = selectedQuote.trade.outputAmountRealized
      const validation = validateQuoteOutput(outputAmount, minRequiredAmount)

      if (validation.hasHighSlippageLoss) {
        setHighSlippageLossWarning(true)
      } else {
        setHighSlippageLossWarning(false)
      }
    },
    [enableRequoting]
  )

  return {
    highSlippageLossWarning,
    currentBuffer,
    validateAndUpdateQuotes,
    updateBufferForSlippage,
    checkSelectedQuoteValidation,
  }
}
