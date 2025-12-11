export type ExecutionEventType =
  | 'approval:start'
  | 'approval:sent'
  | 'approval:confirmed'
  | 'tx:signing'
  | 'tx:sent'
  | 'tx:confirmed'
  | 'bridge:tracking'
  | 'bridge:update'
  | 'bridge:completed'
  | 'done'
  | 'error'
  | 'bridge:error'
  | 'timeout'

export interface ExecutionEvent {
  type: ExecutionEventType
  src?: string
  dst?: string
  [key: string]: any
}

export interface ExecutionTracker {
  on(listener: (event: ExecutionEvent) => void): void
  off(listener: (event: ExecutionEvent) => void): void
  done: Promise<ExecutionResult>
  cancel(): void
}

export interface ExecutionResult {
  srcHash?: string
  dstHash?: string
  completed: boolean
}
