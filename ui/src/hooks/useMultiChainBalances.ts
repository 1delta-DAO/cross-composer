import { useEffect, useState } from "react"
import { useAccount } from "wagmi"
import { type Address } from "viem"
import { createPublicClient, http } from "viem"
import { getAllChainConfigs } from "../lib/chains"
import { fetchTokenBalance, fetchNativeBalance } from "../lib/balanceFetcher"

interface ChainBalance {
    chainId: string
    nativeBalance: bigint
    tokenBalances: Record<Address, bigint>
}

export function useMultiChainBalances(userAddress?: Address, tokenAddresses?: Address[]) {
    const { address } = useAccount()
    const [balances, setBalances] = useState<Record<string, ChainBalance>>({})
    const [isLoading, setIsLoading] = useState(false)

    useEffect(() => {
        const addr = userAddress || address
        if (!addr || !tokenAddresses || tokenAddresses.length === 0) {
            return
        }

        setIsLoading(true)

        const fetchAllBalances = async () => {
            const chainConfigs = getAllChainConfigs()
            const balanceMap: Record<string, ChainBalance> = {}

            await Promise.all(
                chainConfigs.map(async (config) => {
                    try {
                        const publicClient = createPublicClient({
                            chain: config.chain,
                            transport: http(),
                        })

                        const nativeBalance = await fetchNativeBalance(publicClient, addr)
                        const tokenBalances: Record<Address, bigint> = {}

                        await Promise.all(
                            tokenAddresses.map(async (tokenAddr) => {
                                const balance = await fetchTokenBalance(publicClient, tokenAddr, addr)
                                tokenBalances[tokenAddr] = balance
                            })
                        )

                        balanceMap[config.chain.id.toString()] = {
                            chainId: config.chain.id.toString(),
                            nativeBalance,
                            tokenBalances,
                        }
                    } catch (error) {
                        console.error(`Error fetching balances for chain ${config.chain.id}:`, error)
                    }
                })
            )

            setBalances(balanceMap)
            setIsLoading(false)
        }

        fetchAllBalances()
    }, [userAddress, address, tokenAddresses])

    return { balances, isLoading }
}

