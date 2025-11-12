import { useMemo, useState, useEffect } from "react"
import { DestinationActionConfig, DestinationActionType } from "../lib/types/destinationAction"
import { Hex } from "viem"
import { getAllActions, getActionsByGroup } from "../lib/actions/registry"
import { isMarketsLoading, isMarketsReady, subscribeToCacheChanges } from "../lib/moonwell/marketCache"
import { SupportedChainId } from "@1delta/lib-utils"

interface DestinationActionSelectorProps {
    onAdd?: (config: DestinationActionConfig, functionSelector: Hex) => void
    dstToken?: string
    dstChainId?: string
}

export default function DestinationActionSelector({ onAdd, dstToken, dstChainId }: DestinationActionSelectorProps) {
    const [selectedActionType, setSelectedActionType] = useState<DestinationActionType | "">("")
    const [selectedActionKey, setSelectedActionKey] = useState<string>("")
    const [marketsReady, setMarketsReady] = useState(isMarketsReady())
    const [marketsLoading, setMarketsLoading] = useState(isMarketsLoading())

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

    const actionsByType = useMemo(() => {
        if (!selectedActionType) {
            // Deduplicate by address-name combination
            const seen = new Set<string>()
            return allActions.filter((a) => {
                const key = `${a.address.toLowerCase()}-${a.name}`
                if (seen.has(key)) return false
                seen.add(key)
                return true
            })
        }
        return getActionsByGroup(selectedActionType, { dstToken, dstChainId })
    }, [allActions, selectedActionType, dstToken, dstChainId])

    const handleSelectAction = (val: string) => {
        setSelectedActionKey(val)
    }

    if (dstChainId === SupportedChainId.MOONBEAM && marketsLoading && !marketsReady) {
        return (
            <div className="alert alert-info">
                <span className="loading loading-spinner loading-sm"></span>
                <span>Loading ...</span>
            </div>
        )
    }

    if (allActions.length === 0) {
        if (dstChainId === SupportedChainId.MOONBEAM && !marketsReady) {
            return (
                <div className="alert alert-warning">
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                        />
                    </svg>
                    <span>Moonwell markets are not available yet. Please wait for markets to load.</span>
                </div>
            )
        }
        return (
            <div className="alert alert-info">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                    />
                </svg>
                <span>No destination actions configured yet. Actions can be added via configuration files.</span>
            </div>
        )
    }

    return (
        <div className="space-y-4">
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
                        <option value="lending">Lending</option>
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
                            if (onAdd) onAdd(action, selector as Hex)
                        }}
                    >
                        Add
                    </button>
                </div>
            </div>
        </div>
    )
}
