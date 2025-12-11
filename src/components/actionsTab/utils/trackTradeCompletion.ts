import { GenericTrade } from '@1delta/lib-utils'
import { getStatusFromTrade } from './getStatusFromTrade'
import { ExecutionEvent } from './types'
import { BridgeStatus } from '@1delta/trade-sdk'

export async function trackTradeCompletion(
  srcHash: string,
  trade: GenericTrade,
  emit: (event: ExecutionEvent) => void
): Promise<{ src?: string; dst?: string; completed?: boolean }> {
  if (!trade) {
    emit({ type: 'bridge:completed', src: srcHash })
    return { src: srcHash, completed: true }
  }

  try {
    const maxAttempts = 60
    const delayMs = 5000

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      try {
        const status = await getStatusFromTrade(srcHash, trade)
        const statusAny = status as any
        const statusInfo = statusAny?.statusInfo
        const bridgeStatus = (statusInfo?.status || statusAny?.status) as BridgeStatus | undefined

        // Emit raw status every iteration for UI debugging or display
        emit({
          type: 'bridge:update',
          status: bridgeStatus ?? 'UNKNOWN',
          raw: statusAny,
        })

        // --- DESTINATION HASH FOUND (success) ---
        if (status?.toHash) {
          emit({
            type: 'bridge:completed',
            src: srcHash,
            dst: status.toHash,
          })

          return {
            src: srcHash,
            dst: status.toHash,
            completed: true,
          }
        }

        // --- COMPLETED / DONE ---
        if (bridgeStatus === 'DONE') {
          emit({
            type: 'bridge:completed',
            src: srcHash,
          })

          return {
            src: srcHash,
            completed: true,
          }
        }

        // --- ERROR CODES (bridges return code/message) ---
        if (status?.message) {
          const errorMessage = status?.message || 'Bridge transaction failed'

          emit({
            type: 'error',
            src: srcHash,
            reason: `Bridge failed: ${errorMessage}`,
          })

          return { src: srcHash, completed: false }
        }

        // --- FAILURE STATUSES ---
        if (
          bridgeStatus === 'FAILED' ||
          bridgeStatus === 'TRANSFER_REFUNDED' ||
          bridgeStatus === 'INVALID'
        ) {
          const errorMessage =
            statusInfo?.message ||
            statusAny?.message ||
            statusAny?.error ||
            'Bridge transaction failed'

          emit({
            type: 'bridge:error',
            src: srcHash,
            reason: `Bridge failed: ${bridgeStatus} – ${errorMessage}`,
          })

          return { src: srcHash, completed: false }
        }
      } catch (err) {
        emit({
          type: 'bridge:error',
          src: srcHash,
          error: err instanceof Error ? err : new Error(String(err)),
        })
      }

      await new Promise((resolve) => setTimeout(resolve, delayMs))
    }

    // Timeout after max attempts
    emit({
      type: 'timeout',
      src: srcHash,
    })

    return { src: srcHash, completed: false }
  } catch (err) {
    emit({
      type: 'bridge:error',
      src: srcHash,
      error: err instanceof Error ? err : new Error(String(err)),
    })

    return { src: srcHash, completed: false }
  }
}
