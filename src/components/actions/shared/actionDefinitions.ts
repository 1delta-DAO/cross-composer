import type { ComponentType } from "react"
import type { DestinationActionType } from "../../../lib/types/destinationAction"
import type { RawCurrency } from "../../../types/currency"
import type { GenericTrade } from "@1delta/lib-utils"
import { getRegisteredActions } from "./actionRegistry"
import type { DestinationActionHandler } from "./types"

export type ActionType = string
export type ActionCategory = "all" | "defi" | "lending" | "gaming" | "yield"

type TokenListsMeta = Record<string, Record<string, { symbol?: string; decimals: number; address: string; chainId: string }>>

export interface ActionLoaderContext {
  srcCurrency?: RawCurrency
  dstCurrency?: RawCurrency
  tokenLists?: TokenListsMeta
  chainId?: string
}

export interface ActionPanelContext {
  tokenLists?: TokenListsMeta
  setDestinationInfo?: DestinationActionHandler
  srcCurrency?: RawCurrency
  dstCurrency?: RawCurrency
  slippage?: number
  chainId?: string
  actionData?: any
  marketsReady?: boolean
  quotes?: Array<{ label: string; trade: GenericTrade }>
  selectedQuoteIndex?: number
  setSelectedQuoteIndex?: (index: number) => void
}

export interface ActionReadinessContext {
  marketsReady: boolean
  marketsLoading: boolean
  srcCurrency?: RawCurrency
}

export type DataLoader = (context: ActionLoaderContext) => Promise<any>
export type PanelPropsBuilder = (context: ActionPanelContext) => Record<string, any>
export type ReadinessChecker = (context: ActionReadinessContext) => boolean

export interface ActionDefinition {
  id: ActionType
  label: string
  category: ActionCategory
  icon: ComponentType<{ className?: string }>
  panel: ComponentType<any>
  priority: number
  actionType: DestinationActionType
  requiresSrcCurrency?: boolean
  requiresMarkets?: boolean
  dataLoader?: DataLoader
  buildPanelProps?: PanelPropsBuilder
  isReady?: ReadinessChecker
}

export { getRegisteredActions }

export const CATEGORIES: { id: ActionCategory; label: string }[] = [
  { id: "all", label: "All" },
  { id: "defi", label: "DeFi" },
  { id: "lending", label: "Lending" },
  { id: "gaming", label: "Gaming" },
  { id: "yield", label: "Yield" },
]

// Get actions filtered by category
export function getActionsByCategory(category: ActionCategory, srcCurrency?: RawCurrency): ActionDefinition[] {
  const actions = getRegisteredActions()
  if (category === "all") {
    return actions.filter((action) => !action.requiresSrcCurrency || srcCurrency)
  }
  return actions.filter((action) => action.category === category && (!action.requiresSrcCurrency || srcCurrency))
}

// Get priority actions for collapsed view (top 3 by priority)
export function getPriorityActions(srcCurrency?: RawCurrency): ActionDefinition[] {
  return getRegisteredActions()
    .filter((action) => !action.requiresSrcCurrency || srcCurrency)
    .sort((a, b) => a.priority - b.priority)
    .slice(0, 3)
}

// Get remaining actions count for collapsed view
export function getRemainingActionsCount(priorityActions: ActionDefinition[], srcCurrency?: RawCurrency): number {
  const allAvailable = getRegisteredActions().filter((action) => !action.requiresSrcCurrency || srcCurrency)
  return Math.max(0, allAvailable.length - priorityActions.length)
}
