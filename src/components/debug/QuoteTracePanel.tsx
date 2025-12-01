import { useState, useRef, useEffect, useCallback } from 'react'
import { useQuoteTrace } from '../../contexts/QuoteTraceContext'
import type { QuoteTraceEntry } from '../../contexts/QuoteTraceContext'

const TRACE_QUOTING_ENABLED = import.meta.env.VITE_TRACE_QUOTING === 'true'
const STORAGE_KEY = '1delta-quote-trace-panel'
const DEFAULT_HEIGHT = 400
const MIN_HEIGHT = 100
const MAX_HEIGHT = 800

function formatTimestamp(timestamp: number): string {
  const date = new Date(timestamp)
  const now = Date.now()
  const diff = now - timestamp
  const seconds = Math.floor(diff / 1000)
  const minutes = Math.floor(seconds / 60)
  const hours = Math.floor(minutes / 60)

  if (seconds < 60) {
    return `${seconds}s ago`
  }
  if (minutes < 60) {
    return `${minutes}m ago`
  }
  if (hours < 24) {
    return `${hours}h ago`
  }

  return date.toLocaleString()
}

function QuoteCard({ entry }: { entry: QuoteTraceEntry }) {
  const [isExpanded, setIsExpanded] = useState(false)
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set())

  const toggleSection = (section: string) => {
    setExpandedSections((prev) => {
      const next = new Set(prev)
      if (next.has(section)) {
        next.delete(section)
      } else {
        next.add(section)
      }
      return next
    })
  }

  const statusBadge = entry.success ? (
    <span className="badge badge-success badge-sm">Success</span>
  ) : (
    <span className="badge badge-error badge-sm">Error</span>
  )

  const actionBadge = entry.actionInfo?.actionLabel ? (
    <span className="badge badge-outline badge-sm">{entry.actionInfo.actionLabel}</span>
  ) : entry.actionInfo?.actionType ? (
    <span className="badge badge-outline badge-sm">{entry.actionInfo.actionType}</span>
  ) : null

  return (
    <div className="card bg-base-200 shadow-sm">
      <div className="card-body p-4">
        <div
          className="flex items-center justify-between cursor-pointer"
          onClick={() => setIsExpanded(!isExpanded)}
        >
          <div className="flex items-center gap-2 flex-1">
            <span className="text-xs text-base-content/60">{formatTimestamp(entry.timestamp)}</span>
            {actionBadge}
            {statusBadge}
            {entry.success ? (
              <span className="text-xs text-base-content/70">
                {entry.quotes.length} quote{entry.quotes.length !== 1 ? 's' : ''}
              </span>
            ) : (
              <span className="text-xs text-error">Error</span>
            )}
          </div>
          <button
            className="btn btn-ghost btn-xs"
            onClick={(e) => {
              e.stopPropagation()
              setIsExpanded(!isExpanded)
            }}
          >
            {isExpanded ? '▼' : '▶'}
          </button>
        </div>

        {isExpanded && (
          <div className="mt-4 space-y-2">
            {entry.error && (
              <div className="alert alert-error py-2">
                <div className="text-sm">{entry.error}</div>
              </div>
            )}

            <details
              className="collapse collapse-arrow bg-base-300"
              open={expandedSections.has('request')}
            >
              <summary
                className="collapse-title text-sm font-medium"
                onClick={(e) => {
                  e.preventDefault()
                  toggleSection('request')
                }}
              >
                Request Info
              </summary>
              <div className="collapse-content">
                <div className="text-xs space-y-1 mt-2">
                  {entry.requestInfo?.srcCurrency && (
                    <div>
                      <span className="font-medium">Source:</span>{' '}
                      {entry.requestInfo.srcCurrency.symbol} (
                      {entry.requestInfo.srcCurrency.chainId})
                    </div>
                  )}
                  {entry.requestInfo?.dstCurrency && (
                    <div>
                      <span className="font-medium">Destination:</span>{' '}
                      {entry.requestInfo.dstCurrency.symbol} (
                      {entry.requestInfo.dstCurrency.chainId})
                    </div>
                  )}
                  {entry.requestInfo?.amount && (
                    <div>
                      <span className="font-medium">Amount:</span> {entry.requestInfo.amount}
                    </div>
                  )}
                  {entry.requestInfo?.slippage !== undefined && (
                    <div>
                      <span className="font-medium">Slippage:</span> {entry.requestInfo.slippage}%
                    </div>
                  )}
                </div>
              </div>
            </details>

            {entry.actionInfo && (
              <details
                className="collapse collapse-arrow bg-base-300"
                open={expandedSections.has('action')}
              >
                <summary
                  className="collapse-title text-sm font-medium"
                  onClick={(e) => {
                    e.preventDefault()
                    toggleSection('action')
                  }}
                >
                  Action Info
                </summary>
                <div className="collapse-content">
                  <div className="text-xs space-y-1 mt-2">
                    {entry.actionInfo.actionType && (
                      <div>
                        <span className="font-medium">Type:</span> {entry.actionInfo.actionType}
                      </div>
                    )}
                    {entry.actionInfo.actionLabel && (
                      <div>
                        <span className="font-medium">Label:</span> {entry.actionInfo.actionLabel}
                      </div>
                    )}
                    {entry.actionInfo.actionId && (
                      <div>
                        <span className="font-medium">ID:</span> {entry.actionInfo.actionId}
                      </div>
                    )}
                    {entry.actionInfo.destinationCalls &&
                      entry.actionInfo.destinationCalls.length > 0 && (
                        <div>
                          <span className="font-medium">Destination Calls:</span>{' '}
                          {entry.actionInfo.destinationCalls.length}
                          <pre className="mt-1 p-2 bg-base-200 rounded text-xs overflow-auto max-h-40">
                            {JSON.stringify(
                              entry.actionInfo.destinationCalls,
                              (key, value) =>
                                typeof value === 'bigint' ? value.toString() : value,
                              2
                            )}
                          </pre>
                        </div>
                      )}
                  </div>
                </div>
              </details>
            )}

            {entry.quotes.length > 0 && (
              <details
                className="collapse collapse-arrow bg-base-300"
                open={expandedSections.has('quotes')}
              >
                <summary
                  className="collapse-title text-sm font-medium"
                  onClick={(e) => {
                    e.preventDefault()
                    toggleSection('quotes')
                  }}
                >
                  Quotes ({entry.quotes.length})
                </summary>
                <div className="collapse-content">
                  <div className="space-y-3 mt-2">
                    {entry.quotes.map((quote, index) => (
                      <details key={index} className="collapse collapse-arrow bg-base-100">
                        <summary className="collapse-title text-xs font-medium">
                          {quote.label || `Quote ${index + 1}`}
                        </summary>
                        <div className="collapse-content">
                          <pre className="text-xs p-2 bg-base-200 rounded overflow-auto max-h-60">
                            {JSON.stringify(
                              quote.trade,
                              (key, value) =>
                                typeof value === 'bigint' ? value.toString() : value,
                              2
                            )}
                          </pre>
                        </div>
                      </details>
                    ))}
                  </div>
                </div>
              </details>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

export function QuoteTracePanel() {
  if (!TRACE_QUOTING_ENABLED) {
    return null
  }

  const { entries, clearAll } = useQuoteTrace()
  const [isMinimized, setIsMinimized] = useState(() => {
    try {
      const saved = localStorage.getItem(`${STORAGE_KEY}-minimized`)
      return saved ? JSON.parse(saved) : false
    } catch {
      return false
    }
  })
  const [height, setHeight] = useState(() => {
    try {
      const saved = localStorage.getItem(`${STORAGE_KEY}-height`)
      return saved ? parseInt(saved, 10) : DEFAULT_HEIGHT
    } catch {
      return DEFAULT_HEIGHT
    }
  })
  const [isResizing, setIsResizing] = useState(false)
  const panelRef = useRef<HTMLDivElement>(null)
  const resizeRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    try {
      localStorage.setItem(`${STORAGE_KEY}-minimized`, JSON.stringify(isMinimized))
    } catch {}
  }, [isMinimized])

  useEffect(() => {
    try {
      localStorage.setItem(`${STORAGE_KEY}-height`, height.toString())
    } catch {}
  }, [height])

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    setIsResizing(true)
  }, [])

  useEffect(() => {
    if (!isResizing) return

    const handleMouseMove = (e: MouseEvent) => {
      if (!panelRef.current) return
      const rect = panelRef.current.getBoundingClientRect()
      const newHeight = window.innerHeight - e.clientY
      const clampedHeight = Math.max(MIN_HEIGHT, Math.min(MAX_HEIGHT, newHeight))
      setHeight(clampedHeight)
    }

    const handleMouseUp = () => {
      setIsResizing(false)
    }

    window.addEventListener('mousemove', handleMouseMove)
    window.addEventListener('mouseup', handleMouseUp)

    return () => {
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('mouseup', handleMouseUp)
    }
  }, [isResizing])

  const toggleMinimize = useCallback(() => {
    setIsMinimized((prev: boolean) => !prev)
  }, [])

  if (entries.length === 0) {
    return null
  }

  if (isMinimized) {
    return (
      <div className="bg-base-100 border-t border-base-300 shadow-lg">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center justify-between px-3 py-2">
            <div className="flex items-center gap-2">
              <h3 className="text-xs font-semibold">Quote Traces ({entries.length})</h3>
              {entries.length > 0 && (
                <div className="flex items-center gap-1">
                  {entries.slice(0, 3).map((entry) => (
                    <span
                      key={entry.id}
                      className={`badge badge-xs ${entry.success ? 'badge-success' : 'badge-error'}`}
                      title={
                        entry.actionInfo?.actionLabel || entry.actionInfo?.actionType || 'Quote'
                      }
                    >
                      {entry.actionInfo?.actionLabel || entry.actionInfo?.actionType || 'Q'}
                    </span>
                  ))}
                  {entries.length > 3 && (
                    <span className="text-xs text-base-content/60">+{entries.length - 3}</span>
                  )}
                </div>
              )}
            </div>
            <div className="flex items-center gap-2">
              <button className="btn btn-ghost btn-xs" onClick={clearAll} title="Clear">
                Clear
              </button>
              <button className="btn btn-ghost btn-xs" onClick={toggleMinimize} title="Maximize">
                ▲
              </button>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div
      ref={panelRef}
      className="bg-base-100 border-t border-base-300 shadow-lg flex flex-col"
      style={{ height: `${height}px` }}
    >
      <div className="max-w-7xl mx-auto w-full flex flex-col flex-1 overflow-hidden">
        <div className="flex items-center justify-between p-3 border-b border-base-300 flex-shrink-0">
          <h3 className="text-sm font-semibold">Quote Traces ({entries.length})</h3>
          <div className="flex items-center gap-2">
            <button className="btn btn-ghost btn-xs" onClick={clearAll}>
              Clear
            </button>
            <button className="btn btn-ghost btn-xs" onClick={toggleMinimize} title="Minimize">
              ▼
            </button>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto p-3 space-y-2">
          {entries.map((entry) => (
            <QuoteCard key={entry.id} entry={entry} />
          ))}
        </div>
      </div>
      <div
        ref={resizeRef}
        className="h-1 bg-base-300 cursor-ns-resize hover:bg-primary/50 transition-colors flex-shrink-0"
        onMouseDown={handleMouseDown}
        style={{ userSelect: 'none' }}
      >
        <div className="h-full w-full flex items-center justify-center">
          <div className="w-12 h-0.5 bg-base-content/30 rounded"></div>
        </div>
      </div>
    </div>
  )
}
