import { useMemo, useEffect, useState, useCallback } from 'react'
import { Address, erc20Abi, zeroAddress } from 'viem'
import { useReadContracts } from 'wagmi'
import { Lender, getBestRpcsForChain } from '@1delta/lib-utils'
import { multicallRetryUniversal } from '@1delta/providers'
import {
  prepareDebitDataMulticall,
  parseDebitDataResult,
  prepareLenderDebitMulticall,
  parseLenderDebitResult,
  getLenderApproveTransaction,
  LendingMode,
  getComposerAddress,
  type DebitData,
  type LenderDebitData,
} from '@1delta/calldata-sdk'
import type { ActionCall } from '../../components/actions/shared/types'
import { extractLendingApprovals } from '../../components/actionsTab/utils/extractMTokenApprovals'
import {
  getUnderlyingTokenFromLendingToken,
  calculateRequiredLendingTokenAmount,
} from '../../components/actionsTab/utils/lenderUtils'
import type { ApprovalInfo } from '../services/executionPipeline'

export interface TokenApprovalParams {
  token: Address
  spender: Address
  amount: bigint | string
}

export interface LendingApprovalInfo extends ApprovalInfo {
  lender: Lender
  balance: bigint
}

export interface ApprovalResult {
  tokenApprovals: ApprovalInfo[]
  lendingApprovals: LendingApprovalInfo[]
  needsAnyApproval: boolean
  needsTokenApproval: (token: Address, spender: Address) => boolean
  getAllowance: (token: Address, spender: Address) => bigint
  debitData: Record<string, DebitData>
  lenderDebitData: Record<string, LenderDebitData>
}

export interface UseApprovalsParams {
  account?: Address
  chainId?: string
  tokenApprovals?: TokenApprovalParams[]
  inputCalls?: ActionCall[]
  skip?: boolean
}

export function useApprovals(params: UseApprovalsParams): ApprovalResult {
  const { account, chainId, tokenApprovals = [], inputCalls, skip = false } = params

  const tokenResult = useTokenApprovals(account, chainId, tokenApprovals, skip)
  const lendingResult = useLendingApprovalsInternal(account, chainId, inputCalls, skip)

  const needsAnyApproval = tokenResult.needsAnyApproval || lendingResult.needsAnyApproval

  return {
    tokenApprovals: tokenResult.approvals,
    lendingApprovals: lendingResult.approvals,
    needsAnyApproval,
    needsTokenApproval: tokenResult.needsApproval,
    getAllowance: tokenResult.getAllowance,
    debitData: tokenResult.debitData,
    lenderDebitData: lendingResult.lenderDebitData,
  }
}

function useTokenApprovals(
  account: Address | undefined,
  chainId: string | undefined,
  toBeChecked: TokenApprovalParams[],
  skip: boolean
) {
  const prepared = useMemo(() => {
    if (!account || !chainId || toBeChecked.length === 0 || skip) {
      return null
    }

    const validTokens = toBeChecked.filter((a) => a.token !== zeroAddress)
    if (validTokens.length === 0) return null

    const tokenAddresses = validTokens.map((a) => a.token)
    const spenders = validTokens.map((a) => a.spender)

    return prepareDebitDataMulticall({
      chainId,
      tokenAddresses,
      account,
      spenders,
    })
  }, [account, chainId, toBeChecked, skip])

  const contracts = useMemo(() => {
    if (!prepared) return []
    return prepared.calls.map((call) => ({
      address: call.address as Address,
      abi: prepared.abi,
      functionName: call.name as any,
      args: call.params as any[],
    }))
  }, [prepared])

  const { data: results } = useReadContracts({
    contracts,
    query: {
      enabled: contracts.length > 0 && !skip,
    },
  })

  const debitData = useMemo(() => {
    if (!prepared || !results) {
      return {}
    }

    const rawResults = results.map((r) => r.result)
    return parseDebitDataResult({
      raw: rawResults,
      tokenAddresses: prepared.meta.tokenAddresses,
      spenders: prepared.meta.spenders,
    })
  }, [prepared, results])

  const needsApproval = useCallback(
    (token: Address, spender: Address) => {
      if (token === zeroAddress) return false
      const key = token.toLowerCase()
      const data = debitData[key]
      if (!data) return false

      const allowance = data.allowances[spender.toLowerCase()] || 0n
      const approval = toBeChecked.find(
        (a) => a.token.toLowerCase() === key && a.spender.toLowerCase() === spender.toLowerCase()
      )

      if (!approval || !approval.amount) return false
      const requiredAmount = BigInt(approval.amount)
      return allowance < requiredAmount
    },
    [debitData, toBeChecked]
  )

  const getAllowance = useCallback(
    (token: Address, spender: Address) => {
      const key = token.toLowerCase()
      const data = debitData[key]
      if (!data) return 0n
      return data.allowances[spender.toLowerCase()] || 0n
    },
    [debitData]
  )

  const approvals = useMemo<ApprovalInfo[]>(() => {
    return toBeChecked
      .filter((a) => a.token !== zeroAddress)
      .map((a) => ({
        token: a.token,
        spender: a.spender,
        requiredAmount: BigInt(a.amount),
        needsApproval: needsApproval(a.token, a.spender),
      }))
  }, [toBeChecked, needsApproval])

  const needsAnyApproval = useMemo(() => {
    return approvals.some((a) => a.needsApproval)
  }, [approvals])

  return {
    approvals,
    debitData,
    needsApproval,
    getAllowance,
    needsAnyApproval,
  }
}

function useLendingApprovalsInternal(
  account: Address | undefined,
  chainId: string | undefined,
  inputCalls: ActionCall[] | undefined,
  skip: boolean
) {
  const lendingApprovals = useMemo(() => {
    if (!inputCalls || !chainId || !account || skip) return []
    const composerAddress = getComposerAddress(chainId)
    return extractLendingApprovals(inputCalls, composerAddress)
  }, [inputCalls, chainId, account, skip])

  const lendersByToken = useMemo(() => {
    const map: Record<string, { lender: Lender; underlyingTokens: Address[] }> = {}

    for (const approval of lendingApprovals) {
      const key = String(approval.lender)
      if (!map[key]) {
        map[key] = { lender: approval.lender, underlyingTokens: [] }
      }

      try {
        const underlyingToken = getUnderlyingTokenFromLendingToken(
          approval.lender,
          approval.token,
          approval.underlyingTokenAddress
        )

        if (underlyingToken && !map[key].underlyingTokens.includes(underlyingToken)) {
          map[key].underlyingTokens.push(underlyingToken)
        }
      } catch (error) {
        console.error('Failed to get underlying token:', error)
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

    for (const { lender, underlyingTokens } of lendersByToken) {
      lenders.push(lender)
      tokenAddressesByLender[lender] = underlyingTokens
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

  const [lenderDebitResults, setLenderDebitResults] = useState<any[] | null>(null)
  const [balanceAndAllowanceResults, setBalanceAndAllowanceResults] = useState<any[] | null>(null)

  useEffect(() => {
    if (!chainId || skip) {
      setLenderDebitResults(null)
      setBalanceAndAllowanceResults(null)
      return
    }

    const fetchAllData = async () => {
      const rpcFromRpcSelector = await getBestRpcsForChain(chainId)
      const overrides =
        rpcFromRpcSelector && rpcFromRpcSelector.length > 0
          ? { [chainId]: rpcFromRpcSelector }
          : undefined

      const promises: Promise<any>[] = []

      if (prepared) {
        promises.push(
          (async () => {
            try {
              const calls = prepared.calls.map((call) => ({
                address: call.address as Address,
                name: call.name as string,
                params: call.params as any[],
              }))

              const results = await multicallRetryUniversal({
                chain: chainId,
                calls,
                abi: prepared.abi as any,
                maxRetries: 3,
                providerId: 0,
                ...(overrides && { overrdies: overrides }),
              })

              setLenderDebitResults(results)
            } catch (error) {
              console.error('Failed to fetch lender debit data:', error)
              setLenderDebitResults(null)
            }
          })()
        )
      } else {
        setLenderDebitResults(null)
      }

      if (account && lendingApprovals.length > 0) {
        promises.push(
          (async () => {
            try {
              const calls = lendingApprovals.flatMap((approval) => [
                {
                  address: approval.token,
                  name: 'balanceOf' as const,
                  params: [account],
                },
                {
                  address: approval.token,
                  name: 'allowance' as const,
                  params: [account, approval.spender],
                },
              ])

              const results = await multicallRetryUniversal({
                chain: chainId,
                calls,
                abi: erc20Abi,
                maxRetries: 3,
                providerId: 0,
                ...(overrides && { overrdies: overrides }),
              })

              setBalanceAndAllowanceResults(results)
            } catch (error) {
              console.error('Failed to fetch balance and allowance:', error)
              setBalanceAndAllowanceResults(null)
            }
          })()
        )
      } else {
        setBalanceAndAllowanceResults(null)
      }

      await Promise.all(promises)
    }

    fetchAllData()
  }, [prepared, account, chainId, lendingApprovals, skip])

  const lenderDebitData = useMemo(() => {
    if (!prepared || !lenderDebitResults) {
      return {}
    }

    return parseLenderDebitResult({
      metadata: prepared.meta.metadata,
      raw: lenderDebitResults,
      chainId: prepared.meta.chainId,
    })
  }, [prepared, lenderDebitResults])

  const approvals = useMemo<LendingApprovalInfo[]>(() => {
    if (lendingApprovals.length === 0) {
      return []
    }

    const composerAddress = getComposerAddress(chainId || '')

    return lendingApprovals.map((approval, index) => {
      const balanceIndex = index * 2
      const allowanceIndex = index * 2 + 1
      const balance = (balanceAndAllowanceResults?.[balanceIndex] as bigint) || 0n
      const currentAllowance = (balanceAndAllowanceResults?.[allowanceIndex] as bigint) || 0n
      const lenderKey = String(approval.lender)
      const debitData = lenderDebitData[lenderKey]
      const hasDelegation = debitData
        ? Object.values(debitData).some(
            (entry) => entry && (entry.amount !== undefined || entry.params !== undefined)
          )
        : false

      let requiredAmount = balance

      if (approval.underlyingAmount && approval.underlyingAmount > 0n) {
        try {
          const calculatedAmount = calculateRequiredLendingTokenAmount(
            approval.lender,
            approval.underlyingAmount,
            approval.token,
            balance
          )
          if (calculatedAmount !== null) {
            requiredAmount = calculatedAmount
          }
        } catch (error) {
          console.error('Failed to calculate required amount:', error)
        }
      }

      const hasSufficientAllowance = currentAllowance >= requiredAmount
      const needsApproval = requiredAmount > 0n && !hasDelegation && !hasSufficientAllowance

      let approvalTransaction: ReturnType<typeof getLenderApproveTransaction> | undefined

      if (needsApproval && chainId && account) {
        try {
          approvalTransaction = getLenderApproveTransaction(
            chainId,
            account,
            String(approval.lender),
            approval.token,
            composerAddress,
            LendingMode.NONE,
            requiredAmount
          )
        } catch (error) {
          approvalTransaction = undefined
        }
      }

      return {
        lender: approval.lender,
        token: approval.token,
        spender: approval.spender,
        balance,
        requiredAmount,
        needsApproval,
        approvalTransaction: approvalTransaction
          ? {
              to: approvalTransaction.to as Address,
              data: approvalTransaction.data as `0x${string}`,
              value: approvalTransaction.value,
            }
          : undefined,
      }
    })
  }, [lendingApprovals, lenderDebitData, chainId, account, balanceAndAllowanceResults])

  const needsAnyApproval = useMemo(
    () => approvals.some((info) => info.needsApproval),
    [approvals]
  )

  return {
    approvals,
    needsAnyApproval,
    lenderDebitData,
  }
}

