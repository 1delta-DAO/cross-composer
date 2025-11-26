import type { Address } from 'viem'
import { Logo } from '../common/Logo'
import type { RawCurrency } from '../../types/currency'

type TokenInputProps = {
  label: string
  amount: string
  onAmountChange: (value: string) => void
  currency?: RawCurrency
  tokenLists?: Record<string, Record<string, any>>
  balance?: string
  balanceSymbol?: string
  usdValue?: string
  onTokenClick: () => void
  onReset?: () => void
  showPercentageButtons?: boolean
  onPercentageClick?: (percentage: number) => void
  balanceError?: boolean
}

export function TokenInput({
  label,
  amount,
  onAmountChange,
  currency,
  tokenLists,
  balance,
  balanceSymbol,
  usdValue,
  onTokenClick,
  onReset,
  showPercentageButtons,
  onPercentageClick,
  balanceError,
}: TokenInputProps) {
  const token = currency?.address as Address | undefined
  const chainId = currency?.chainId
  const tokenInfo = token && chainId ? tokenLists?.[chainId]?.[token.toLowerCase()] : undefined

  return (
    <div className="rounded-2xl bg-base-200 p-4 shadow border border-base-300 relative group">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="text-sm opacity-70">{label}</div>
          {onReset && (
            <button type="button" className="btn btn-xs btn-ghost" onClick={onReset} title="Reset form">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                />
              </svg>
            </button>
          )}
        </div>
        {showPercentageButtons && onPercentageClick && (
          <div className="absolute right-4 top-2 opacity-0 group-hover:opacity-100 transition-opacity z-10">
            <div className="join">
              {[25, 50, 75, 100].map((p) => (
                <button key={p} className="btn btn-xs join-item" onClick={() => onPercentageClick(p)}>
                  {p === 100 ? 'Max' : `${p}%`}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
      <div className="flex items-center gap-3 mt-1">
        <input
          className="input input-ghost text-4xl font-semibold flex-1 text-left border-0 focus:outline-none bg-transparent focus:bg-transparent p-0"
          inputMode="decimal"
          value={amount}
          onChange={(e) => onAmountChange(e.target.value)}
          placeholder="0"
        />
        <div>
          <button className="btn btn-outline rounded-2xl flex items-center gap-2 border-[0.5px]" onClick={onTokenClick}>
            {currency ? (
              <>
                <Logo
                  src={token && chainId ? tokenInfo?.logoURI : undefined}
                  alt={currency.symbol || 'Token'}
                  size={20}
                  fallbackText={currency.symbol?.[0] || 'T'}
                />
                <span>{currency.symbol || 'Token'}</span>
              </>
            ) : (
              <span>Select token</span>
            )}
          </button>
        </div>
      </div>
      <div className="flex items-center justify-between text-xs mt-2">
        <div className="opacity-70">{usdValue ?? '$0'}</div>
        <div className={balanceError ? 'text-error' : 'opacity-70'}>
          {balance ? `${Number(balance).toFixed(4)} ${balanceSymbol || currency?.symbol || ''}` : ''}
        </div>
      </div>
    </div>
  )
}
