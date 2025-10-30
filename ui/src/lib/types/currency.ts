import { Address } from "viem"

/**
 * Raw currency data structure matching frontend pattern
 * This represents a token/currency from the asset lists
 */
export interface RawCurrency {
    address: Address
    symbol: string
    name: string
    decimals: number
    logoURI?: string
    chainId?: number
}

/**
 * Currency with additional metadata that may be added by the app
 */
export interface Currency extends RawCurrency {
    balance?: bigint
    price?: number
}

