import { checksumAddress, type Address } from "viem"
import { ERC20_ABI } from "../lib/abi"
import { getPublicClient } from "../lib/clients"

export async function checkIsContract(address: Address): Promise<boolean> {
    try {
        const publicClient = getPublicClient()
        const code = await publicClient.getCode({ address })
        return code !== "0x"
    } catch {
        return false
    }
}

export async function fetchDecimals(
    tokenAddress: Address,
    decimalsCache: Record<Address, number>,
    loadingDecimals: Set<Address>,
    setDecimalsCache: (updater: (prev: Record<Address, number>) => Record<Address, number>) => void,
    setLoadingDecimals: (updater: (prev: Set<Address>) => Set<Address>) => void
): Promise<number | null> {
    if (decimalsCache[tokenAddress]) {
        return decimalsCache[tokenAddress]
    }

    if (loadingDecimals.has(tokenAddress)) {
        return null
    }

    try {
        setLoadingDecimals((prev) => new Set(prev).add(tokenAddress))

        const isContract = await checkIsContract(tokenAddress)
        if (!isContract) {
            console.warn(`Address ${tokenAddress} is not a contract`)
            return null
        }

        const publicClient = getPublicClient()

        const decimals = await publicClient.readContract({
            address: checksumAddress(tokenAddress),
            abi: ERC20_ABI,
            functionName: "decimals",
        })

        const decimalsNumber = Number(decimals)
        setDecimalsCache((prev) => ({
            ...prev,
            [tokenAddress]: decimalsNumber,
        }))

        return decimalsNumber
    } catch (err) {
        console.error(`Failed to fetch decimals for token ${tokenAddress}:`, err)
        return null
    } finally {
        setLoadingDecimals((prev) => {
            const newSet = new Set(prev)
            newSet.delete(tokenAddress)
            return newSet
        })
    }
}
