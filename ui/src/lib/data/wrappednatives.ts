export function getWNative(chainId: string) {
    return WRAPPED_NATIVE_INFO[chainId as keyof typeof WRAPPED_NATIVE_INFO] ?? undefined
}

export const WRAPPED_NATIVE_INFO = {
    "1": {
        chainId: "1",
        name: "Wrapped Ether",
        symbol: "WETH",
        address: "0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2",
        decimals: 18,
    },
    "10": {
        chainId: "10",
        name: "Wrapped Ether",
        symbol: "WETH",
        address: "0x4200000000000000000000000000000000000006",
        decimals: 18,
    },
    "1284": {
        chainId: "1284",
        name: "Wrapped Glimmer",
        symbol: "WGLMR",
        address: "0xacc15dc74880c9944775448304b263d191c6077f",
        decimals: 18,
    },
    "1285": {
        chainId: "1285",
        name: "Wrapped MOVR",
        symbol: "WMOVR",
        address: "0x98878b06940ae243284ca214f92bb71a2b032b8a",
        decimals: 18,
    },
    "137": {
        chainId: "137",
        name: "Wrapped POL",
        symbol: "WPOL",
        address: "0x0d500b1d8e8ef31e21c99d1db9a6444d3adf1270",
        decimals: 18,
    },
    "42161": {
        chainId: "42161",
        name: "Wrapped Ether",
        symbol: "WETH",
        address: "0x82af49447d8a07e3bd95bd0d56f35241523fbab1",
        decimals: 18,
    },
    "43114": {
        chainId: "43114",
        name: "Wrapped AVAX",
        symbol: "WAVAX",
        address: "0xb31f66aa3c1e785363f0875a1b74e27b85fd66c7",
        decimals: 18,
    },
    "8453": {
        chainId: "8453",
        name: "Wrapped Ether",
        symbol: "WETH",
        address: "0x4200000000000000000000000000000000000006",
        decimals: 18,
    },
    "5000": {
        chainId: "5000",
        name: "Wrapped Mantle",
        symbol: "WMNT",
        address: "0x78c1b0c915c4faa5fffa6cabf0219da63d7f4cb8",
        decimals: 18,
    },

    "56": {
        chainId: "56",
        name: "Wrapped BNB",
        symbol: "WBNB",
        address: "0xbb4cdb9cbd36b01bd1cbaebf2de08d9173bc095c",
        decimals: 18,
    },
    "9745": {
        chainId: "9745",
        name: "Wrapped XPL",
        symbol: "WXPL",
        address: "0x6100e367285b01f48d07953803a2d8dca5d19873",
        decimals: 18,
    },
}
