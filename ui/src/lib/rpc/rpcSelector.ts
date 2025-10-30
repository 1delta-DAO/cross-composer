import { createPublicClient, http, webSocket, PublicClient, HttpTransport, WebSocketTransport, fallback } from "viem"

import { cleanupExpiredCache, rpcPerformanceCache } from "./cache"
import { RpcPerformance } from "./config"
import { RPC_OVERRIDE_CHAINS } from "./rpcOverrides"
import { batchTestRpcs, calculateBlacklistUntil } from "./rpcTester"

let ongoingRpcTests: Record<string, Promise<string[]>> = {}

// clean up storage cache on initialization (browser only)
if (typeof window !== "undefined") {
    try {
        cleanupExpiredCache()
    } catch {}
}

/**
 * Get the best performing RPCs for a chain
 */
async function getBestRpcs(chainId: string): Promise<string[]> {
    const config = RPC_OVERRIDE_CHAINS[String(chainId)]
    if (!config) {
        throw new Error(`No smart RPC config for chain ${chainId}`)
    }

    const now = Date.now()
    const cached = rpcPerformanceCache.get(chainId)

    // check cache first
    if (cached && cached.length > 0) {
        const oldestTest = Math.min(...cached.map((r) => r.lastTested))
        const cacheAge = now - oldestTest

        if (cacheAge < config.retestIntervalMs) {
            // filter out blacklisted RPCs
            const availableRpcs = cached.filter((r) => {
                if (r.blacklistedUntil && now < r.blacklistedUntil) {
                    return false // still blacklisted
                }
                return r.success
            })

            const bestRpcs = availableRpcs
                .sort((a, b) => a.latency - b.latency)
                .slice(0, config.maxSelectedRpcs)
                .map((r) => r.url)

            if (bestRpcs.length >= config.minRequiredRpcs) {
                return bestRpcs
            }
        }
    }

    const existing = ongoingRpcTests[chainId]
    if (existing) return existing

    const p = (async () => {
        const testResults = await batchTestRpcs(config.rpcs, chainId, config.maxConcurrentTests, config.testTimeoutMs)

        const performanceData: RpcPerformance[] = testResults.map((result) => {
            const blacklistedUntil = result.success ? undefined : calculateBlacklistUntil(result.errorType, now)

            return {
                url: result.url,
                latency: result.latency,
                success: result.success,
                lastTested: now,
                errorType: result.errorType,
                blacklistedUntil,
            }
        })

        rpcPerformanceCache.set(chainId, performanceData)

        const availableRpcs = testResults.filter((r) => {
            if (!r.success) {
                const blacklistedUntil = calculateBlacklistUntil(r.errorType, now)

                if (blacklistedUntil) {
                    console.debug("[rpcSelector]\n", {
                        reason: "blacklisted",
                        chainId,
                        rpcUrl: r.url,
                        blacklistedUntil: new Date(blacklistedUntil).toISOString(),
                    })
                    return false
                }
            }
            return r.success
        })

        const successfulRpcs = availableRpcs.sort((a, b) => a.latency - b.latency)

        if (successfulRpcs.length < config.minRequiredRpcs) {
            const allSuccessful = testResults
                .filter((r) => r.success)
                .sort((a, b) => a.latency - b.latency)
                .map((r) => r.url)

            console.debug("[rpcSelector]\n", {
                reason: "not enough successful RPCs",
                chainId,
                successfulRpcs: successfulRpcs.length,
                allSuccessful: allSuccessful.join(", "),
            })
            return allSuccessful
        }

        const best = successfulRpcs.slice(0, config.maxSelectedRpcs).map((r) => r.url)

        return best
    })()

    ongoingRpcTests[chainId] = p
    try {
        return await p
    } finally {
        delete ongoingRpcTests[chainId]
    }
}

export function shouldUseRpcOverrider(chainId: string): boolean {
    return String(chainId) in RPC_OVERRIDE_CHAINS
}

/**
 * Get optimized EVM client for chains with RPC issues
 */
export async function getOptimizedEvmClient(chainId: string): Promise<PublicClient | undefined> {
    if (!shouldUseRpcOverrider(chainId)) {
        return undefined
    }

    const bestRpcs = await getBestRpcs(chainId)

    if (bestRpcs.length === 0) {
        throw new Error(`No working RPCs found for chain ${chainId}`)
    }

    const transports = bestRpcs.filter((url) => !!url).map((url) => (url.startsWith("http") ? http(url) : webSocket(url))) as (
        | HttpTransport
        | WebSocketTransport
    )[]
    return createPublicClient({
        chain: RPC_OVERRIDE_CHAINS[chainId]?.chain,
        transport: transports[0],
    })
}

export function clearRpcCache(chainId?: string) {
    if (chainId) {
        rpcPerformanceCache.delete(chainId)
        delete ongoingRpcTests[chainId]
    } else {
        rpcPerformanceCache.clear()
        ongoingRpcTests = {}
    }
}

export function clearBlacklist(chainId: string, rpcUrl?: string) {
    const stats = rpcPerformanceCache.get(chainId)
    if (!stats) return

    if (rpcUrl) {
        // Clear blacklist for specific RPC
        const rpc = stats.find((r) => r.url === rpcUrl)
        if (rpc) {
            rpc.blacklistedUntil = undefined
            rpc.errorType = undefined
        }
    } else {
        // Clear blacklist for all RPCs in the chain
        stats.forEach((rpc) => {
            rpc.blacklistedUntil = undefined
            rpc.errorType = undefined
        })
    }

    rpcPerformanceCache.set(chainId, stats)
}

export async function refreshRpcTesting(chainId: string): Promise<string[]> {
    clearRpcCache(chainId)
    return await getBestRpcs(chainId)
}
