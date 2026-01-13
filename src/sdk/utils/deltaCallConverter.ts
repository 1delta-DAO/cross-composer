import type { DeltaCall, PostDeltaCall, PreDeltaCall } from '@1delta/lib-utils'
import { DeltaCallType, LendingCall } from '@1delta/lib-utils'
import type { ActionCall } from '../../components/actions/shared/types'

const PRE_CALL_LENDING_ACTIONS = [
  LendingCall.DeltaCallLendingAction.WITHDRAW,
  LendingCall.DeltaCallLendingAction.BORROW,
]

const POST_CALL_LENDING_ACTIONS = [
  LendingCall.DeltaCallLendingAction.DEPOSIT,
  LendingCall.DeltaCallLendingAction.REPAY,
]

const EXTERNAL_CALL_TYPES = [
  DeltaCallType.DEFAULT,
  DeltaCallType.FULL_TOKEN_BALANCE,
  DeltaCallType.FULL_NATIVE_BALANCE,
  DeltaCallType.SWEEP_WITH_VALIDATION,
  DeltaCallType.APPROVE,
]

function stripGasLimit<T extends ActionCall>(call: T): Omit<T, 'gasLimit'> {
  const { gasLimit: _, ...rest } = call
  return rest
}

function isLendingCall(call: ActionCall): boolean {
  return call.callType === DeltaCallType.LENDING
}

function getLendingAction(call: ActionCall): LendingCall.DeltaCallLendingAction | undefined {
  if (!isLendingCall(call)) return undefined
  return (call as any).lendingAction as LendingCall.DeltaCallLendingAction
}

function isPreCall(call: ActionCall): boolean {
  if (!isLendingCall(call)) return false
  const action = getLendingAction(call)
  return action !== undefined && PRE_CALL_LENDING_ACTIONS.includes(action)
}

function isPostCall(call: ActionCall): boolean {
  if (EXTERNAL_CALL_TYPES.includes(call.callType as DeltaCallType)) return true
  if (!isLendingCall(call)) return false
  const action = getLendingAction(call)
  return action !== undefined && POST_CALL_LENDING_ACTIONS.includes(action)
}

export const DeltaCallConverter = {
  toDeltaCalls(calls: ActionCall[]): DeltaCall[] {
    return calls.map((c) => stripGasLimit(c) as DeltaCall)
  },

  toPreCalls(calls: ActionCall[]): PreDeltaCall[] {
    return calls.filter(isPreCall).map((c) => stripGasLimit(c) as PreDeltaCall)
  },

  toPostCalls(calls: ActionCall[]): PostDeltaCall[] {
    return calls.filter(isPostCall).map((c) => stripGasLimit(c) as PostDeltaCall)
  },

  calculateGasLimit(calls: ActionCall[]): bigint {
    return calls.reduce((acc, c) => acc + (c.gasLimit || 0n), 0n)
  },

  hasPreCalls(calls?: ActionCall[]): boolean {
    return Boolean(calls && calls.length > 0 && calls.some(isPreCall))
  },

  hasPostCalls(calls?: ActionCall[]): boolean {
    return Boolean(calls && calls.length > 0 && calls.some(isPostCall))
  },

  isLendingAction(calls?: ActionCall[]): boolean {
    return Boolean(calls && calls.some(isLendingCall))
  },
}
