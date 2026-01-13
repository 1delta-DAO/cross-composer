import { fetchBridgeTrade, type BridgeInput } from '@1delta/trade-sdk'
import { Bridge, getBridges } from '@1delta/bridge-configs'
import type {
  GenericTrade,
  PreDeltaCall,
  PostDeltaCall,
  RawCurrency,
  TradeType,
} from '@1delta/lib-utils'

type BridgeInputParams = {
  slippage: number
  tradeType: TradeType
  fromCurrency: RawCurrency | undefined
  toCurrency: RawCurrency | undefined
  swapAmount: string | undefined
  caller: string
  receiver: string
  order: 'CHEAPEST' | 'FASTEST'
  message?: string
  usePermit?: boolean
  destinationGasLimit?: bigint
  preCalls?: PreDeltaCall[]
  postCalls?: PostDeltaCall[]
}

export async function fetchAllActionTrades(
  input: BridgeInputParams,
  controller?: AbortController
): Promise<Array<{ action: string; trade: GenericTrade }>> {
  const availableBridges = getBridges()
  const hasPreCalls = Boolean(input.preCalls && input.preCalls.length > 0)
  const hasPostCalls = Boolean(input.postCalls && input.postCalls.length > 0)

  console.debug(
    'Fetching from actions:',
    availableBridges.map((b) => (b.toString ? b.toString() : String(b)))
  )
  if (availableBridges.length === 0) return []

  const results = await Promise.all(
    availableBridges.map(async (bridge: Bridge) => {
      try {
        if ((hasPreCalls || hasPostCalls) && bridge !== Bridge.ACROSS && bridge !== Bridge.AXELAR) {
          return undefined
        }

        let bridgeInput: BridgeInput

        if (bridge === Bridge.ACROSS) {
          const acrossInput: {
            slippage: number
            tradeType: TradeType
            fromCurrency: RawCurrency | undefined
            toCurrency: RawCurrency | undefined
            swapAmount: string | undefined
            caller: string
            receiver: string
            order: 'CHEAPEST' | 'FASTEST'
            message?: string
            usePermit?: boolean
            destinationGasLimit?: bigint
            preCalls?: PreDeltaCall[]
            postCalls?: PostDeltaCall[]
          } = {
            slippage: input.slippage,
            tradeType: input.tradeType,
            fromCurrency: input.fromCurrency,
            toCurrency: input.toCurrency,
            swapAmount: input.swapAmount,
            caller: input.caller,
            receiver: input.receiver,
            order: input.order,
            message: input.message,
            usePermit: input.usePermit,
            destinationGasLimit: input.destinationGasLimit,
          }
          if (input.preCalls !== undefined) acrossInput.preCalls = input.preCalls
          if (input.postCalls !== undefined) acrossInput.postCalls = input.postCalls

          bridgeInput = {
            bridge: Bridge.ACROSS,
            input: acrossInput,
          }
        } else if (bridge === Bridge.AXELAR) {
          const axelarInput: {
            slippage: number
            tradeType: TradeType
            fromCurrency: RawCurrency | undefined
            toCurrency: RawCurrency | undefined
            swapAmount: string | undefined
            caller: string
            receiver: string
            order: 'CHEAPEST' | 'FASTEST'
            message?: string
            usePermit?: boolean
            destinationGasLimit?: bigint
            payFeeWithNative?: boolean
            preCalls?: PreDeltaCall[]
            postCalls?: { calls: PostDeltaCall[]; gasLimit?: bigint }
          } = {
            slippage: input.slippage,
            tradeType: input.tradeType,
            fromCurrency: input.fromCurrency,
            toCurrency: input.toCurrency,
            swapAmount: input.swapAmount,
            caller: input.caller,
            receiver: input.receiver,
            order: input.order,
            message: input.message,
            usePermit: input.usePermit,
            destinationGasLimit: input.destinationGasLimit,
            payFeeWithNative: true,
          }
          if (input.preCalls !== undefined) axelarInput.preCalls = input.preCalls
          if (input.postCalls !== undefined) {
            axelarInput.postCalls = {
              calls: input.postCalls,
              gasLimit: input.destinationGasLimit,
            }
          }

          bridgeInput = {
            bridge: Bridge.AXELAR,
            input: axelarInput,
          }
        } else {
          bridgeInput = {
            bridge: bridge as Exclude<Bridge, Bridge.AXELAR | Bridge.ACROSS | Bridge.Zenlink>,
            input: {
              slippage: input.slippage,
              tradeType: input.tradeType,
              fromCurrency: input.fromCurrency,
              toCurrency: input.toCurrency,
              swapAmount: input.swapAmount,
              caller: input.caller,
              receiver: input.receiver,
              order: input.order,
              message: input.message,
              usePermit: input.usePermit,
              destinationGasLimit: input.destinationGasLimit,
            },
          } as BridgeInput
        }

        const trade = await fetchBridgeTrade(bridgeInput, controller || new AbortController())

        if (trade) return { action: bridge.toString(), trade }
      } catch (error) {
        console.debug(`Error fetching trade from ${bridge}:`, {
          bridge,
          error,
          input,
        })
      }
      return undefined
    })
  )

  const trades = (results.filter(Boolean) as Array<{ action: string; trade: GenericTrade }>).filter(
    ({ trade }) => {
      const hasAssemble = typeof (trade as any)?.assemble === 'function'
      const tx = (trade as any)?.transaction
      const hasTx =
        Boolean(tx) && Boolean((tx as any).to) && Boolean((tx as any).calldata ?? (tx as any).data)
      return hasAssemble || hasTx
    }
  )

  return trades.sort((a, b) => b.trade.outputAmountRealized - a.trade.outputAmountRealized)
}
