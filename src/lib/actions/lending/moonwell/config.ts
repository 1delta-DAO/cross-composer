import { zeroAddress, type Abi, type Address, type Hex } from "viem"
import type { DestinationActionConfig } from "../../../types/destinationAction"
import { MTOKEN_ABI } from "./mTokenAbi"

const base: Omit<DestinationActionConfig, "functionSelectors" | "name" | "description" | "defaultFunctionSelector"> = {
    address: zeroAddress,
    abi: MTOKEN_ABI,
    actionType: "lending",
    group: "lending",
}

const actions: DestinationActionConfig[] = [
    {
        ...base,
        name: "Lending: Mint",
        description: "Deposit asset to Moonwell",
        functionSelectors: ["0xa0712d68" as Hex],
        defaultFunctionSelector: "0xa0712d68" as Hex,
    },
    {
        ...base,
        name: "Lending: Borrow",
        description: "Borrow asset from Moonwell",
        functionSelectors: ["0xc5ebeaec" as Hex],
        defaultFunctionSelector: "0xc5ebeaec" as Hex,
    },
    {
        ...base,
        name: "Lending: Withdraw",
        description: "Withdraw asset from Moonwell",
        functionSelectors: ["0xdb006a75" as Hex],
        defaultFunctionSelector: "0xdb006a75" as Hex,
    },
    {
        ...base,
        name: "Lending: Repay",
        description: "Repay borrowed asset on Moonwell",
        functionSelectors: ["0x0e752702" as Hex],
        defaultFunctionSelector: "0x0e752702" as Hex,
    },
]

export default actions
