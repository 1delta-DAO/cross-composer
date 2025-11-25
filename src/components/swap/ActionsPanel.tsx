import DestinationActionSelector from "../DestinationActionSelector"
import type { RawCurrency, RawCurrencyAmount } from "../../types/currency"
import { DestinationActionHandler } from "../actions/shared/types"
import type { GenericTrade } from "@1delta/lib-utils"
import { InputTokenSelector } from "../actions/shared/InputTokenSelector"
import { TransactionSummary } from "../actions/shared/TransactionSummary"
import { useChainsRegistry } from "../../sdk/hooks/useChainsRegistry"
import { useTokenLists } from "../../hooks/useTokenLists"

type ActionsPanelProps = {
  srcCurrency?: RawCurrency
  dstCurrency?: RawCurrency
  currentChainId: number
  tokenLists?: Record<string, Record<string, { symbol?: string; decimals?: number }>> | undefined
  setDestinationInfo?: DestinationActionHandler
  quotes?: Array<{ label: string; trade: GenericTrade }>
  selectedQuoteIndex?: number
  setSelectedQuoteIndex?: (index: number) => void
  slippage?: number
  onSrcCurrencyChange: (currency: RawCurrency) => void
  calculatedInputAmount?: string
  destinationInfo?: { currencyAmount?: RawCurrencyAmount }
  resetKey?: number
}

export function ActionsPanel({
  srcCurrency,
  dstCurrency,
  tokenLists,
  setDestinationInfo,
  quotes,
  selectedQuoteIndex,
  setSelectedQuoteIndex,
  slippage,
  onSrcCurrencyChange,
  calculatedInputAmount,
  destinationInfo,
  resetKey,
}: ActionsPanelProps) {
  const { data: chains } = useChainsRegistry()
  const { data: lists } = useTokenLists()

  return (
    <div className="card bg-base-200 shadow-lg border border-primary/30 mt-4">
      <div className="card-body">
        <div className="flex items-center justify-between mb-3">
          <div className="font-medium">Actions</div>
          <InputTokenSelector srcCurrency={srcCurrency} onCurrencyChange={onSrcCurrencyChange} tokenLists={lists} chains={chains} />
        </div>

        <DestinationActionSelector
          resetKey={resetKey}
          srcCurrency={srcCurrency}
          dstCurrency={dstCurrency}
          tokenLists={tokenLists}
          setDestinationInfo={setDestinationInfo}
          quotes={quotes}
          selectedQuoteIndex={selectedQuoteIndex}
          setSelectedQuoteIndex={setSelectedQuoteIndex}
          slippage={slippage}
        />

        <TransactionSummary
          srcCurrency={srcCurrency}
          dstCurrency={dstCurrency}
          inputAmount={calculatedInputAmount}
          currencyAmount={destinationInfo?.currencyAmount}
          chains={chains}
        />
      </div>
    </div>
  )
}
