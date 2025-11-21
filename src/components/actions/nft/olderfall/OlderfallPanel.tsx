// ./actions/nft/olderfall/OlderfallPanel.tsx

import { useEffect, useMemo, useState } from "react"
import type { Hex } from "viem"
import type { DestinationActionConfig } from "../../../../lib/types/destinationAction"
import { getAllActions } from "../../../../lib/actions/registry"
import { useOlderfallListings } from "./hooks/useOlderfallListings"
import { SupportedChainId } from "../../../../sdk/types"
import { DestinationActionHandler } from "../../shared/types"
import { Chain } from "@1delta/chain-registry"
import { OlderfallListingCard } from "./OlderfallCard"
import { buildCurrencyMetaForListing, formatListingPriceLabel } from "./utils"
import { OlderfallEmptyState, OlderfallHeader, OlderfallLoadingState } from "./Generic"

type TokenListsMeta = Record<string, Record<string, { symbol?: string; decimals?: number }>>

interface OlderfallPanelProps {
  userAddress?: string
  tokenLists?: TokenListsMeta
  onAdd?: (config: DestinationActionConfig, selector: Hex, args: any[], value?: string) => void
  setDestinationInfo?: DestinationActionHandler
}

interface OlderfallListingsListProps {
  listings: any[]
  dstChainId?: string | number
  tokenLists?: TokenListsMeta
  selectedOrderId: string
  onSelectOrderId: (orderId: string) => void
}

function OlderfallListingsList({ listings, dstChainId, tokenLists, selectedOrderId, onSelectOrderId }: OlderfallListingsListProps) {
  const tokenChainId = dstChainId || SupportedChainId.MOONBEAM

  return (
    <div className="space-y-2 max-h-64 overflow-y-auto">
      {listings.map((l) => {
        const isSelected = selectedOrderId === l.orderId
        const priceLabel = formatListingPriceLabel(l, tokenChainId, tokenLists)
        const title = l.name || `Armor #${l.tokenId}`

        return (
          <OlderfallListingCard
            key={l.orderId}
            listing={l}
            title={title}
            priceLabel={priceLabel}
            isSelected={isSelected}
            onSelect={() => onSelectOrderId(l.orderId)}
          />
        )
      })}
    </div>
  )
}

/* ---------- Options that parameterize the panel ---------- */

const OLDERFALL_OPTIONS = [
  {
    chainId: Chain.POLYGON_MAINNET,
    token: "0x3c499c542cef5e3811e1192ce70d8cc03d5c3359",
    label: "Polygon",
  },
  {
    chainId: Chain.MOONBEAM,
    token: "0xffffffff7d2b0b761af01ca8e25242976ac0ad7d",
    label: "Moonbeam",
  },
]

/* ---------- Main unified panel with tabs ---------- */

export function OlderfallPanel({ userAddress, tokenLists, onAdd }: OlderfallPanelProps) {
  const [selectedOlderfallOrderId, setSelectedOlderfallOrderId] = useState<string>("")
  const [selectedOptionIndex, setSelectedOptionIndex] = useState(0)

  const selectedOption = OLDERFALL_OPTIONS[selectedOptionIndex]
  const dstToken = selectedOption.token
  const dstChainId = String(selectedOption.chainId)

  // Reset selected listing when switching chain
  useEffect(() => {
    setSelectedOlderfallOrderId("")
  }, [selectedOptionIndex])

  // Get Olderfall actions for the currently selected option
  const allActions = useMemo(() => getAllActions({ dstToken, dstChainId }), [dstToken, dstChainId])

  const olderfallActions = useMemo(() => allActions.filter((a) => a.group === "olderfall_nft"), [allActions])

  const hasOlderfall = olderfallActions.length > 0

  const { listings: olderfallListings, loading: olderfallLoading } = useOlderfallListings(hasOlderfall, dstChainId)

  // If no actions for this option, don't render anything at all
  if (!hasOlderfall) {
    return null
  }

  const handleAddClick = () => {
    if (!selectedOlderfallOrderId || !userAddress) return

    // Pick the first Olderfall config (they all share the same group)
    const cfg = olderfallActions.find((a) => a.group === "olderfall_nft") ?? olderfallActions[0]
    const listing = olderfallListings.find((l) => l.orderId === selectedOlderfallOrderId)

    if (!cfg || !listing) return

    const selector = (cfg.defaultFunctionSelector as Hex) || (cfg.functionSelectors[0] as Hex) || ("0x" as Hex)

    const args: any[] = [
      BigInt(selectedOlderfallOrderId),
      1n,
      userAddress,
      [],
      [],
      BigInt(listing.tokenId),
      listing.currency,
      listing.pricePerToken,
      listing.tokenContract,
    ]

    const { minDstAmount } = buildCurrencyMetaForListing(listing, dstChainId, tokenLists)

    const cfgWithMeta: DestinationActionConfig = {
      ...cfg,
      meta: {
        ...(cfg.meta || {}),
        sequenceCurrency: listing.currency,
        sequencePricePerToken: listing.pricePerToken,
        sequenceTokenId: listing.tokenId,
        sequencePriceDecimals: listing.priceDecimals,
        minDstAmount,
        minDstAmountBufferBps: 30,
      } as any,
    }

    onAdd?.(cfgWithMeta, selector, args, "0")
    setSelectedOlderfallOrderId("")
  }

  return (
    <div className="space-y-3">
      <OlderfallHeader />

      {/* Chain tabs driven by OLDERFALL_OPTIONS */}
      <div className="tabs tabs-boxed text-xs">
        {OLDERFALL_OPTIONS.map((opt, idx) => (
          <button
            key={`${opt.chainId}-${opt.token}`}
            type="button"
            className={`tab ${idx === selectedOptionIndex ? "tab-active" : ""}`}
            onClick={() => setSelectedOptionIndex(idx)}
          >
            {opt.label}
          </button>
        ))}
      </div>

      {olderfallLoading ? (
        <OlderfallLoadingState />
      ) : olderfallListings.length > 0 ? (
        <div className="space-y-2">
          <OlderfallListingsList
            listings={olderfallListings}
            dstChainId={dstChainId}
            tokenLists={tokenLists}
            selectedOrderId={selectedOlderfallOrderId}
            onSelectOrderId={setSelectedOlderfallOrderId}
          />

          <button className="btn btn-primary btn-sm" disabled={!selectedOlderfallOrderId || !userAddress} onClick={handleAddClick}>
            Add
          </button>
        </div>
      ) : (
        <OlderfallEmptyState />
      )}
    </div>
  )
}
