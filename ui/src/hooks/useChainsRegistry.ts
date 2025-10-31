import { useMemo } from "react"
import { CHAIN_DATA } from "../lib/data/chainData"

export type ExplorerInfo = {
    name?: string
    url: string
    standard?: string
    icon?: string
}

export type ChainInfo = {
    name: string
    chain: string
    icon?: string
    rpc?: string[]
    faucets?: string[]
    nativeCurrency: { name: string; symbol: string; decimals: number }
    infoURL?: string
    shortName?: string
    chainId: number | string
    networkId?: number | string
    explorers?: ExplorerInfo[]
    enum?: string
    key?: string
}

export type ChainsRegistryRecord = Record<
    string,
    {
        data: ChainInfo
        explorers: Record<string, ExplorerInfo>
    }
>

function normalizeChainsRegistry(): ChainsRegistryRecord {
    const normalized: ChainsRegistryRecord = {}
    for (const [chainId, chain] of Object.entries(CHAIN_DATA)) {
        const explorersArray = chain.explorers ?? []
        const explorers: Record<string, ExplorerInfo> = {}
        for (const exp of explorersArray) {
            const key = exp?.name || exp?.url || "explorer"
            explorers[key] = { ...exp }
        }
        normalized[chainId] = {
            data: chain as ChainInfo,
            explorers,
        }
    }
    return normalized
}

const chainsRegistryCache = normalizeChainsRegistry()

export function useChainsRegistry() {
    return useMemo(
        () => ({
            data: chainsRegistryCache,
            isLoading: false,
            error: null,
        }),
        []
    )
}
