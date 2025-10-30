import { type Address, type PublicClient } from "viem"
import { ERC20_ABI } from "./abi"

/**
 * Fetch ERC20 token balance for a user
 */
export async function fetchTokenBalance(
    publicClient: PublicClient,
    tokenAddress: Address,
    userAddress: Address
): Promise<bigint> {
    try {
        const balance = await publicClient.readContract({
            address: tokenAddress,
            abi: ERC20_ABI,
            functionName: "balanceOf",
            args: [userAddress],
        })
        return balance as bigint
    } catch (error) {
        console.error(`Error fetching balance for token ${tokenAddress}:`, error)
        return 0n
    }
}

/**
 * Fetch native token balance for a user
 */
export async function fetchNativeBalance(publicClient: PublicClient, userAddress: Address): Promise<bigint> {
    try {
        return await publicClient.getBalance({ address: userAddress })
    } catch (error) {
        console.error(`Error fetching native balance for ${userAddress}:`, error)
        return 0n
    }
}

