import ActionSelector, { initialState, UnifiedState } from '../ActionSelector'
import type { RawCurrency, RawCurrencyAmount } from '../../types/currency'
import { ActionHandler } from '../actions/shared/types'
import type { GenericTrade } from '@1delta/lib-utils'
import { TransactionSummary } from '../transactionSummary/TransactionSummary'
import type { PricesRecord } from '../../hooks/prices/usePriceQuery'
import { useState } from 'react'

/* -------------------------------------------------------------------------- */
/*                            UNIFIED STATE SHAPE                             */
/* -------------------------------------------------------------------------- */

type ActionsPanelProps = {
  srcCurrency?: RawCurrency
  dstCurrency?: RawCurrency
  currentChainId: number
  setActionInfo?: ActionHandler
  quotes?: Array<{ label: string; trade: GenericTrade }>
  selectedQuoteIndex?: number
  setSelectedQuoteIndex?: (index: number) => void
  slippage?: number
  onSrcCurrencyChange: (currency: RawCurrency) => void
  calculatedInputAmount?: string
  actionInfo?: { currencyAmount?: RawCurrencyAmount; actionLabel?: string }
  resetKey?: number
  pricesData?: PricesRecord
  isLoadingPrices?: boolean
  isFetchingPrices?: boolean
}

export function ActionsPanel({
  srcCurrency,
  dstCurrency,
  setActionInfo,
  quotes,
  selectedQuoteIndex,
  setSelectedQuoteIndex,
  slippage,
  onSrcCurrencyChange,
  calculatedInputAmount,
  actionInfo,
  resetKey,
  pricesData,
  isLoadingPrices,
  isFetchingPrices,
}: ActionsPanelProps) {
  /** selection state */
  const [state, setState] = useState<UnifiedState>(initialState)

  return (
    <>
      <ActionSelector
        state={state}
        setState={setState}
        pricesData={pricesData}
        resetKey={resetKey}
        srcCurrency={srcCurrency}
        dstCurrency={dstCurrency}
        setActionInfo={setActionInfo}
        quotes={quotes}
        selectedQuoteIndex={selectedQuoteIndex}
        setSelectedQuoteIndex={setSelectedQuoteIndex}
        slippage={slippage}
        onSrcCurrencyChange={onSrcCurrencyChange}
        actionInfo={actionInfo}
      />

      <TransactionSummary
        srcCurrency={srcCurrency}
        dstCurrency={dstCurrency}
        inputAmount={calculatedInputAmount}
        currencyAmount={actionInfo?.currencyAmount}
        destinationActionLabel={actionInfo?.actionLabel}
        pricesData={pricesData}
        isLoadingPrices={isLoadingPrices}
        isFetchingPrices={isFetchingPrices}
        state={state}
      />
    </>
  )
}
