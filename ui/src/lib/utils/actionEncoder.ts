import { encodeFunctionData, type Address, type Hex, type Abi } from "viem"
import { DestinationAction, EncodedDestinationAction } from "../types/destinationAction"

/**
 * Encode a destination action call using the ABI
 */
export function encodeDestinationAction(
    action: DestinationAction,
    functionSelector: Hex,
    args: unknown[] = []
): EncodedDestinationAction | null {
    try {
        // Find the function in the ABI that matches the selector
        const functionAbi = findFunctionBySelector(action.abi, functionSelector)
        if (!functionAbi) {
            console.error(`Function with selector ${functionSelector} not found in ABI`)
            return null
        }

        const calldata = encodeFunctionData({
            abi: [functionAbi],
            functionName: functionAbi.name as string,
            args,
        })

        return {
            target: action.address,
            calldata,
            value: BigInt(0),
        }
    } catch (error) {
        console.error("Error encoding destination action:", error)
        return null
    }
}

/**
 * Find a function in the ABI that matches the given selector
 * This is a simplified implementation - in production you'd compute selectors from signatures
 */
function findFunctionBySelector(abi: Abi, selector: Hex): any {
    // Filter for function types
    const functions = abi.filter((item: any) => item.type === "function")

    // For now, return the first function or match by name if possible
    // In production, this would compute selectors from function signatures
    if (functions.length > 0) {
        // If a default function selector is provided and we can match it, use that function
        // Otherwise, return the first function
        return functions[0]
    }

    return null
}

