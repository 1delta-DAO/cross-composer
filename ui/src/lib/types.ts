import { Address, Hex } from "viem"

export interface BatchCall {
    target: Address
    value: bigint
    callData: Hex
    gasLimit: bigint
}

export interface PermitBatchParams {
    from: Address
    calls: BatchCall[]
    deadline: bigint
}

export interface PermitBatchResult {
    signature: { v: number; r: Hex; s: Hex } | null
    batchData: Hex
    nonce: bigint
    error: string | null
}

export interface ERC20Operation {
    id: string
    operationType: "erc20"
    type: "approve" | "transfer"
    tokenAddress: Address
    to: Address
    amount: string
    decimals: number
}

export interface ArbitraryCallOperation {
    id: string
    operationType: "arbitrary"
    target: Address
    calldata?: string
    value?: string
}

export type Operation = ERC20Operation | ArbitraryCallOperation

export interface BatchTransactionFormProps {
    onSignatureCreated?: (signature: { v: number; r: Hex; s: Hex }, batchData: Hex, nonce: bigint) => void
    onTransactionExecuted?: (hash: Hex) => void
    variant: "relayer" | "self-transmit"
}
