import { useState, useEffect, useMemo, useRef, useCallback } from "react"
import type { Address } from "viem"
import { zeroAddress } from "viem"
import { useChainId, useSwitchChain, useSendTransaction, useSignTypedData } from "wagmi"
import { TokenSelectorModal } from "../modals/TokenSelectorModal"
import { useChainsRegistry } from "../../hooks/useChainsRegistry"
import { useTokenLists } from "../../hooks/useTokenLists"
import { useEvmBalances } from "../../hooks/balances/useEvmBalances"
import { useTokenBalance } from "../../hooks/balances/useTokenBalance"
import { useDexscreenerPrices } from "../../hooks/prices/useDexscreenerPrices"
import { useTokenPrice } from "../../hooks/prices/useTokenPrice"
import { buildTokenUrl, buildTransactionUrl } from "../../lib/explorer"
import { useDebounce } from "../../hooks/useDebounce"
import DestinationActionSelector from "../../components/DestinationActionSelector"
import type { DestinationActionConfig } from "../../lib/types/destinationAction"
import { type Abi, type Hex, parseUnits, encodeFunctionData, toFunctionSelector } from "viem"
import { formatUnits } from "viem"
import { CurrencyHandler } from "@1delta/lib-utils/dist/services/currency/currencyUtils"
import { useQueryClient } from "@tanstack/react-query"
import type { GenericTrade } from "@1delta/lib-utils"
import { SupportedChainId, TradeType } from "@1delta/lib-utils"
import { getCurrency, convertAmountToWei } from "../../lib/trade-helpers/utils"
import { fetchAllAggregatorTrades } from "../../lib/trade-helpers/aggregatorSelector"
import { fetchAllBridgeTrades } from "../../lib/trade-helpers/bridgeSelector"
import { useWriteContract, usePublicClient, useReadContract } from "wagmi"
import { ERC20_ABI, CALL_PERMIT_ABI } from "../../lib/abi"
import { useSlippage } from "../../contexts/SlippageContext"
import { Logo } from "../common/Logo"
import { usePermitBatch } from "../../hooks/usePermitBatch"
import { moonbeam } from "viem/chains"
import { BATCH_PRECOMPILE, CALL_PERMIT_PRECOMPILE } from "../../lib/consts"
import { useToast } from "../common/ToastHost"

type Props = {
    userAddress?: Address
    onResetStateChange?: (showReset: boolean, resetCallback?: () => void) => void
}

export function SwapTab({ userAddress, onResetStateChange }: Props) {
    const { data: chains } = useChainsRegistry()
    const { data: lists } = useTokenLists()
    const currentChainId = useChainId()
    const { switchChain, switchChainAsync } = useSwitchChain()
    const [srcChainId, setSrcChainId] = useState<string | undefined>("8453") // Base chain
    const [dstChainId, setDstChainId] = useState<string | undefined>(SupportedChainId.MOONBEAM)
    const [srcToken, setSrcToken] = useState<Address | undefined>(undefined)
    const [dstToken, setDstToken] = useState<Address | undefined>(undefined)
    const [amount, setAmount] = useState("")

    const srcTokensMap = srcChainId ? lists?.[srcChainId] || {} : {}
    const dstTokensMap = dstChainId ? lists?.[dstChainId] || {} : {}
    const srcAddrs = useMemo(() => (srcChainId ? (Object.keys(srcTokensMap) as Address[]).slice(0, 300) : []), [srcTokensMap, srcChainId])
    const dstAddrs = useMemo(() => (dstChainId ? (Object.keys(dstTokensMap) as Address[]).slice(0, 300) : []), [dstTokensMap, dstChainId])

    // Prevent chain flip during encoding/signing
    const [isEncoding, setIsEncoding] = useState(false)

    // Switch wallet chain when source chain changes
    useEffect(() => {
        if (!srcChainId || isEncoding) return
        const srcChainIdNum = Number(srcChainId)
        if (currentChainId !== srcChainIdNum) {
            try {
                switchChain({ chainId: srcChainIdNum })
            } catch (err: unknown) {
                console.warn("Failed to switch chain:", err)
            }
        }
    }, [srcChainId, currentChainId, switchChain, isEncoding])

    // Include zero address for native token balance
    const srcAddressesWithNative = useMemo(() => {
        if (!srcChainId || !userAddress) return []
        const addrs = [...srcAddrs]
        if (!addrs.includes(zeroAddress as Address)) {
            addrs.unshift(zeroAddress as Address)
        }
        return addrs
    }, [srcAddrs, srcChainId, userAddress])

    const { data: srcBalances, isLoading: srcBalancesLoading } = useEvmBalances({
        chainId: srcChainId || "",
        userAddress,
        tokenAddresses: srcAddressesWithNative,
    })

    const srcPriceAddresses = useMemo(() => {
        if (!srcBalances?.[srcChainId || ""] || !userAddress || !srcChainId) return []

        const addressesWithBalance: Address[] = []
        const wrapped = CurrencyHandler.wrappedAddressFromAddress(srcChainId, zeroAddress)

        for (const addr of srcAddressesWithNative) {
            const bal = srcBalances[srcChainId][addr.toLowerCase()]
            if (bal && Number(bal.value || 0) > 0) {
                if (addr.toLowerCase() === zeroAddress.toLowerCase() && wrapped) {
                    if (!addressesWithBalance.includes(wrapped as Address)) {
                        addressesWithBalance.push(wrapped as Address)
                    }
                } else {
                    if (!addressesWithBalance.includes(addr)) {
                        addressesWithBalance.push(addr)
                    }
                }
            }
        }

        return addressesWithBalance
    }, [srcBalances, srcChainId, srcAddressesWithNative, userAddress])

    const { data: srcPrices, isLoading: srcPricesLoading } = useDexscreenerPrices({
        chainId: srcChainId || "",
        addresses: srcPriceAddresses,
        enabled: srcPriceAddresses.length > 0,
    })

    const srcTokenPriceAddr = useMemo(() => {
        if (!srcToken || !srcChainId) return undefined
        if (srcToken.toLowerCase() === zeroAddress.toLowerCase()) {
            return CurrencyHandler.wrappedAddressFromAddress(srcChainId, zeroAddress) as Address | undefined
        }
        return srcToken
    }, [srcToken, srcChainId])

    const srcTokenPriceInCache = srcTokenPriceAddr && srcPrices?.[srcChainId || ""]?.[srcTokenPriceAddr.toLowerCase()]
    const { price: srcTokenPriceOnDemand, isLoading: srcTokenPriceOnDemandLoading } = useTokenPrice({
        chainId: srcChainId || "",
        tokenAddress: srcTokenPriceAddr,
        enabled: Boolean(srcToken && srcChainId && !srcTokenPriceInCache),
    })

    const srcPricesMerged = useMemo(() => {
        const merged = { ...srcPrices?.[srcChainId || ""] }
        if (srcTokenPriceAddr && srcTokenPriceOnDemand) {
            merged[srcTokenPriceAddr.toLowerCase()] = { usd: srcTokenPriceOnDemand }
        }
        return merged
    }, [srcPrices, srcChainId, srcTokenPriceAddr, srcTokenPriceOnDemand])

    const dstAddressesWithNative = useMemo(() => {
        if (!dstChainId || !userAddress) return []
        const addrs = [...dstAddrs]
        if (!addrs.includes(zeroAddress as Address)) {
            addrs.unshift(zeroAddress as Address)
        }
        return addrs
    }, [dstAddrs, dstChainId, userAddress])

    const { data: dstBalances, isLoading: dstBalancesLoading } = useEvmBalances({
        chainId: dstChainId || "",
        userAddress,
        tokenAddresses: dstAddressesWithNative,
    })

    const dstPriceAddresses = useMemo(() => {
        if (!dstBalances?.[dstChainId || ""] || !userAddress || !dstChainId) return []

        const addressesWithBalance: Address[] = []
        const wrapped = CurrencyHandler.wrappedAddressFromAddress(dstChainId, zeroAddress)

        for (const addr of dstAddressesWithNative) {
            const bal = dstBalances[dstChainId][addr.toLowerCase()]
            if (bal && Number(bal.value || 0) > 0) {
                if (addr.toLowerCase() === zeroAddress.toLowerCase() && wrapped) {
                    if (!addressesWithBalance.includes(wrapped as Address)) {
                        addressesWithBalance.push(wrapped as Address)
                    }
                } else {
                    if (!addressesWithBalance.includes(addr)) {
                        addressesWithBalance.push(addr)
                    }
                }
            }
        }

        return addressesWithBalance
    }, [dstBalances, dstChainId, dstAddressesWithNative, userAddress])

    const { data: dstPrices, isLoading: dstPricesLoading } = useDexscreenerPrices({
        chainId: dstChainId || "",
        addresses: dstPriceAddresses,
        enabled: dstPriceAddresses.length > 0,
    })

    const dstTokenPriceAddr = useMemo(() => {
        if (!dstToken || !dstChainId) return undefined
        if (dstToken.toLowerCase() === zeroAddress.toLowerCase()) {
            return CurrencyHandler.wrappedAddressFromAddress(dstChainId, zeroAddress) as Address | undefined
        }
        return dstToken
    }, [dstToken, dstChainId])

    const dstTokenPriceInCache = dstTokenPriceAddr && dstPrices?.[dstChainId || ""]?.[dstTokenPriceAddr.toLowerCase()]
    const { price: dstTokenPriceOnDemand, isLoading: dstTokenPriceOnDemandLoading } = useTokenPrice({
        chainId: dstChainId || "",
        tokenAddress: dstTokenPriceAddr,
        enabled: Boolean(dstToken && dstChainId && !dstTokenPriceInCache),
    })

    const dstPricesMerged = useMemo(() => {
        const merged = { ...dstPrices?.[dstChainId || ""] }
        if (dstTokenPriceAddr && dstTokenPriceOnDemand) {
            merged[dstTokenPriceAddr.toLowerCase()] = { usd: dstTokenPriceOnDemand }
        }
        return merged
    }, [dstPrices, dstChainId, dstTokenPriceAddr, dstTokenPriceOnDemand])

    // Fetch individual token balances for selected tokens (ensures balance is available even if not in list)
    const { data: srcTokenBalance, isLoading: srcTokenBalanceLoading } = useTokenBalance({
        chainId: srcChainId || "",
        userAddress,
        tokenAddress: srcToken,
    })

    const { data: dstTokenBalance, isLoading: dstTokenBalanceLoading } = useTokenBalance({
        chainId: dstChainId || "",
        userAddress,
        tokenAddress: dstToken,
    })

    const debouncedAmount = useDebounce(amount, 1000)
    // Create stable keys for debounce to avoid array reference churn
    // These keys include chainId to handle native tokens correctly (same token name, different chain = different address)
    const srcKey = useMemo(() => `${srcChainId || ""}|${(srcToken || "").toLowerCase()}`, [srcChainId, srcToken])
    const dstKey = useMemo(() => `${dstChainId || ""}|${(dstToken || "").toLowerCase()}`, [dstChainId, dstToken])
    const debouncedSrcKey = useDebounce(srcKey, 1000)
    const debouncedDstKey = useDebounce(dstKey, 1000)

    const [quoting, setQuoting] = useState(false)
    const [quotes, setQuotes] = useState<Array<{ label: string; trade: GenericTrade }>>([])
    const toast = useToast()

    // Track previous keys to detect changes
    const prevSrcKeyRef = useRef<string>(srcKey)
    const prevDstKeyRef = useRef<string>(dstKey)

    // Clear quotes immediately when token/chain changes (before debounce completes)
    // This ensures UI feedback is immediate while still debouncing the actual fetch
    useEffect(() => {
        // If keys changed, clear quotes immediately
        if (prevSrcKeyRef.current !== srcKey || prevDstKeyRef.current !== dstKey) {
            // Only clear if we had quotes before
            if (quotes.length > 0) {
                setQuotes([])
            }
            prevSrcKeyRef.current = srcKey
            prevDstKeyRef.current = dstKey
        }
    }, [srcKey, dstKey, quotes.length])
    const [selectedQuoteIndex, setSelectedQuoteIndex] = useState(0)
    const selectedTrade = quotes[selectedQuoteIndex]?.trade
    const { slippage, setPriceImpact } = useSlippage()
    const [amountWei, setAmountWei] = useState<string | undefined>(undefined)

    // Use ref to track if a request is in progress to prevent duplicate calls
    const requestInProgressRef = useRef(false)
    const abortControllerRef = useRef<AbortController | null>(null)

    // Track last quoted key and schedule re-quote
    const lastQuotedKeyRef = useRef<string | null>(null)
    const lastQuotedAtRef = useRef<number>(0)
    const refreshTickRef = useRef<number>(0)
    const [refreshTick, setRefreshTick] = useState(0)
    const refreshTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
    const [txInProgress, setTxInProgress] = useState(false)

    // Quote on input changes (keep prior quote visible while updating)
    useEffect(() => {
        // Stop fetching quotes if transaction is in progress
        if (txInProgress) {
            console.debug("Skipping quote fetch: transaction in progress")
            return
        }

        const [sc, st] = [srcChainId, srcToken]
        const [dc, dt] = [dstChainId, dstToken]
        const amountOk = Boolean(debouncedAmount) && Number(debouncedAmount) > 0
        const inputsOk = Boolean(debouncedSrcKey && debouncedDstKey && sc && st && dc && dt && userAddress)

        if (!amountOk || !inputsOk) {
            setQuotes([])
            setQuoting(false)
            requestInProgressRef.current = false
            // Abort any pending request
            if (abortControllerRef.current) {
                abortControllerRef.current.abort()
                abortControllerRef.current = null
            }
            // Clear any scheduled refresh
            if (refreshTimeoutRef.current) {
                clearTimeout(refreshTimeoutRef.current)
                refreshTimeoutRef.current = null
            }
            return
        }

        // Prevent duplicate requests
        if (requestInProgressRef.current) {
            console.debug("Request already in progress, skipping...")
            return
        }

        // Prevent unnecessary re-quote if nothing changed and 30s not elapsed
        const currentKey = `${debouncedAmount}|${debouncedSrcKey}|${debouncedDstKey}|${slippage}|${userAddress || ""}`
        const now = Date.now()
        const sameAsLast = lastQuotedKeyRef.current === currentKey
        const elapsed = now - lastQuotedAtRef.current
        const isRefreshTrigger = refreshTickRef.current === refreshTick
        if (sameAsLast && elapsed < 30000 && isRefreshTrigger) {
            console.debug("Skipping re-quote: inputs unchanged and refresh interval not reached")
            return
        }

        // Abort previous request if any
        if (abortControllerRef.current) {
            abortControllerRef.current.abort()
        }

        let cancel = false
        requestInProgressRef.current = true
        setQuoting(true)

        // Create abort controller for this quote request
        const controller = new AbortController()
        abortControllerRef.current = controller

        // Clear any scheduled refresh while quoting
        if (refreshTimeoutRef.current) {
            clearTimeout(refreshTimeoutRef.current)
            refreshTimeoutRef.current = null
        }

        const fetchQuote = async () => {
            try {
                lastQuotedKeyRef.current = currentKey
                lastQuotedAtRef.current = Date.now()
                const fromCurrency = getCurrency(sc!, st!)
                const toCurrency = getCurrency(dc!, dt!)

                if (!fromCurrency || !toCurrency) {
                    throw new Error("Failed to convert tokens to SDK format")
                }

                const amountInWei = convertAmountToWei(debouncedAmount, fromCurrency.decimals)
                setAmountWei(amountInWei)
                const isSameChain = sc === dc

                console.debug("Fetching quote:", {
                    isSameChain,
                    chainId: sc,
                    fromCurrency: fromCurrency.symbol,
                    toCurrency: toCurrency.symbol,
                    amount: debouncedAmount,
                    amountInWei,
                    slippage,
                })

                let allQuotes: Array<{ label: string; trade: GenericTrade }> = []

                if (isSameChain) {
                    // Same-chain swap: get all aggregator quotes
                    const trades = await fetchAllAggregatorTrades(
                        sc!,
                        {
                            chainId: sc!,
                            fromCurrency,
                            toCurrency,
                            swapAmount: amountInWei,
                            slippage,
                            caller: userAddress!,
                            receiver: userAddress!,
                            tradeType: TradeType.EXACT_INPUT,
                            flashSwap: false,
                        },
                        controller
                    )
                    allQuotes = trades.map((t) => ({ label: t.aggregator.toString(), trade: t.trade }))
                } else {
                    // Cross-chain: build Axelar SimpleSquidCall[] for permit precompile (preferred)
                    let additionalCalls: Array<{ callType: 0; target: string; value?: bigint; callData: Hex }> | undefined
                    let destinationGasLimit: bigint | undefined
                    if (dc === SupportedChainId.MOONBEAM && attachedMessage) {
                        // Use the signed permit precompile call as the single destination call for Squid
                        additionalCalls = [
                            {
                                callType: 0, // DEFAULT
                                target: CALL_PERMIT_PRECOMPILE as Address,
                                value: (attachedValue ?? 0n) as any,
                                callData: attachedMessage as Hex,
                            },
                        ] as any
                        destinationGasLimit = attachedGasLimit
                    }

                    const bridgeTrades = await fetchAllBridgeTrades(
                        {
                            slippage,
                            tradeType: TradeType.EXACT_INPUT,
                            fromCurrency,
                            toCurrency,
                            swapAmount: amountInWei,
                            caller: userAddress!,
                            receiver: userAddress!,
                            order: "CHEAPEST",
                            usePermit: true,
                            // Prefer composed calls over message; message kept for backward-compat
                            ...(additionalCalls ? { additionalCalls } : attachedMessage ? { message: attachedMessage as string } : {}),
                            destinationGasLimit,
                        } as any,
                        controller
                    )
                    console.log("All bridges received from trade-sdk:", { bridges: bridgeTrades.map((t) => t.bridge), bridgeTrades })
                    allQuotes = bridgeTrades.map((t) => ({ label: t.bridge, trade: t.trade }))
                }

                if (cancel || controller.signal.aborted) {
                    console.debug("Request cancelled or aborted")
                    return
                }

                if (allQuotes.length > 0) {
                    console.debug("Quotes received:", allQuotes.length)
                    setQuotes(allQuotes)
                    setSelectedQuoteIndex(0)
                } else {
                    throw new Error("No quote available from any aggregator/bridge")
                }
            } catch (error) {
                if (cancel || controller.signal.aborted) {
                    console.debug("Request cancelled during error handling")
                    return
                }
                const errorMessage = error instanceof Error ? error.message : "Failed to fetch quote"
                toast.showError(errorMessage)
                setQuotes([])
                console.error("Quote fetch error:", error)
            } finally {
                if (!cancel && !controller.signal.aborted) {
                    setQuoting(false)
                }
                requestInProgressRef.current = false
                if (abortControllerRef.current === controller) {
                    abortControllerRef.current = null
                }
                // Schedule next refresh in 30s if inputs unchanged
                if (!cancel && !controller.signal.aborted) {
                    const scheduledKey = lastQuotedKeyRef.current
                    refreshTickRef.current = refreshTick + 1
                    refreshTimeoutRef.current = setTimeout(() => {
                        // Only trigger if inputs (keys) unchanged
                        if (scheduledKey === lastQuotedKeyRef.current) {
                            setRefreshTick((x) => x + 1)
                        }
                    }, 30000)
                }
            }
        }

        fetchQuote()

        return () => {
            cancel = true
            controller.abort()
            requestInProgressRef.current = false
            if (abortControllerRef.current === controller) {
                abortControllerRef.current = null
            }
            if (refreshTimeoutRef.current) {
                clearTimeout(refreshTimeoutRef.current)
                refreshTimeoutRef.current = null
            }
        }
    }, [debouncedAmount, debouncedSrcKey, debouncedDstKey, userAddress, slippage, refreshTick, txInProgress])

    const quoteOut = useMemo(() => {
        const trade = selectedTrade
        if (!trade?.outputAmount) return undefined
        try {
            // Use library conversion to exact string
            const exact = CurrencyHandler.toExact(trade.outputAmount)
            return formatDisplayAmount(exact)
        } catch {
            return undefined
        }
    }, [selectedTrade])

    // Calculate price impact from trade
    const priceImpact = useMemo(() => {
        if (!selectedTrade || !amount || !quoteOut || !srcToken || !dstToken || !srcChainId || !dstChainId) {
            return undefined
        }
        try {
            // Get token prices
            const srcPrice = getTokenPrice(srcChainId, srcToken, srcPricesMerged)
            const dstPrice = getTokenPrice(dstChainId, dstToken, dstPricesMerged)

            if (!srcPrice || !dstPrice) return undefined

            // Calculate expected output based on spot price
            const inputValue = Number(amount) * srcPrice
            const expectedOutput = inputValue / dstPrice

            // Actual output from trade
            const actualOutput = Number(quoteOut)

            if (expectedOutput <= 0 || actualOutput <= 0) return undefined

            // Price impact = (expected - actual) / expected * 100
            const impact = ((expectedOutput - actualOutput) / expectedOutput) * 100
            return Math.max(0, impact) // Ensure non-negative
        } catch {
            return undefined
        }
    }, [selectedTrade, amount, quoteOut, srcToken, dstToken, srcChainId, dstChainId, srcPrices, dstPrices])

    // Update price impact in context when it changes
    useEffect(() => {
        setPriceImpact(priceImpact)
    }, [priceImpact, setPriceImpact])

    // Preselect token on chain change: native or wrapped native if available
    useEffect(() => {
        if (!srcChainId) return
        const native = chains?.[srcChainId]?.data?.nativeCurrency?.symbol
        const force = srcChainId === "8453" ? "USDC" : undefined
        if (srcToken && srcTokensMap[srcToken.toLowerCase()]) return
        const pick = pickPreferredToken(srcTokensMap, force || native)
        if (pick) setSrcToken(pick as Address)
    }, [srcChainId, srcTokensMap, chains, srcToken])
    useEffect(() => {
        if (!dstChainId) return
        const native = chains?.[dstChainId]?.data?.nativeCurrency?.symbol
        const force = dstChainId === SupportedChainId.MOONBEAM ? "GLMR" : dstChainId === srcChainId ? "USDC" : undefined
        if (dstToken && dstTokensMap[dstToken.toLowerCase()]) return
        const pick = pickPreferredToken(dstTokensMap, force || native)
        if (pick) setDstToken(pick as Address)
    }, [dstChainId, dstTokensMap, chains, srcChainId, dstToken])

    const queryClient = useQueryClient()

    type PendingAction = {
        id: string
        config: DestinationActionConfig
        selector: Hex
        args: any[]
        value?: string
    }
    const [actions, setActions] = useState<PendingAction[]>([])

    const [attachedValue, setAttachedValue] = useState<bigint | undefined>(undefined)
    const { sendTransactionAsync: sendTestTransaction } = useSendTransaction()
    const [testTxHash, setTestTxHash] = useState<string | undefined>(undefined)
    const [testingDstCall, setTestingDstCall] = useState(false)
    const [sellModalOpen, setSellModalOpen] = useState(false)
    const [buyModalOpen, setBuyModalOpen] = useState(false)
    const [modalSellQuery, setModalSellQuery] = useState("")
    const [modalBuyQuery, setModalBuyQuery] = useState("")
    const [quotesExpanded, setQuotesExpanded] = useState(false)
    const permitBatch = usePermitBatch()
    const { fetchNonce } = permitBatch
    const { signTypedDataAsync } = useSignTypedData()
    const [attachedMessage, setAttachedMessage] = useState<Hex | undefined>(undefined)
    const [attachedGasLimit, setAttachedGasLimit] = useState<bigint | undefined>(undefined)

    const handleReset = useCallback(() => {
        setAmount("")
        setSrcToken(zeroAddress)
        setDstToken(zeroAddress)
        setSrcChainId(SupportedChainId.BASE)
        setDstChainId(SupportedChainId.MOONBEAM)
        setQuotes([])
        setSelectedQuoteIndex(0)
        setQuoting(false)
        setActions([])
        setAttachedMessage(undefined)
        setAttachedGasLimit(undefined)
        setAttachedValue(undefined)
        setTestTxHash(undefined)
        setTestingDstCall(false)
        // Abort any pending requests
        if (abortControllerRef.current) {
            abortControllerRef.current.abort()
            abortControllerRef.current = null
        }
        requestInProgressRef.current = false
    }, [])

    return (
        <div>
            <div className="relative">
                <div className="rounded-2xl #131313 p-4 shadow border border-[#1F1F1F] relative group">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <div className="text-sm opacity-70">Sell</div>
                            <button type="button" className="btn btn-xs btn-ghost" onClick={handleReset} title="Reset form">
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                        strokeWidth={2}
                                        d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                                    />
                                </svg>
                            </button>
                        </div>
                        <div className="absolute right-4 top-2 opacity-0 group-hover:opacity-100 transition-opacity z-10">
                            <div className="join">
                                {[25, 50, 75, 100].map((p) => (
                                    <button
                                        key={p}
                                        className="btn btn-xs join-item"
                                        onClick={() => {
                                            const bal =
                                                srcTokenBalance?.value ||
                                                (srcToken ? srcBalances?.[srcChainId || ""]?.[srcToken.toLowerCase()]?.value : undefined)
                                            const n = bal ? Number(bal) : 0
                                            setAmount(n > 0 ? ((n * p) / 100).toString() : "")
                                        }}
                                    >
                                        {p === 100 ? "Max" : `${p}%`}
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>
                    <div className="flex items-center gap-3 mt-1">
                        <input
                            className="input input-ghost text-4xl font-semibold flex-1 text-left border-0 focus:outline-none bg-transparent focus:bg-transparent p-0"
                            inputMode="decimal"
                            value={amount}
                            onChange={(e) => setAmount(filterNumeric(e.target.value))}
                            placeholder="0"
                        />
                        <div>
                            <button
                                className="btn btn-outline rounded-2xl flex items-center gap-2 border-[0.5px]"
                                onClick={() => setSellModalOpen(true)}
                            >
                                {srcToken && srcChainId ? (
                                    <>
                                        <Logo
                                            src={lists?.[srcChainId]?.[srcToken.toLowerCase()]?.logoURI}
                                            alt={lists?.[srcChainId]?.[srcToken.toLowerCase()]?.symbol || "Token"}
                                            size={20}
                                            fallbackText={lists?.[srcChainId]?.[srcToken.toLowerCase()]?.symbol || "T"}
                                        />
                                        <span>{lists?.[srcChainId]?.[srcToken.toLowerCase()]?.symbol || "Token"}</span>
                                    </>
                                ) : (
                                    <span>Select token</span>
                                )}
                            </button>
                        </div>
                    </div>
                    <div className="flex items-center justify-between text-xs mt-2">
                        <div className="opacity-70">
                            {(() => {
                                const price = srcToken && srcChainId ? getTokenPrice(srcChainId, srcToken, srcPricesMerged) : undefined
                                const usd = price && amount ? Number(amount) * price : undefined
                                return usd !== undefined ? `$${usd.toFixed(2)}` : "$0"
                            })()}
                        </div>
                        <div
                            className={`${
                                srcTokenBalance?.value && amount && Number(amount) > Number(srcTokenBalance?.value) ? "text-error" : "opacity-70"
                            }`}
                        >
                            {srcTokenBalance?.value
                                ? `${Number(srcTokenBalance.value).toFixed(4)} ${
                                      srcToken ? lists?.[srcChainId || ""]?.[srcToken.toLowerCase()]?.symbol || "" : ""
                                  }`
                                : ""}
                        </div>
                    </div>
                </div>
                <div className="flex justify-center -my-4 relative z-10">
                    <button
                        type="button"
                        className="btn rounded-2xl bg-[#1F1F1F] border-2 border-[#131313] shadow-lg hover:shadow-xl transition-shadow"
                        onClick={() => {
                            const sc = srcChainId
                            const st = srcToken
                            setSrcChainId(dstChainId)
                            setSrcToken(dstToken)
                            setDstChainId(sc)
                            setDstToken(st)
                        }}
                    >
                        ↕
                    </button>
                </div>
                <div className="rounded-2xl bg-[#1F1F1F] p-4 shadow ">
                    <div className="text-sm opacity-70">Buy</div>
                    <div className="flex items-center gap-3 mt-1">
                        <div className="text-4xl font-semibold flex-1 text-left">{quoteOut ?? "0"}</div>
                        <div>
                            <button
                                className="btn btn-outline rounded-2xl flex items-center gap-2 border-[0.5px]"
                                onClick={() => setBuyModalOpen(true)}
                            >
                                {dstToken && dstChainId ? (
                                    <>
                                        <Logo
                                            src={lists?.[dstChainId]?.[dstToken.toLowerCase()]?.logoURI}
                                            alt={lists?.[dstChainId]?.[dstToken.toLowerCase()]?.symbol || "Token"}
                                            size={20}
                                            fallbackText={lists?.[dstChainId]?.[dstToken.toLowerCase()]?.symbol || "T"}
                                        />
                                        <span>{lists?.[dstChainId]?.[dstToken.toLowerCase()]?.symbol || "Token"}</span>
                                    </>
                                ) : (
                                    <span>Select token</span>
                                )}
                            </button>
                        </div>
                    </div>
                    <div className="flex items-center justify-between text-xs mt-2">
                        <div className="opacity-70">
                            {(() => {
                                const price = dstToken && dstChainId ? getTokenPrice(dstChainId, dstToken, dstPricesMerged) : undefined
                                const usd = price && quoteOut ? Number(quoteOut) * price : undefined
                                return usd !== undefined ? `$${usd.toFixed(2)}` : "$0"
                            })()}
                        </div>
                        <div className="opacity-70">
                            {dstTokenBalance?.value
                                ? `${Number(dstTokenBalance.value).toFixed(4)} ${
                                      dstToken ? lists?.[dstChainId || ""]?.[dstToken.toLowerCase()]?.symbol || "" : ""
                                  }`
                                : ""}
                        </div>
                    </div>
                    {quotes.length > 0 && (
                        <div className="flex items-center justify-between text-xs mt-1 opacity-60">
                            <span>Max slippage</span>
                            <span>{slippage.toFixed(2)}%</span>
                        </div>
                    )}
                </div>
                {quotes.length > 0 ? (
                    <div className="rounded-2xl bg-base-200 p-4 shadow border border-base-300 mt-3">
                        {(() => {
                            const selectedQuote = quotes[selectedQuoteIndex]
                            const bestQuote = quotes[0]
                            const bestOutput = bestQuote.trade.outputAmountRealized
                            const selectedOutput = selectedQuote.trade.outputAmountRealized
                            const selectedRate = amount && Number(amount) > 0 ? selectedOutput / Number(amount) : 0
                            const srcSymbol = srcToken && srcChainId ? lists?.[srcChainId]?.[srcToken.toLowerCase()]?.symbol || "Token" : "Token"
                            const dstSymbol = selectedQuote.trade.outputAmount.currency.symbol
                            const isBest = selectedQuoteIndex === 0
                            const isBridge = srcChainId !== dstChainId
                            const getLogo = isBridge ? getBridgeLogo : getAggregatorLogo

                            return (
                                <>
                                    {/* Collapsed header - shows selected item */}
                                    <div
                                        className="w-full p-3 rounded border border-base-300 hover:border-primary transition-colors cursor-pointer"
                                        onClick={() => setQuotesExpanded(!quotesExpanded)}
                                    >
                                        <div className="flex items-center justify-between gap-3">
                                            <div className="flex items-center gap-2 flex-1">
                                                <div className="text-sm font-medium flex items-center gap-2">
                                                    {quoting && <span className="loading loading-spinner loading-xs" />}
                                                    <span>{selectedQuote.label}</span>
                                                </div>
                                                <div className="text-xs opacity-60">
                                                    1 {srcSymbol} = {selectedRate.toFixed(6)} {dstSymbol}
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <Logo
                                                    src={getLogo(selectedQuote.label)}
                                                    alt={selectedQuote.label}
                                                    size={20}
                                                    fallbackText={selectedQuote.label.slice(0, 2).toUpperCase()}
                                                />
                                                <span className="text-xs opacity-60">{quotesExpanded ? "▼" : "▶"}</span>
                                            </div>
                                        </div>
                                    </div>
                                    {/* Expanded list - shows all aggregators/bridges */}
                                    {quotesExpanded && (
                                        <div className="mt-2 space-y-2 max-h-[240px] overflow-y-auto">
                                            {quotes.map((q, idx) => {
                                                const output = q.trade.outputAmountRealized
                                                const rate = amount && Number(amount) > 0 ? output / Number(amount) : 0
                                                const isSelected = idx === selectedQuoteIndex
                                                const isBestQuote = idx === 0
                                                const diffPercent = bestOutput > 0 && idx > 0 ? ((output - bestOutput) / bestOutput) * 100 : 0
                                                const outputUsd =
                                                    dstToken && dstChainId
                                                        ? (() => {
                                                              const price = getTokenPrice(dstChainId, dstToken, dstPricesMerged)
                                                              return price ? output * price : undefined
                                                          })()
                                                        : undefined

                                                return (
                                                    <div
                                                        key={idx}
                                                        className={`flex items-center justify-between p-3 rounded border cursor-pointer transition-colors ${
                                                            isSelected ? "border-primary bg-primary/10" : "border-base-300 hover:border-primary/50"
                                                        }`}
                                                        onClick={() => {
                                                            setSelectedQuoteIndex(idx)
                                                            setQuotesExpanded(false)
                                                        }}
                                                    >
                                                        <div className="flex items-center gap-3 flex-1">
                                                            <Logo
                                                                src={getLogo(q.label)}
                                                                alt={q.label}
                                                                size={20}
                                                                fallbackText={q.label.slice(0, 2).toUpperCase()}
                                                            />
                                                            <div className="flex flex-col">
                                                                <div className="text-sm font-medium">
                                                                    {output.toFixed(6)} {dstSymbol}
                                                                </div>
                                                                {outputUsd !== undefined && (
                                                                    <div className="text-xs opacity-70">${outputUsd.toFixed(2)}</div>
                                                                )}
                                                            </div>
                                                        </div>
                                                        <div className="flex items-center gap-2">
                                                            {isBestQuote && <span className="badge badge-success text-xs">BEST</span>}
                                                            {diffPercent < 0 && <span className="text-xs text-error">{diffPercent.toFixed(2)}%</span>}
                                                            <div className="flex flex-col items-end">
                                                                <div className="text-sm font-medium">{q.label}</div>
                                                            </div>
                                                        </div>
                                                    </div>
                                                )
                                            })}
                                        </div>
                                    )}
                                </>
                            )
                        })()}
                    </div>
                ) : quoting ? (
                    <div className="rounded-2xl bg-base-200 p-4 shadow border border-base-300 mt-3">
                        <div className="flex items-center justify-center gap-2">
                            <span className="loading loading-spinner loading-sm" />
                            <span className="text-sm opacity-70">Fetching quotes...</span>
                        </div>
                    </div>
                ) : null}
            </div>
            {/* Selection Modals */}
            <TokenSelectorModal
                open={sellModalOpen}
                onClose={() => setSellModalOpen(false)}
                chainId={srcChainId}
                onChainChange={(cid: string) => {
                    setSrcChainId(cid)
                    setSrcToken(undefined)
                }}
                tokenValue={srcToken}
                onTokenChange={(addr: Address) => {
                    setSrcToken(addr)
                }}
                query={modalSellQuery}
                onQueryChange={setModalSellQuery}
                userAddress={userAddress}
            />
            <TokenSelectorModal
                open={buyModalOpen}
                onClose={() => setBuyModalOpen(false)}
                chainId={dstChainId}
                onChainChange={(cid: string) => {
                    setDstChainId(cid)
                    setDstToken(undefined)
                }}
                tokenValue={dstToken}
                onTokenChange={(addr: Address) => {
                    if (srcChainId === dstChainId && srcToken && addr.toLowerCase() === srcToken.toLowerCase()) return
                    setDstToken(addr)
                }}
                query={modalBuyQuery}
                onQueryChange={setModalBuyQuery}
                userAddress={userAddress}
                excludeAddresses={srcChainId === dstChainId && srcToken ? [srcToken] : []}
            />
            {dstChainId === SupportedChainId.MOONBEAM && (
                <div className="card bg-base-200 shadow-lg border border-primary/30 mt-4">
                    <div className="card-body">
                        <div className="font-medium mb-3">Moonbeam Actions</div>
                        <DestinationActionSelector
                            dstToken={dstToken}
                            dstChainId={dstChainId}
                            onAdd={(config, selector) => {
                                setActions((arr) => [...arr, { id: Math.random().toString(36).slice(2), config, selector, args: [] }])
                            }}
                        />
                        {actions.length > 0 && (
                            <div className="mt-4 flex justify-center">
                                <button
                                    className="btn btn-success"
                                    onClick={async () => {
                                        try {
                                            if (!userAddress) return
                                            // Must sign with Moonbeam chain id for EIP712 domain
                                            setIsEncoding(true)
                                            if (Number(currentChainId) !== moonbeam.id) {
                                                try {
                                                    await switchChainAsync({ chainId: moonbeam.id })
                                                } catch (e) {
                                                    toast.showError("Please switch to Moonbeam to encode actions.")
                                                    return
                                                }
                                            }
                                            // Build calls from actions
                                            const { encodeDestinationActions } = await import("../../lib/trade-helpers/destinationActions")
                                            const preCalls: Array<{ target: Address; value: bigint; callData: Hex; gasLimit: bigint }> = []
                                            for (const a of actions) {
                                                const meta = (a.config as any)?.meta || {}
                                                const mTokenAddr = a.config.address as Address
                                                if (meta.preApproveFromUnderlying) {
                                                    const underlyingAddr = (meta.underlying || "") as Address
                                                    const idx = typeof meta.preApproveAmountArgIndex === "number" ? meta.preApproveAmountArgIndex : 0
                                                    const amountArg = a.args?.[idx]
                                                    if (underlyingAddr && amountArg !== undefined) {
                                                        try {
                                                            const approveCalldata = encodeFunctionData({
                                                                abi: ERC20_ABI,
                                                                functionName: "approve",
                                                                args: [mTokenAddr, BigInt(String(amountArg))],
                                                            })
                                                            preCalls.push({
                                                                target: underlyingAddr,
                                                                value: 0n,
                                                                callData: approveCalldata as Hex,
                                                                gasLimit: BigInt(100000),
                                                            })
                                                        } catch {}
                                                    }
                                                }
                                                if (a.config.group === "lending" && meta.enterMarketBefore) {
                                                    try {
                                                        const { MOONWELL_COMPTROLLER } = await import("../../hooks/useMoonwellMarkets")
                                                        const enterData = encodeFunctionData({
                                                            abi: [
                                                                {
                                                                    inputs: [{ internalType: "address[]", name: "cTokens", type: "address[]" }],
                                                                    name: "enterMarkets",
                                                                    outputs: [{ internalType: "uint256[]", name: "", type: "uint256[]" }],
                                                                    stateMutability: "nonpayable",
                                                                    type: "function",
                                                                },
                                                            ] as any,
                                                            functionName: "enterMarkets",
                                                            args: [[mTokenAddr]],
                                                        })
                                                        preCalls.push({
                                                            target: MOONWELL_COMPTROLLER as Address,
                                                            value: 0n,
                                                            callData: enterData as Hex,
                                                            gasLimit: BigInt(150000),
                                                        })
                                                    } catch {}
                                                }
                                            }
                                            const encoded = encodeDestinationActions(
                                                actions.map((a) => ({
                                                    config: a.config,
                                                    selector: a.selector,
                                                    args: a.args,
                                                    value: a.value ? parseUnits(a.value, 18) : 0n,
                                                }))
                                            )
                                            const actionCalls = encoded.map((c) => ({
                                                target: c.target,
                                                value: c.value ?? 0n,
                                                callData: c.calldata as Hex,
                                                gasLimit: BigInt(250000),
                                            }))
                                            const calls = [...preCalls, ...actionCalls]
                                            // batch'em
                                            const batchData = permitBatch.createBatchData(calls as any)
                                            const gasLimit = BigInt(800000)
                                            const totalValue = calls.reduce((acc, c) => acc + (c.value ?? 0n), 0n)
                                            const deadline = BigInt(Math.floor(Date.now() / 1000) + 60 * 30)
                                            const currentNonce = await fetchNonce(userAddress, moonbeam.id)
                                            if (currentNonce === null) {
                                                throw new Error("Failed to fetch nonce for permit")
                                            }
                                            // EIP712 sign
                                            const typedData = {
                                                domain: {
                                                    name: "Call Permit Precompile",
                                                    version: "1",
                                                    chainId: moonbeam.id,
                                                    verifyingContract: CALL_PERMIT_PRECOMPILE,
                                                },
                                                types: {
                                                    CallPermit: [
                                                        { name: "from", type: "address" },
                                                        { name: "to", type: "address" },
                                                        { name: "value", type: "uint256" },
                                                        { name: "data", type: "bytes" },
                                                        { name: "gaslimit", type: "uint64" },
                                                        { name: "nonce", type: "uint256" },
                                                        { name: "deadline", type: "uint256" },
                                                    ],
                                                },
                                                primaryType: "CallPermit" as const,
                                                message: {
                                                    from: userAddress,
                                                    to: BATCH_PRECOMPILE,
                                                    value: totalValue,
                                                    data: batchData,
                                                    gaslimit: gasLimit,
                                                    nonce: currentNonce,
                                                    deadline,
                                                },
                                            }
                                            const signature = await signTypedDataAsync(typedData as any)
                                            const sig = signature.slice(2)
                                            const r = `0x${sig.slice(0, 64)}` as Hex
                                            const s = `0x${sig.slice(64, 128)}` as Hex
                                            const v = parseInt(sig.slice(128, 130), 16)
                                            const message = encodeFunctionData({
                                                abi: CALL_PERMIT_ABI as any,
                                                functionName: "dispatch",
                                                args: [userAddress, BATCH_PRECOMPILE, totalValue, batchData, gasLimit, deadline, v, r, s],
                                            }) as Hex
                                            try {
                                                console.log("Signed destination actions (Moonbeam)", {
                                                    calls: calls.map((c) => ({
                                                        target: c.target,
                                                        value: c.value.toString(),
                                                        gasLimit: c.gasLimit.toString(),
                                                        callData: `${(c.callData as string).slice(0, 18)}...`,
                                                    })),
                                                    batch: {
                                                        gasLimit: gasLimit.toString(),
                                                        deadline: Number(deadline),
                                                        data: `${batchData.slice(0, 18)}...`,
                                                    },
                                                    signature: { v, r, s },
                                                    message: `${message.slice(0, 18)}...`,
                                                })
                                            } catch {}
                                            setAttachedMessage(message)
                                            setAttachedGasLimit(gasLimit)
                                            setAttachedValue(totalValue)
                                            // trigger re-quote
                                            setRefreshTick((x) => x + 1)
                                        } catch (e) {
                                            console.error("Failed to encode and attach message:", e)
                                            toast.showError("Failed to encode actions for permit")
                                        } finally {
                                            setIsEncoding(false)
                                        }
                                    }}
                                >
                                    Encode
                                </button>
                            </div>
                        )}
                        {attachedMessage && dstChainId && (
                            <div className="mt-3 p-3 rounded border border-base-300">
                                <div className="flex items-center justify-between">
                                    <div className="text-sm opacity-70">Destination composed call tester</div>
                                    <button
                                        className={`btn btn-sm ${testingDstCall ? "btn-disabled" : "btn-outline"}`}
                                        onClick={async () => {
                                            if (!attachedMessage || !dstChainId) return
                                            try {
                                                setIsEncoding(true)
                                                setTestingDstCall(true)
                                                setTestTxHash(undefined)
                                                if (Number(currentChainId) !== moonbeam.id) {
                                                    await switchChainAsync({ chainId: moonbeam.id })
                                                }
                                                const txHash = await sendTestTransaction({
                                                    to: CALL_PERMIT_PRECOMPILE as Address,
                                                    data: attachedMessage as Hex,
                                                    value: (attachedValue ?? 0n) as any,
                                                })
                                                setTestTxHash(txHash as any)
                                            } catch (e: any) {
                                                toast.showError(e?.message || "Failed to send destination call")
                                            } finally {
                                                setTestingDstCall(false)
                                                setIsEncoding(false)
                                            }
                                        }}
                                    >
                                        {testingDstCall ? "Sending..." : "Test destination call"}
                                    </button>
                                </div>
                                {testTxHash && (
                                    <div className="mt-2 text-xs">
                                        <div>Tx: {testTxHash}</div>
                                    </div>
                                )}
                            </div>
                        )}
                        {actions.length > 0 && (
                            <div className="mt-4 space-y-3">
                                {actions.map((a, idx) => (
                                    <ActionEditor
                                        key={a.id}
                                        action={a}
                                        canMoveUp={idx > 0}
                                        canMoveDown={idx < actions.length - 1}
                                        onChange={(next) => setActions((arr) => arr.map((x) => (x.id === a.id ? next : x)))}
                                        onRemove={() => setActions((arr) => arr.filter((x) => x.id !== a.id))}
                                        onMoveUp={() =>
                                            setActions((arr) => {
                                                const copy = [...arr]
                                                const i = copy.findIndex((x) => x.id === a.id)
                                                if (i > 0) {
                                                    const tmp = copy[i - 1]
                                                    copy[i - 1] = copy[i]
                                                    copy[i] = tmp
                                                }
                                                return copy
                                            })
                                        }
                                        onMoveDown={() =>
                                            setActions((arr) => {
                                                const copy = [...arr]
                                                const i = copy.findIndex((x) => x.id === a.id)
                                                if (i >= 0 && i < copy.length - 1) {
                                                    const tmp = copy[i + 1]
                                                    copy[i + 1] = copy[i]
                                                    copy[i] = tmp
                                                }
                                                return copy
                                            })
                                        }
                                    />
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            )}
            {quotes.length > 0 && selectedTrade && (
                <div className="mt-4">
                    <ExecuteButton
                        trade={selectedTrade}
                        srcChainId={srcChainId}
                        dstChainId={dstChainId}
                        userAddress={userAddress}
                        srcToken={srcToken}
                        amountWei={amountWei}
                        actions={actions}
                        permit={permitBatch}
                        chains={chains}
                        onDone={(hashes) => {
                            // Invalidate all balance queries for src/dst chains and tokens
                            if (srcChainId && userAddress) {
                                queryClient.invalidateQueries({
                                    queryKey: ["balances", srcChainId, userAddress],
                                })
                                queryClient.invalidateQueries({
                                    queryKey: ["tokenBalance", srcChainId, userAddress],
                                })
                            }
                            if (dstChainId && userAddress) {
                                queryClient.invalidateQueries({
                                    queryKey: ["balances", dstChainId, userAddress],
                                })
                                queryClient.invalidateQueries({
                                    queryKey: ["tokenBalance", dstChainId, userAddress],
                                })
                            }
                        }}
                        onTransactionStart={() => {
                            setTxInProgress(true)
                            // Abort any pending quote requests
                            if (abortControllerRef.current) {
                                abortControllerRef.current.abort()
                                abortControllerRef.current = null
                            }
                            // Clear any scheduled refresh
                            if (refreshTimeoutRef.current) {
                                clearTimeout(refreshTimeoutRef.current)
                                refreshTimeoutRef.current = null
                            }
                            requestInProgressRef.current = false
                        }}
                        onReset={() => {
                            setAmount("")
                            setQuotes([])
                            setSelectedQuoteIndex(0)
                            setQuoting(false)
                            setTxInProgress(false)
                        }}
                        onResetStateChange={onResetStateChange}
                    />
                </div>
            )}
        </div>
    )
}

// Helper function to get aggregator logo URL
function getAggregatorLogo(aggregatorName: string): string {
    // Normalize aggregator name for URL (lowercase, handle special cases)
    const normalizedName = aggregatorName.toLowerCase().replace(/\s+/g, "-")
    return `https://raw.githubusercontent.com/1delta-DAO/protocol-icons/refs/heads/main/aggregator/${normalizedName}.webp`
}

function getBridgeLogo(bridgeName: string): string {
    const normalizedName = bridgeName.toLowerCase().replace(/\s+/g, "-")
    return `https://raw.githubusercontent.com/1delta-DAO/protocol-icons/refs/heads/main/bridge/${normalizedName}.webp`
}

function filterNumeric(s: string): string {
    // Allow digits and a single dot; mimic numeric validation in Transactions
    s = s.replace(/[^0-9.]/g, "")
    const parts = s.split(".")
    if (parts.length <= 1) return s
    return parts[0] + "." + parts.slice(1).join("").replace(/\./g, "")
}

function ExplorerLink({ chains, chainId, tokenAddress }: { chains?: any; chainId: string; tokenAddress: Address }) {
    const href = chains ? buildTokenUrl(chains, chainId, tokenAddress) : undefined
    if (!href) return null
    return (
        <a href={href} target="_blank" rel="noreferrer" className="link link-primary mt-1 inline-block">
            View on explorer
        </a>
    )
}

function pickPreferredToken(map: Record<string, any>, native?: string): string | undefined {
    const entries = Object.entries(map)
    if (!entries.length) return undefined
    if (native) {
        const found = entries.find(([, t]) => t.symbol?.toUpperCase() === native.toUpperCase())
        if (found) return found[0]
        const wrapped = entries.find(([, t]) => t.symbol?.toUpperCase() === `W${native.toUpperCase()}`)
        if (wrapped) return wrapped[0]
    }
    return entries[0][0]
}

function SlippageAndAmount({
    balance,
    amount,
    onAmount,
    slippage,
    onSlippageChange,
}: {
    balance?: string
    amount: string
    onAmount: (v: string) => void
    slippage?: number
    onSlippageChange?: (v: number) => void
}) {
    const [slip, setSlip] = useState(slippage ?? 0.3)
    const presets = [0.05, 0.1, 0.3, 1]
    const numericBal = balance ? Number(balance) : 0
    const [pct, setPct] = useState(0)

    useEffect(() => {
        if (slippage !== undefined) {
            setSlip(slippage)
        }
    }, [slippage])

    const handleSlippageChange = (newSlippage: number) => {
        setSlip(newSlippage)
        onSlippageChange?.(newSlippage)
    }
    return (
        <div className="space-y-3">
            <div className="flex items-center justify-between">
                <div>
                    Max Slippage: <span className="font-semibold">{slip.toFixed(2)}%</span>
                </div>
                <div className="join">
                    <button className="btn btn-xs join-item" onClick={() => handleSlippageChange(0.3)}>
                        Auto
                    </button>
                    {presets.map((p) => (
                        <button key={p} className="btn btn-xs join-item" onClick={() => handleSlippageChange(p)}>
                            {p}%
                        </button>
                    ))}
                </div>
            </div>
            <div className="flex items-center gap-3">
                <input
                    className="range range-primary flex-1"
                    type="range"
                    min={0}
                    max={100}
                    value={pct}
                    onChange={(e) => {
                        const v = Number(e.target.value)
                        setPct(v)
                        if (numericBal > 0) onAmount((numericBal * (v / 100)).toString())
                    }}
                />
                <input className="input input-bordered w-24" value={pct} onChange={(e) => setPct(Number(e.target.value) || 0)} />
            </div>
        </div>
    )
}

function ExecuteButton({
    trade,
    srcChainId,
    dstChainId,
    userAddress,
    srcToken,
    amountWei,
    onDone,
    chains,
    onReset,
    onResetStateChange,
    onTransactionStart,
    actions,
    permit,
}: {
    trade: GenericTrade
    srcChainId?: string
    dstChainId?: string
    userAddress?: Address
    srcToken?: Address
    amountWei?: string
    onDone: (hashes: { src?: string; dst?: string }) => void
    chains?: ReturnType<typeof useChainsRegistry>["data"]
    onReset?: () => void
    onResetStateChange?: (showReset: boolean, resetCallback?: () => void) => void
    onTransactionStart?: () => void
    actions?: Array<{ id: string; config: DestinationActionConfig; selector: Hex; args: any[]; value?: string }>
    permit?: ReturnType<typeof usePermitBatch>
}) {
    const [step, setStep] = useState<"idle" | "approving" | "signing" | "broadcast" | "confirmed" | "error">("idle")
    const [srcHash, setSrcHash] = useState<string | undefined>()
    const [dstHash, setDstHash] = useState<string | undefined>()
    const [isConfirmed, setIsConfirmed] = useState(false)
    const [isBridgeComplete, setIsBridgeComplete] = useState(false)
    const [isBridgeTracking, setIsBridgeTracking] = useState(false)
    const [bridgeTrackingStopped, setBridgeTrackingStopped] = useState(false)
    const [error, setError] = useState<string | undefined>()
    const { sendTransactionAsync, isPending } = useSendTransaction()
    const { writeContractAsync } = useWriteContract()
    const publicClient = usePublicClient()

    const isBridge = useMemo(() => {
        return Boolean(srcChainId && dstChainId && srcChainId !== dstChainId)
    }, [srcChainId, dstChainId])

    const spender = (trade as any).approvalTarget || (trade as any).target
    const skipApprove = (trade as any).skipApprove || false

    const { data: currentAllowance } = useReadContract({
        address: srcToken && srcToken.toLowerCase() !== zeroAddress.toLowerCase() ? srcToken : undefined,
        abi: ERC20_ABI,
        functionName: "allowance",
        args: userAddress && spender ? [userAddress, spender] : undefined,
        query: {
            enabled: Boolean(srcToken && userAddress && spender && srcToken.toLowerCase() !== zeroAddress.toLowerCase() && !skipApprove),
        },
    })

    const needsApproval = useMemo(() => {
        if (!srcToken || srcToken.toLowerCase() === zeroAddress.toLowerCase() || !spender || skipApprove) {
            return false
        }
        if (!amountWei) return false
        if (currentAllowance === undefined) return true // Still loading, assume approval needed
        const requiredAmount = BigInt(amountWei)
        return currentAllowance < requiredAmount
    }, [srcToken, spender, amountWei, currentAllowance, skipApprove])

    useEffect(() => {
        const showReset = Boolean((isBridgeComplete || (!isBridge && isConfirmed)) && srcHash)
        const resetCallback =
            showReset && onReset
                ? () => {
                      setStep("idle")
                      setSrcHash(undefined)
                      setDstHash(undefined)
                      setIsConfirmed(false)
                      setIsBridgeComplete(false)
                      setIsBridgeTracking(false)
                      setBridgeTrackingStopped(false)
                      setError(undefined)
                      onReset()
                  }
                : undefined
        onResetStateChange?.(showReset, resetCallback)
    }, [isBridgeComplete, isBridge, isConfirmed, srcHash, onReset, onResetStateChange])

    // Extract transaction data from trade
    const getTransactionData = useCallback(async () => {
        if (!trade) return null
        if ("assemble" in trade && typeof (trade as any).assemble === "function") {
            const txData = await (trade as any).assemble()
            if (txData && "EVM" in txData) {
                return (txData as any).EVM
            }
        }
        if ("transaction" in trade && (trade as any).transaction) {
            return (trade as any).transaction
        }
        return null
    }, [trade])

    const execute = useCallback(async () => {
        if (!userAddress || !srcChainId) {
            setError("Missing required parameters")
            setStep("error")
            return
        }

        // Notify parent that transaction is starting to stop quote refetching
        onTransactionStart?.()

        try {
            setError(undefined)
            let approvalHash: Address | undefined

            if (
                needsApproval &&
                srcToken &&
                amountWei &&
                spender &&
                !(srcChainId === SupportedChainId.MOONBEAM && dstChainId === SupportedChainId.MOONBEAM && actions && actions.length > 0)
            ) {
                setStep("approving")
                approvalHash = await writeContractAsync({
                    address: srcToken,
                    abi: ERC20_ABI as any,
                    functionName: "approve",
                    args: [spender as Address, BigInt(amountWei)],
                })
                if (publicClient) {
                    await publicClient.waitForTransactionReceipt({ hash: approvalHash as any })
                }
            }

            setStep("signing")
            const txData = await getTransactionData()
            if (!txData || !txData.calldata || !txData.to) {
                throw new Error("Failed to get transaction data from trade")
            }

            // Same-chain Moonbeam with actions
            let hash: Address
            if (srcChainId === SupportedChainId.MOONBEAM && dstChainId === SupportedChainId.MOONBEAM && actions && actions.length > 0) {
                if (!permit?.executeSelfTransmit) {
                    setStep("broadcast")
                    hash = await sendTransactionAsync({
                        to: txData.to as Address,
                        data: txData.calldata as Hex,
                        value: txData.value ? BigInt(txData.value.toString()) : BigInt(0),
                    })
                } else {
                    // Build batch calls: optionally approve, then swap, then actions
                    const calls: Array<{ target: Address; value: bigint; callData: Hex; gasLimit: bigint }> = []
                    if (needsApproval && srcToken && amountWei && spender) {
                        const approveCalldata = encodeFunctionData({
                            abi: ERC20_ABI,
                            functionName: "approve",
                            args: [spender as Address, BigInt(amountWei)],
                        })
                        calls.push({
                            target: srcToken,
                            value: 0n,
                            callData: approveCalldata as Hex,
                            gasLimit: BigInt(100000),
                        })
                    }
                    // swap call from aggregator
                    calls.push({
                        target: txData.to as Address,
                        value: txData.value ? BigInt(txData.value.toString()) : 0n,
                        callData: txData.calldata as Hex,
                        gasLimit: BigInt(300000),
                    })
                    // encode user actions
                    try {
                        const { encodeDestinationActions } = await import("../../lib/trade-helpers/destinationActions")
                        const encoded = encodeDestinationActions(
                            actions.map((a) => ({
                                config: a.config,
                                selector: a.selector,
                                args: a.args,
                                value: a.value ? parseUnits(a.value, 18) : 0n,
                            }))
                        )
                        for (const c of encoded) {
                            calls.push({
                                target: c.target,
                                value: c.value ?? 0n,
                                callData: c.calldata as Hex,
                                gasLimit: BigInt(100000),
                            })
                        }
                    } catch (err) {
                        throw new Error("Failed to encode Moonbeam actions")
                    }
                    const deadline = BigInt(Math.floor(Date.now() / 1000) + 60 * 30)
                    setStep("broadcast")
                    const { hash: txHash } = await permit.executeSelfTransmit({
                        from: userAddress as Address,
                        calls,
                        deadline,
                    } as any)
                    hash = txHash as Address
                }
            } else {
                setStep("broadcast")
                hash = await sendTransactionAsync({
                    to: txData.to as Address,
                    data: txData.calldata as Hex,
                    value: txData.value ? BigInt(txData.value.toString()) : BigInt(0),
                })
            }
            setSrcHash(hash)
            setStep("confirmed")

            // Wait for confirmation asynchronously
            if (publicClient) {
                publicClient
                    .waitForTransactionReceipt({ hash: hash as any })
                    .then(() => {
                        setIsConfirmed(true)
                        onDone({ src: hash })

                        if (isBridge && trade?.crossChainParams) {
                            setIsBridgeTracking(true)
                            setBridgeTrackingStopped(false)
                            trackBridgeCompletion(trade, srcChainId!, dstChainId!, hash, (hashes) => {
                                setIsBridgeTracking(false)
                                setBridgeTrackingStopped(true)
                                if (hashes.dst) {
                                    setDstHash(hashes.dst)
                                    setIsBridgeComplete(true)
                                }
                                onDone(hashes)
                            })
                        }
                    })
                    .catch((err) => {
                        console.error("Error waiting for transaction receipt:", err)
                    })
            } else {
                onDone({ src: hash })

                if (isBridge && trade?.crossChainParams) {
                    setIsBridgeTracking(true)
                    setBridgeTrackingStopped(false)
                    trackBridgeCompletion(trade, srcChainId!, dstChainId!, hash, (hashes) => {
                        setIsBridgeTracking(false)
                        setBridgeTrackingStopped(true)
                        if (hashes.dst) {
                            setDstHash(hashes.dst)
                            setIsBridgeComplete(true)
                        }
                        onDone(hashes)
                    })
                }
            }
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : "Transaction failed"
            setError(errorMessage)
            setStep("error")
            console.error("Execution error:", err)
        }
    }, [
        needsApproval,
        srcToken,
        amountWei,
        spender,
        userAddress,
        srcChainId,
        writeContractAsync,
        getTransactionData,
        sendTransactionAsync,
        publicClient,
        onDone,
    ])

    const shouldShow = (name: "approving" | "signing" | "broadcast" | "confirmed") => {
        const order = ["approving", "signing", "broadcast", "confirmed"]
        const currentIdx = order.indexOf(step as any)
        const idx = order.indexOf(name)
        if (step === "error") return true
        if (step === "idle") return false
        return idx <= currentIdx
    }

    return (
        <div className="space-y-3">
            {step === "idle" && (
                <button className="btn btn-primary w-full" onClick={execute} disabled={isPending}>
                    {isBridge ? "Bridge" : "Swap"}
                </button>
            )}
            {error && (
                <div className="alert alert-error">
                    <span>{error}</span>
                </div>
            )}
            {step !== "idle" && !srcHash && (
                <div className="space-y-3">
                    <div className="flex items-center gap-4">
                        {needsApproval && shouldShow("approving") && (
                            <Step label="Approve token" status={step === "approving" ? "active" : step === "error" ? "error" : "done"} />
                        )}
                        {shouldShow("signing") && (
                            <Step
                                label={isBridge ? "Prepare bridge" : "Prepare swap"}
                                status={step === "signing" ? "active" : step === "error" ? "error" : step === "confirmed" ? "done" : "idle"}
                            />
                        )}
                        {shouldShow("broadcast") && (
                            <Step
                                label="Send tx"
                                status={step === "broadcast" ? "active" : step === "error" ? "error" : step === "confirmed" ? "done" : "idle"}
                            />
                        )}
                        {shouldShow("confirmed") && (
                            <Step label="Confirmed" status={step === "confirmed" ? "done" : step === "error" ? "error" : "idle"} />
                        )}
                    </div>
                </div>
            )}
            {srcHash && srcChainId && (
                <div className="space-y-2">
                    <div className="text-sm flex items-center gap-2">
                        <span>Source tx:</span>
                        <a
                            href={buildTransactionUrl(chains || {}, srcChainId, srcHash)}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="font-mono text-primary hover:underline"
                        >
                            {srcHash.slice(0, 4)}...{srcHash.slice(-4)}
                        </a>
                        {isConfirmed ? <span className="text-success">✓</span> : <span className="loading loading-spinner loading-xs"></span>}
                    </div>
                    {isBridge && dstChainId && (
                        <div className="text-sm flex items-center gap-2">
                            <span>Bridge status:</span>
                            {isBridgeComplete && dstHash ? (
                                <>
                                    <span className="text-success">Complete</span>
                                    <a
                                        href={buildTransactionUrl(chains || {}, dstChainId, dstHash)}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="font-mono text-primary hover:underline"
                                    >
                                        Dest: {dstHash.slice(0, 4)}...{dstHash.slice(-4)}
                                    </a>
                                    <span className="text-success">✓</span>
                                </>
                            ) : isBridgeTracking ? (
                                <>
                                    <span className="text-warning">In progress...</span>
                                    <span className="loading loading-spinner loading-xs"></span>
                                </>
                            ) : bridgeTrackingStopped && !isBridgeComplete ? (
                                <>
                                    <span className="text-warning">Status unknown</span>
                                    <span className="text-xs opacity-70">(Check destination chain)</span>
                                </>
                            ) : (
                                <>
                                    <span>Waiting for confirmation...</span>
                                    <span className="loading loading-spinner loading-xs"></span>
                                </>
                            )}
                        </div>
                    )}
                </div>
            )}
        </div>
    )
}

function Step({ label, status }: { label: string; status: "idle" | "active" | "done" | "error" }) {
    const icon = status === "done" ? "✅" : status === "error" ? "❌" : status === "active" ? "⏳" : "•"
    const cls = status === "error" ? "text-error" : status === "done" ? "text-success" : status === "active" ? "text-warning" : ""
    return (
        <div className={`flex items-center gap-1 ${cls}`}>
            <span>{icon}</span>
            <span className="text-sm">{label}</span>
        </div>
    )
}

function wait(ms: number) {
    return new Promise((res) => setTimeout(res, ms))
}

function getTokenPrice(chainId: string, tokenAddress: Address, prices?: Record<string, { usd: number }>): number | undefined {
    if (!prices) return undefined
    // For zero address (native), use wrapped native price
    if (tokenAddress.toLowerCase() === zeroAddress.toLowerCase()) {
        const wrapped = CurrencyHandler.wrappedAddressFromAddress(chainId, zeroAddress)
        return wrapped ? prices[(wrapped as string).toLowerCase()]?.usd : undefined
    }
    return prices[tokenAddress.toLowerCase()]?.usd
}

function formatDisplayAmount(val: string): string {
    // Normalize
    if (!val) return "0"
    const [intPartRaw, fracRaw = ""] = val.split(".")
    const intPart = intPartRaw.replace(/^0+/, "") || "0"
    const maxFrac = intPart.length >= 4 ? 2 : 10
    const frac = fracRaw.slice(0, maxFrac).replace(/0+$/, "")
    return frac ? `${intPart}.${frac}` : intPart
}

async function trackBridgeCompletion(
    trade: GenericTrade,
    srcChainId: string,
    dstChainId: string,
    srcHash: string,
    onDone: (hashes: { src?: string; dst?: string }) => void
) {
    if (!trade.crossChainParams) {
        onDone({ src: srcHash })
        return
    }

    try {
        const { getBridgeStatus } = await import("@1delta/trade-sdk")
        const { Bridge } = await import("@1delta/bridge-configs")

        const bridgeName = Object.values(Bridge).find((b) => b.toString() === trade.aggregator.toString()) || (trade.aggregator as any)

        const maxAttempts = 60
        const delayMs = 5000

        for (let attempt = 0; attempt < maxAttempts; attempt++) {
            try {
                const status = await getBridgeStatus(
                    bridgeName as any,
                    {
                        fromChainId: srcChainId,
                        toChainId: dstChainId,
                        fromHash: srcHash,
                    } as any,
                    trade.crossChainParams
                )

                const statusAny = status as any

                if (status?.toHash) {
                    console.debug("Bridge completed:", { srcHash, dstHash: status.toHash })
                    onDone({ src: srcHash, dst: status.toHash })
                    return
                }

                if (status?.code) {
                    const errorCode = status.code
                    const errorMessage = status?.message || "Bridge transaction failed"
                    console.error("Bridge failed:", errorCode, errorMessage)
                    onDone({ src: srcHash })
                    return
                }

                if (statusAny?.status === "FAILED" || statusAny?.status === "REVERTED") {
                    const errorCode = statusAny.status
                    const errorMessage = statusAny?.message || statusAny?.error || "Bridge transaction failed"
                    console.error("Bridge failed:", errorCode, errorMessage)
                    onDone({ src: srcHash })
                    return
                }

                if (statusAny?.status === "COMPLETED" && !status?.toHash) {
                    console.warn("Bridge status shows completed but no destination hash:", status)
                }
            } catch (err) {
                console.debug("Error checking bridge status:", err)
            }

            await new Promise((resolve) => setTimeout(resolve, delayMs))
        }

        console.warn("Bridge status check timeout, invalidating source chain balances only")
        onDone({ src: srcHash })
    } catch (err) {
        console.error("Error tracking bridge completion:", err)
        onDone({ src: srcHash })
    }
}

function SelectedTokenInfo({
    chains,
    chainId,
    tokenAddress,
    balance,
    price,
    balanceLoading,
    priceLoading,
}: {
    chains?: any
    chainId: string
    tokenAddress: Address
    balance?: string
    price?: number
    balanceLoading?: boolean
    priceLoading?: boolean
}) {
    const isNative = tokenAddress.toLowerCase() === zeroAddress.toLowerCase()
    const href = !isNative && chains ? buildTokenUrl(chains, chainId, tokenAddress) : undefined
    const usd = balance && price ? Number(balance) * price : undefined
    return (
        <div className="text-xs mt-1 flex items-center justify-between">
            <div className="opacity-70 flex items-center gap-2">
                Balance: {balanceLoading ? <span className="loading loading-spinner loading-xs" /> : balance ?? "-"}
            </div>
            <div className="flex items-center gap-3">
                {priceLoading ? (
                    <span className="loading loading-spinner loading-xs" />
                ) : usd !== undefined && isFinite(usd) ? (
                    <span>${usd.toFixed(2)}</span>
                ) : null}
                {href && (
                    <a href={href} target="_blank" rel="noreferrer" className="link link-primary">
                        Explorer
                    </a>
                )}
            </div>
        </div>
    )
}

function ActionEditor({
    action,
    onChange,
    onRemove,
    canMoveUp,
    canMoveDown,
    onMoveUp,
    onMoveDown,
}: {
    action: { id: string; config: DestinationActionConfig; selector: Hex; args: any[]; value?: string }
    onChange: (a: { id: string; config: DestinationActionConfig; selector: Hex; args: any[]; value?: string }) => void
    onRemove: () => void
    canMoveUp: boolean
    canMoveDown: boolean
    onMoveUp: () => void
    onMoveDown: () => void
}) {
    const fnAbi = useMemo(() => findFunctionBySelector(action.config.abi as Abi, action.selector), [action])
    const [localArgs, setLocalArgs] = useState<any[]>(action.args ?? [])
    const [localValue, setLocalValue] = useState<string>(action.value ?? "")
    useEffect(() => {
        onChange({ ...action, args: localArgs, value: localValue })
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [localArgs, localValue])
    return (
        <div className="card bg-base-200">
            <div className="card-body gap-2">
                <div className="flex items-center justify-between">
                    <div className="font-medium">{action.config.name}</div>
                    <div className="flex gap-2">
                        {canMoveUp && (
                            <button className="btn btn-xs" onClick={onMoveUp} aria-label="Move up">
                                ↑
                            </button>
                        )}
                        {canMoveDown && (
                            <button className="btn btn-xs" onClick={onMoveDown} aria-label="Move down">
                                ↓
                            </button>
                        )}
                        <button className="btn btn-xs btn-error" onClick={onRemove} aria-label="Remove">
                            Remove
                        </button>
                    </div>
                </div>
                {action.config.description && <div className="text-xs opacity-70">{action.config.description}</div>}
                {fnAbi ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                        {fnAbi.inputs?.map((inp: any, i: number) => (
                            <div className="form-control" key={i}>
                                <label className="label">
                                    <span className="label-text">
                                        {inp.name || `arg${i}`} ({inp.type})
                                    </span>
                                </label>
                                <input
                                    className="input input-bordered"
                                    value={localArgs[i] ?? ""}
                                    onChange={(e) =>
                                        setLocalArgs((arr) => {
                                            const copy = [...arr]
                                            copy[i] = e.target.value
                                            return copy
                                        })
                                    }
                                    placeholder={inp.type}
                                />
                                {/* Show humanized amount for lending actions (when decimals known) */}
                                {action.config.group === "lending" &&
                                    inp.type === "uint256" &&
                                    (() => {
                                        const dec = (action.config as any).meta?.decimals
                                        const raw = localArgs[i]
                                        if (!dec || raw === undefined || raw === "") return null
                                        try {
                                            const bn = BigInt(String(raw))
                                            const human = formatUnits(bn, dec)
                                            const sym = (action.config as any).meta?.symbol || ""
                                            return (
                                                <span className="label-text-alt opacity-70">
                                                    {human} {sym}
                                                </span>
                                            )
                                        } catch {
                                            return null
                                        }
                                    })()}
                            </div>
                        ))}
                        {fnAbi?.stateMutability === "payable" && (
                            <div className="form-control">
                                <label className="label">
                                    <span className="label-text">Value (ETH)</span>
                                </label>
                                <input
                                    className="input input-bordered"
                                    inputMode="decimal"
                                    placeholder="0"
                                    value={localValue}
                                    onChange={(e) => setLocalValue(e.target.value)}
                                />
                            </div>
                        )}
                    </div>
                ) : (
                    <div className="text-sm opacity-70">No ABI inputs found.</div>
                )}
            </div>
        </div>
    )
}

function findFunctionBySelector(abi: Abi, selector: Hex): any {
    const fns = (abi as any[]).filter((it: any) => it?.type === "function")
    const lowerSel = selector.toLowerCase()
    for (const fn of fns) {
        try {
            const sel = toFunctionSelector(fn as any)
            if (sel.toLowerCase() === lowerSel) return fn
        } catch {}
    }
    // Fallback to first function
    return fns[0]
}
