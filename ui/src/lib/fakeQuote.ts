import { formatUnits, parseUnits } from "viem"

/**
 * Generate a fake quote for bridge swap
 * Returns output amount (1:1 conversion for now)
 */
export interface FakeQuote {
    inputAmount: bigint
    outputAmount: bigint
    inputToken: string
    outputToken: string
    outputChain: string
    formattedOutput: string
    decimals: number
}

export function generateFakeQuote(
    inputAmount: string,
    inputToken: string,
    outputToken: string,
    inputDecimals: number = 18,
    outputDecimals: number = 18
): FakeQuote {
    const inputAmountBigInt = parseUnits(inputAmount, inputDecimals)
    
    // Simple 1:1 conversion for fake quotes
    const outputAmountBigInt = inputAmountBigInt
    
    return {
        inputAmount: inputAmountBigInt,
        outputAmount: outputAmountBigInt,
        inputToken,
        outputToken,
        outputChain: "1284", // Moonbeam
        formattedOutput: formatUnits(outputAmountBigInt, outputDecimals),
        decimals: outputDecimals,
    }
}

