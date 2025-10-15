import { getDefaultConfig } from "@rainbow-me/rainbowkit"
import { moonbeam } from "wagmi/chains"

export const config = getDefaultConfig({
    appName: "Moonbeamer",
    projectId: process.env.NEXT_PUBLIC_WALLET_CONNECT_PROJECT_ID ?? "id",
    chains: [moonbeam],
    ssr: true,
})
