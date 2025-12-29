import { useMemo } from 'react'
import { Address, erc20Abi } from 'viem'
import { useReadContracts } from 'wagmi'
import { Lender } from '@1delta/lib-utils'
import {
  prepareLenderDebitMulticall,
  parseLenderDebitResult,
  getLenderApproveTransaction,
  LendingMode,
  type LenderDebitData,
  getComposerAddress,
} from '@1delta/calldata-sdk'
import type { ActionCall } from '../../actions/shared/types'
import { extractLendingApprovals } from '../utils/extractMTokenApprovals'
import { MOONWELL_COMPTROLLER } from '../../actions/lending/deposit/consts'
import { getMarketByMToken } from '../../actions/lending/shared/marketCache'

export interface LendingApprovalInfo {
  lender: Lender
  token: Address
  spender: Address
  balance: bigint
  needsApproval: boolean
  approvalTransaction?: ReturnType<typeof getLenderApproveTransaction>
}

export interface LendingApprovalsResult {
  approvals: LendingApprovalInfo[]
  needsAnyApproval: boolean
  lenderDebitData: Record<string, LenderDebitData>
}

export function useLendingApprovals(
  account: Address | undefined,
  inputCalls: ActionCall[] | undefined,
  chainId: string | undefined
): LendingApprovalsResult {
  const lendingApprovals = useMemo(() => {
    if (!inputCalls || !chainId || !account) return []
    const composerAddress = getComposerAddress(chainId)
    return extractLendingApprovals(inputCalls, composerAddress)
  }, [inputCalls, chainId, account])

  const lendersByToken = useMemo(() => {
    const map: Record<string, { lender: Lender; tokens: Address[] }> = {}

    for (const approval of lendingApprovals) {
      const key = String(approval.lender)
      if (!map[key]) {
        map[key] = { lender: approval.lender, tokens: [] }
      }
      if (!map[key].tokens.includes(approval.token)) {
        map[key].tokens.push(approval.token)
      }
    }

    return Object.values(map)
  }, [lendingApprovals])

  const prepared = useMemo(() => {
    if (!account || !chainId || lendersByToken.length === 0) {
      return null
    }

    const lenders: Lender[] = []
    const tokenAddressesByLender: Record<Lender, Address[]> = {} as any

    for (const { lender, tokens } of lendersByToken) {
      lenders.push(lender)
      tokenAddressesByLender[lender] = tokens
    }

    const composerAddress = getComposerAddress(chainId)

    return prepareLenderDebitMulticall({
      chainId,
      account,
      subAccount: account,
      lenders,
      tokenAddressesByLender,
      spender: composerAddress,
    })
  }, [account, chainId, lendersByToken])

  const contracts = useMemo(() => {
    if (!prepared) return []
    return prepared.calls.map((call) => ({
      address: call.address as Address,
      abi: prepared.abi as any,
      functionName: call.name as any,
      args: call.params as any[],
    }))
  }, [prepared])

  const { data: results } = useReadContracts({
    contracts,
    query: {
      enabled: contracts.length > 0,
    },
  })

  const lenderDebitData = useMemo(() => {
    if (!prepared || !results) {
      return {}
    }

    const rawResults = results.map((r) => r.result)
    return parseLenderDebitResult({
      metadata: prepared.meta.metadata,
      raw: rawResults,
      chainId: prepared.meta.chainId,
    })
  }, [prepared, results])

  const balanceContracts = useMemo(() => {
    if (!account || lendingApprovals.length === 0) return []
    return lendingApprovals.map((approval) => ({
      address: approval.token,
      abi: erc20Abi,
      functionName: 'balanceOf' as const,
      args: [account],
    }))
  }, [account, lendingApprovals])

  const { data: balanceResults } = useReadContracts({
    contracts: balanceContracts,
    query: {
      enabled: balanceContracts.length > 0,
    },
  })

  const approvalInfos = useMemo(() => {
    if (lendingApprovals.length === 0) {
      return []
    }

    const composerAddress = getComposerAddress(chainId || '')

    return lendingApprovals.map((approval, index) => {
      const balance = (balanceResults?.[index]?.result as bigint) || 0n
      const tokenKey = approval.token.toLowerCase()
      const debitData = lenderDebitData[tokenKey]
      const hasDelegation = debitData
        ? Object.values(debitData).some(
            (entry) => entry && (entry.amount !== undefined || entry.params !== undefined)
          )
        : false

      let requiredAmount = balance

      if (
        approval.underlyingAmount &&
        approval.underlyingAmount > 0n &&
        approval.lender === Lender.MOONWELL
      ) {
        const market = getMarketByMToken(approval.token)
        const underlyingAmount = approval.underlyingAmount

        if (!market) {
        } else if (!market.exchangeRate || market.exchangeRate === 0n) {
        } else {
          const exchangeRate = market.exchangeRate
          const mTokenAmount = (underlyingAmount * 10n ** 18n) / exchangeRate

          const finalRequiredAmount = mTokenAmount > balance ? balance : mTokenAmount

          requiredAmount = finalRequiredAmount
        }
      }

      const needsApproval = requiredAmount > 0n && !hasDelegation

      let approvalTransaction: ReturnType<typeof getLenderApproveTransaction> | undefined

      if (needsApproval && chainId && account) {
        const lenderAddress = approval.lender === Lender.MOONWELL ? MOONWELL_COMPTROLLER : undefined

        if (lenderAddress) {
          approvalTransaction = getLenderApproveTransaction(
            chainId,
            account,
            lenderAddress,
            approval.token,
            composerAddress,
            LendingMode.NONE,
            requiredAmount
          )
        }
      }

      return {
        lender: approval.lender,
        token: approval.token,
        spender: approval.spender,
        balance,
        needsApproval,
        approvalTransaction,
      }
    })
  }, [lendingApprovals, lenderDebitData, chainId, account, balanceResults])

  const needsAnyApproval = useMemo(
    () => approvalInfos.some((info) => info.needsApproval),
    [approvalInfos]
  )

  return {
    approvals: approvalInfos,
    needsAnyApproval,
    lenderDebitData,
  }
}
