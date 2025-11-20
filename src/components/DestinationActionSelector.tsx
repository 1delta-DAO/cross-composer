import { useMemo, useState, useEffect } from "react"
import { DestinationActionConfig, DestinationActionType } from "../lib/types/destinationAction"
import { Hex } from "viem"
import { getAllActions, getActionsByGroup } from "../lib/actions/registry"
import { isMarketsLoading, isMarketsReady, subscribeToCacheChanges } from "../lib/moonwell/marketCache"
import type { RawCurrency, RawCurrencyAmount } from "../types/currency"
import { LendingSubPanel } from "./LendingSubPanel"
import { LendingActionModal } from "./LendingActionModal"
import { OlderfallPanel } from "./actions/nft/olderfall/OlderfallPanel"
import { DepositPanel } from "./actions/lending/deposit/DepositPanel"

interface DestinationActionSelectorProps {
  onAdd?: (config: DestinationActionConfig, functionSelector: Hex, args?: any[], value?: string) => void
  dstCurrency?: RawCurrency
  userAddress?: string
  tokenLists?: Record<string, Record<string, { symbol?: string; decimals?: number }>> | undefined
  setDestinationInfo?: (amount: RawCurrencyAmount | undefined) => void
}

export default function DestinationActionSelector({
  onAdd,
  dstCurrency,
  userAddress,
  tokenLists,
  setDestinationInfo,
}: DestinationActionSelectorProps) {
  const [selectedActionType, setSelectedActionType] = useState<DestinationActionType | "">("")
  const [selectedActionKey, setSelectedActionKey] = useState<string>("")
  const [marketsReady, setMarketsReady] = useState(isMarketsReady())
  const [marketsLoading, setMarketsLoading] = useState(isMarketsLoading())
  const [modalAction, setModalAction] = useState<{ config: DestinationActionConfig; selector: Hex } | null>(null)

  const dstToken = useMemo(() => dstCurrency?.address as string | undefined, [dstCurrency])
  const dstChainId = useMemo(() => dstCurrency?.chainId, [dstCurrency])

  // Subscribe to market cache changes
  useEffect(() => {
    setMarketsReady(isMarketsReady())
    setMarketsLoading(isMarketsLoading())

    const unsubscribe = subscribeToCacheChanges(() => {
      setMarketsReady(isMarketsReady())
      setMarketsLoading(isMarketsLoading())
    })

    return unsubscribe
  }, [])

  const allActions = useMemo(() => getAllActions({ dstToken, dstChainId }), [dstToken, dstChainId, marketsReady])

  const lendingActions = useMemo(() => allActions.filter((a) => a.actionType === "lending"), [allActions])
  const nonLendingActions = useMemo(() => allActions.filter((a) => a.actionType !== "lending" && a.group !== "olderfall_nft"), [allActions])

  const hasLending = lendingActions.length > 0

  const actionsByType = useMemo(() => {
    if (!selectedActionType) {
      // Deduplicate by address-name combination
      const seen = new Set<string>()
      return nonLendingActions.filter((a) => {
        const key = `${a.address.toLowerCase()}-${a.name}`
        if (seen.has(key)) return false
        seen.add(key)
        return true
      })
    }
    return getActionsByGroup(selectedActionType, { dstToken, dstChainId }).filter((a) => a.actionType !== "lending" && a.group !== "olderfall_nft")
  }, [nonLendingActions, selectedActionType, dstToken, dstChainId])

  const handleSelectAction = (val: string) => {
    setSelectedActionKey(val)
  }

  if (marketsLoading && !marketsReady) {
    return (
      <div className="alert alert-info">
        <span className="loading loading-spinner loading-sm"></span>
        <span>Loading ...</span>
      </div>
    )
  }

  const showLendingPanel = hasLending
  const showOlderfallPanel = Boolean(onAdd) // OlderfallPanel decides internally if it has actions

  if (nonLendingActions.length === 0 && !showLendingPanel && !showOlderfallPanel) {
    return (
      <div className="alert alert-info">
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        <span>No destination actions configured yet. Actions can be added via configuration files.</span>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <DepositPanel
        userAddress={userAddress}
        chainId={dstChainId}
        onAdd={(config, selector, args, value) => {
          if (onAdd) {
            onAdd(config, selector, args, value)
          }
        }}
        setDestinationInfo={setDestinationInfo}
      />
      {showLendingPanel && (
        <LendingSubPanel
          dstToken={dstToken}
          userAddress={userAddress}
          chainId={dstChainId}
          onAdd={(config, selector, args, value) => {
            onAdd?.(config, selector, args, value)
          }}
        />
      )}

      {/* Olderfall is now fully self-contained */}
      <OlderfallPanel dstToken={dstToken} dstChainId={dstChainId} userAddress={userAddress} tokenLists={tokenLists} onAdd={onAdd} />

      {nonLendingActions.length > 0 && (
        <div className="form-control">
          <div className="flex items-center gap-2">
            <select
              value={selectedActionType}
              onChange={(e) => {
                setSelectedActionType(e.target.value as DestinationActionType | "")
                setSelectedActionKey("")
              }}
              className="select select-bordered flex-1"
            >
              <option value="">All Types</option>
              <option value="game_token">Game Token</option>
              <option value="buy_ticket">Buy Ticket</option>
              <option value="custom">Custom</option>
            </select>
            <select value={selectedActionKey} onChange={(e) => handleSelectAction(e.target.value)} className="select select-bordered flex-1">
              <option value="">Choose an action...</option>
              {actionsByType.flatMap((action) => {
                const selectors = action.defaultFunctionSelector
                  ? [action.defaultFunctionSelector, ...action.functionSelectors]
                  : action.functionSelectors
                const uniq = Array.from(new Set(selectors.map((s) => s.toLowerCase())))
                return uniq.map((selector) => {
                  const key = `${action.address.toLowerCase()}|${selector}`
                  return (
                    <option key={key} value={key}>
                      {action.name}
                    </option>
                  )
                })
              })}
            </select>
            <button
              className="btn btn-primary"
              disabled={!selectedActionKey}
              onClick={() => {
                if (!selectedActionKey) return
                const [addr, selector] = selectedActionKey.split("|")
                const action = actionsByType.find((a) => a.address.toLowerCase() === addr)
                if (!action || !selector) return
                setModalAction({ config: action, selector: selector as Hex })
                setSelectedActionKey("")
              }}
            >
              Add
            </button>
          </div>
        </div>
      )}

      {modalAction && (
        <LendingActionModal
          open={modalAction !== null}
          onClose={() => setModalAction(null)}
          actionConfig={modalAction.config}
          selector={modalAction.selector}
          userAddress={userAddress as any}
          chainId={dstChainId}
          onConfirm={(config, selector, args, value) => {
            onAdd?.(config, selector, args, value)
            setModalAction(null)
          }}
        />
      )}
    </div>
  )
}
