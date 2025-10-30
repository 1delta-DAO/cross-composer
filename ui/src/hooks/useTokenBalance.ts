import { useEffect, useState } from "react"
import { useAccount, usePublicClient } from "wagmi"
import { type Address } from "viem"
import { fetchTokenBalance, fetchNativeBalance } from "../lib/balanceFetcher"

export function useTokenBalance(chainId: number, tokenAddress?: Address) {
    const { address } = useAccount()
    const publicClient = usePublicClient({ chainId })
    const [balance, setBalance] = useState<bigint>(0n)
    const [isLoading, setIsLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)

    useEffect(() => {
        if (!address || !publicClient) {
            setBalance(0n)
            return
        }

        setIsLoading(true)
        setError(null)

        const fetchBalance = async () => {
            try {
                const balanceValue = tokenAddress
                    ? await fetchTokenBalance(publicClient, tokenAddress, address)
                    : await fetchNativeBalance(publicClient, address)
                setBalance(balanceValue)
            } catch (err) {
                setError(err instanceof Error ? err.message : "Failed to fetch balance")
            } finally {
                setIsLoading(false)
            }
        }

        fetchBalance()

        // Refresh balance periodically (every 10 seconds)
        const interval = setInterval(fetchBalance, 10000)

        return () => clearInterval(interval)
    }, [address, publicClient, tokenAddress])

    return { balance, isLoading, error }
}

