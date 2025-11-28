import { ActionConfig, ActionCall } from '../../../lib/types/actionCalls'
import { RawCurrencyAmount } from '../../../types/currency'

/** Parameterize this handler to configure a destination action */
export type DestinationActionHandler = (
  currencyAmount: RawCurrencyAmount | undefined,
  receiverAddress: string | undefined,
  destinationCalls: ActionCall[],
  actionLabel?: string,
  actionId?: string
) => void

export type PendingAction = {
  id: string
  config: ActionConfig
  selector: string
  args: any[]
  value?: string
}

export type DestinationCallBuilder<TParams> = (params: TParams) => Promise<ActionCall[]>
