import { createPublicClient, http } from "viem"
import { moonbeam } from "viem/chains"

export const getRpcUrl = () => {
    return process.env.NEXT_PUBLIC_MOONBEAM_RPC_URL || "https://moonbeam.drpc.org"
}

export const createMoonbeamPublicClient = () => {
    return createPublicClient({
        chain: moonbeam,
        transport: http(getRpcUrl()),
    })
}

let publicClientInstance: ReturnType<typeof createMoonbeamPublicClient> | null = null

export const getPublicClient = () => {
    if (!publicClientInstance) {
        publicClientInstance = createMoonbeamPublicClient()
    }
    return publicClientInstance
}
