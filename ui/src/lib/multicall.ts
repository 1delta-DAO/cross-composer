import { type Address, type PublicClient } from "viem"
import { ERC20_ABI } from "./abi"

export type BalancesRecord = Record<string, { raw: string; decimals?: number }>

export async function fetchErc20BalancesMulticall(
    publicClient: PublicClient,
    userAddress: Address,
    tokenAddresses: Address[]
): Promise<BalancesRecord> {
    if (tokenAddresses.length === 0) return {}

    const balanceCalls = tokenAddresses.map((address) => ({
        address,
        abi: ERC20_ABI,
        functionName: "balanceOf" as const,
        args: [userAddress] as const,
    }))
    const decimalsCalls = tokenAddresses.map((address) => ({
        address,
        abi: ERC20_ABI,
        functionName: "decimals" as const,
        args: [] as const,
    }))

    const [balancesRes, decimalsRes] = await Promise.all([
        publicClient.multicall({ contracts: balanceCalls, allowFailure: true }),
        publicClient.multicall({ contracts: decimalsCalls, allowFailure: true }),
    ])

    const out: BalancesRecord = {}
    for (let i = 0; i < tokenAddresses.length; i++) {
        const token = tokenAddresses[i]
        const bal = balancesRes[i]
        const dec = decimalsRes[i]
        const raw = bal?.status === "success" ? (bal.result as bigint).toString() : "0"
        const decimals = dec?.status === "success" ? Number(dec.result) : undefined
        out[token.toLowerCase()] = { raw, decimals }
    }
    return out
}


