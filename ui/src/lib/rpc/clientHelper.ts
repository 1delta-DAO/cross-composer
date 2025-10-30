import { createPublicClient, http, type Chain } from "viem"
import { arbitrum, avalanche, base, mainnet, mantle, moonbeam, plasma, polygon } from "wagmi/chains"
import { getOptimizedEvmClient } from "./rpcSelector"
import { ChainEnum } from "../data/chains"

const WAGMI_CHAINS = {
    [ChainEnum.ETHEREUM_MAINNET]: mainnet,
    [ChainEnum.MOONBEAM]: moonbeam,
    [ChainEnum.POLYGON_MAINNET]: polygon,
    [ChainEnum.AVALANCHE_C_CHAIN]: avalanche,
    [ChainEnum.ARBITRUM_ONE]: arbitrum,
    [ChainEnum.BASE]: base,
    [ChainEnum.MANTLE]: mantle,
    [ChainEnum.PLASMA_MAINNET]: plasma,
}

export async function getPublicClientForChain(chainId: string) {
    const optimized = await getOptimizedEvmClient(chainId)
    if (optimized) {
        return optimized
    }

    const chain = WAGMI_CHAINS[chainId as keyof typeof WAGMI_CHAINS]
    if (!chain) {
        console.warn(`No chain configuration found for chainId ${chainId}`)
        return undefined
    }

    const rpcUrl = chain.rpcUrls?.default?.http?.[0]
    if (!rpcUrl) {
        console.warn(`No RPC URL found for chainId ${chainId}`)
        return undefined
    }

    return createPublicClient({
        chain,
        transport: http(rpcUrl),
    })
}
