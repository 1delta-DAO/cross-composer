import { Address, Hex, Abi } from 'viem'
import type { RawCurrency, RawCurrencyAmount } from '../../types/currency'
import type { DeltaCall } from '@1delta/lib-utils'

export type ActionType = 'game_token' | 'buy_ticket' | 'lending' | 'staking'

export interface ActionMeta {
  underlying?: RawCurrency
  minDstAmount?: RawCurrencyAmount
  usePermitPrecompile?: boolean
  preApproveFromUnderlying?: boolean
  preApproveAmountArgIndex?: number
  enterMarketBefore?: boolean
  useComposer?: boolean
  stakedToken?: RawCurrency
  composerAddress?: Address
  callForwarderAddress?: Address
  supportedChainIds?: string[]
  [key: string]: unknown
}

export interface Action {
  address: Address
  functionSelectors: Hex[]
  abi: Abi
  actionType: ActionType
  group?: string
  meta?: ActionMeta
  name: string
  description: string
  icon?: string
  defaultFunctionSelector?: Hex
}

export interface EncodedAction {
  target: Address
  calldata: Hex
  value?: bigint
  callType?: number
  balanceOfInjectIndex?: number
  tokenAddress?: Address
}

export interface ActionBuildContext {
  userAddress: Address
  dstChainId?: string
  selector: Hex
  args: unknown[]
  value?: bigint
}

export interface ActionConfig extends Action {
  defaultParams?: Record<string, unknown>
  buildCalls?: (ctx: ActionBuildContext) => Promise<DeltaCall[]>
}

export type ActionCall = DeltaCall & {
  gasLimit?: bigint
}
