import type { Address, Hex } from 'viem'

export interface ApprovalInfo {
  token: Address
  spender: Address
  requiredAmount: bigint
  needsApproval: boolean
  approvalTransaction?: {
    to: Address
    data: Hex
    value?: bigint
  }
}
