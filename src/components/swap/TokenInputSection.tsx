import { useState, useEffect, useRef } from 'react'
import type { Address } from 'viem'
import { Logo } from '../common/Logo'
import { filterNumeric } from './swapUtils'
import type { RawCurrency, RawCurrencyAmount } from '../../types/currency'
import { CurrencyHandler } from '@1delta/lib-utils/dist/services/currency/currencyUtils'
import { useTokenPrice } from '../../hooks/prices/useTokenPrice'
import { zeroAddress } from 'viem'
import { CurrencyHandler as CurrencyHandlerSDK } from '../../sdk/types'
import { useDebounce } from '../../hooks/useDebounce'

type TokenInputSectionProps = {
  amount: string
  onAmountChange: (value: string) => void
  srcCurrency?: RawCurrency
  srcTokenBalance?: RawCurrencyAmount
  srcBalances?: Record<string, Record<string, { value?: string }>>
  lists?: Record<string, Record<string, any>>
  onTokenClick: () => void
  onReset?: () => void
  onPercentageClick?: (percentage: number) => void
  isEditable?: boolean
  onEditableChange?: (editable: boolean) => void
}

export function TokenInputSection({
  amount,
  onAmountChange,
  srcCurrency,
  srcTokenBalance,
  srcBalances,
  lists,
  onTokenClick,
  onReset,
  onPercentageClick,
  isEditable: isEditableProp,
  onEditableChange,
}: TokenInputSectionProps) {
  const [internalEditable, setInternalEditable] = useState(true)
  const isEditable = isEditableProp !== undefined ? isEditableProp : internalEditable
  const [localAmount, setLocalAmount] = useState(amount)
  const debouncedAmount = useDebounce(localAmount, 500)
  const isUserInputRef = useRef(false)

  useEffect(() => {
    if (!isUserInputRef.current) {
      setLocalAmount(amount)
    }
    isUserInputRef.current = false
  }, [amount])

  useEffect(() => {
    if (debouncedAmount !== amount) {
      onAmountChange(debouncedAmount)
    }
  }, [debouncedAmount, onAmountChange, amount])

  const handleEditableToggle = () => {
    const newValue = !isEditable
    if (onEditableChange) {
      onEditableChange(newValue)
    } else {
      setInternalEditable(newValue)
    }
  }

  const srcToken = srcCurrency?.address as Address | undefined
  const srcChainId = srcCurrency?.chainId

  const balance = srcTokenBalance
    ? CurrencyHandler.toExactNumber(srcTokenBalance).toString()
    : srcToken && srcChainId
      ? srcBalances?.[srcChainId]?.[srcToken.toLowerCase()]?.value
      : undefined

  const srcTokenPriceAddr = srcCurrency
    ? srcCurrency.address.toLowerCase() === zeroAddress.toLowerCase()
      ? (CurrencyHandlerSDK.wrappedAddressFromAddress(srcCurrency.chainId, zeroAddress) as Address | undefined)
      : (srcCurrency.address as Address)
    : undefined

  const { price } = useTokenPrice({
    chainId: srcCurrency?.chainId || '',
    tokenAddress: srcTokenPriceAddr,
    enabled: Boolean(srcCurrency),
  })

  const usd = price && localAmount ? Number(localAmount) * price : undefined

  return (
    <div className="rounded-2xl bg-base-200 p-4 shadow border border-base-300 relative group">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="text-sm opacity-70">Sell</div>
          <button
            type="button"
            className="btn btn-xs btn-ghost"
            onClick={handleEditableToggle}
            title={isEditable ? 'Disable editing (use reverse quote)' : 'Enable editing'}
          >
            {isEditable ? (
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                />
              </svg>
            ) : (
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
                />
              </svg>
            )}
          </button>
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
        {onPercentageClick && isEditable && (
          <div className="absolute right-4 top-2 opacity-0 group-hover:opacity-100 transition-opacity z-10">
            <div className="join">
              {[25, 50, 75, 100].map((p) => (
                <button
                  key={p}
                  className="btn btn-xs join-item"
                  onClick={() => {
                    const n = balance ? Number(balance) : 0
                    const newAmount = n > 0 ? ((n * p) / 100).toString() : ''
                    isUserInputRef.current = true
                    setLocalAmount(newAmount)
                  }}
                >
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
          value={localAmount}
          onChange={(e) => {
            if (isEditable) {
              isUserInputRef.current = true
              setLocalAmount(filterNumeric(e.target.value))
            }
          }}
          readOnly={!isEditable}
          placeholder="0"
          style={{ cursor: isEditable ? 'text' : 'default' }}
        />
        <div>
          <button className="btn btn-outline rounded-2xl flex items-center gap-2 border-[0.5px]" onClick={onTokenClick}>
            {srcCurrency ? (
              <>
                <Logo
                  src={srcToken && srcChainId ? lists?.[srcChainId]?.[srcToken.toLowerCase()]?.logoURI : undefined}
                  alt={srcCurrency.symbol || 'Token'}
                  size={20}
                  fallbackText={srcCurrency.symbol?.[0] || 'T'}
                />
                <span>{srcCurrency.symbol || 'Token'}</span>
              </>
            ) : (
              <span>Select token</span>
            )}
          </button>
        </div>
      </div>
      <div className="flex items-center justify-between text-xs mt-2">
        <div className="opacity-70">{usd !== undefined ? `$${usd.toFixed(2)}` : '$0'}</div>
        <div className={balance && localAmount && Number(localAmount) > Number(balance) ? 'text-error' : 'opacity-70'}>
          {balance ? `${Number(balance).toFixed(4)} ${srcCurrency?.symbol || ''}` : ''}
        </div>
      </div>
    </div>
  )
}
