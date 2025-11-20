import { type Hex, type Address, type Abi, encodeFunctionData, maxUint256, erc20Abi } from "viem"
import type { DestinationActionConfig } from "../../../types/destinationAction"
import { SupportedChainId } from "@1delta/lib-utils"
import { XCDOT_ADDRESS, STELLA_STDOT_ADDRESS } from "../../../consts"
import type { RawCurrency } from "../../../../types/currency"
import { DeltaCallType } from "@1delta/trade-sdk/dist/types"
import { ERC20_ABI } from "../../../abi"

const PERMIT_DISPATCH_SELECTOR: Hex = "0xb5ea0966"

const STAKING_ABI: Abi = [
  {
    type: "function",
    name: "deposit",
    inputs: [
      {
        name: "amount",
        type: "uint256",
        internalType: "uint256",
      },
    ],
    outputs: [],
    stateMutability: "nonpayable",
  },
] as Abi

const base: Omit<DestinationActionConfig, "functionSelectors" | "name" | "description" | "defaultFunctionSelector" | "address"> = {
  abi: STAKING_ABI,
  actionType: "staking",
  group: "staking",
}

const XCDOT_CURRENCY: RawCurrency = {
  chainId: SupportedChainId.MOONBEAM,
  address: XCDOT_ADDRESS,
  symbol: "DOT",
  decimals: 10,
}

const STELLA_STDOT_CURRENCY: RawCurrency = {
  chainId: SupportedChainId.MOONBEAM,
  address: STELLA_STDOT_ADDRESS,
  symbol: "stDOT",
  decimals: 10,
}

export function getActions(opts?: { dstToken?: string; dstChainId?: string }): DestinationActionConfig[] {
  if (opts?.dstChainId && opts.dstChainId !== SupportedChainId.MOONBEAM) {
    return []
  }

  const items: DestinationActionConfig[] = []

  const action: DestinationActionConfig = {
    ...base,
    address: STELLA_STDOT_ADDRESS,
    name: "Stake DOT",
    description: "Stake DOT to StellaSwap using 1delta composer",
    functionSelectors: [PERMIT_DISPATCH_SELECTOR],
    defaultFunctionSelector: PERMIT_DISPATCH_SELECTOR,
    meta: {
      useComposer: true,
      underlying: XCDOT_CURRENCY,
      stakedToken: STELLA_STDOT_CURRENCY,
      supportedChainIds: [SupportedChainId.MOONBEAM as string],
    },
    buildCalls: async (ctx) => {
      return [
        {
          target: XCDOT_ADDRESS,
          calldata: encodeFunctionData({ abi: ERC20_ABI, functionName: "approve", args: [STELLA_STDOT_ADDRESS, maxUint256] }),
          value: 0n,
          callType: DeltaCallType.DEFAULT,
        },
        {
          target: STELLA_STDOT_ADDRESS,
          calldata: encodeFunctionData({ abi: STAKING_ABI, functionName: "deposit", args: [0n] }),
          value: 0n,
          callType: DeltaCallType.FULL_TOKEN_BALANCE,
          tokenAddress: XCDOT_ADDRESS,
          balanceOfInjectIndex: 0,
        },
        {
          // sweep call
          target: STELLA_STDOT_ADDRESS,
          calldata: encodeFunctionData({ abi: erc20Abi, functionName: "transfer", args: [ctx.userAddress, 0n] }),
          value: 0n,
          callType: DeltaCallType.FULL_TOKEN_BALANCE,
          tokenAddress: STELLA_STDOT_ADDRESS,
          balanceOfInjectIndex: 1,
        },
      ]
    },
  }

  if (!opts?.dstToken || opts.dstToken.toLowerCase() === XCDOT_ADDRESS.toLowerCase()) {
    items.push(action)
  }

  return items
}
