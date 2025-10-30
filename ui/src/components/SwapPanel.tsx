import React, { useState } from "react"
import { Address } from "viem"
import SwapTokenSelector from "./SwapTokenSelector"

interface SwapPanelProps {
    onQuoteReady?: (fromChain: string, fromToken: Address, toChain: string, toToken: Address, amount: string) => void
}

export default function SwapPanel({ onQuoteReady }: SwapPanelProps) {
    const [fromChain, setFromChain] = useState<string>("")
    const [fromToken, setFromToken] = useState<Address | undefined>()
    const [toChain, setToChain] = useState<string>("1284") // Moonbeam by default
    const [toToken, setToToken] = useState<Address | undefined>()
    const [amount, setAmount] = useState<string>("")

    const handleGetQuote = () => {
        if (fromChain && fromToken && toChain && toToken && amount) {
            onQuoteReady?.(fromChain, fromToken, toChain, toToken, amount)
        }
    }

    const canGetQuote = fromChain && fromToken && toChain && toToken && amount

    return (
        <div className="card bg-base-100 shadow-xl">
            <div className="card-body">
                <h2 className="card-title text-2xl mb-4">Swap</h2>
                <div className="space-y-4">
                    <SwapTokenSelector
                        chainId={fromChain}
                        tokenAddress={fromToken}
                        onChainChange={setFromChain}
                        onTokenChange={setFromToken}
                        label="From"
                    />
                    <div className="flex justify-center">
                        <button 
                            className="btn btn-circle btn-sm" 
                            onClick={() => {
                                const tempChain = fromChain
                                const tempToken = fromToken
                                setFromChain(toChain)
                                setFromToken(toToken)
                                setToChain(tempChain)
                                setToToken(tempToken)
                            }}
                            disabled={!fromChain || !toChain}
                        >
                            ⇅
                        </button>
                    </div>
                    <SwapTokenSelector
                        chainId={toChain}
                        tokenAddress={toToken}
                        onChainChange={setToChain}
                        onTokenChange={setToToken}
                        label="To (Moonbeam)"
                    />
                    <div className="form-control">
                        <label className="label">
                            <span className="label-text font-medium">Amount</span>
                        </label>
                        <input
                            type="text"
                            value={amount}
                            onChange={(e) => setAmount(e.target.value)}
                            placeholder="0.0"
                            className="input input-bordered w-full"
                        />
                    </div>
                    <button 
                        onClick={handleGetQuote} 
                        className="btn btn-primary w-full" 
                        disabled={!canGetQuote}
                    >
                        Get Quote
                    </button>
                </div>
            </div>
        </div>
    )
}

