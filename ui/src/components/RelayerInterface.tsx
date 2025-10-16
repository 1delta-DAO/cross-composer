import React, { useState } from "react"
import { type Address, createWalletClient, type Hex, http, parseEther } from "viem"
import { BATCH_PRECOMPILE } from "../lib/consts"
import { privateKeyToAccount } from "viem/accounts"
import { moonbeam } from "viem/chains"
import { getRpcUrl } from "../lib/clients"

interface RelayerInterfaceProps {
    signature: { v: number; r: Hex; s: Hex } | null
    batchData: Hex
    nonce: bigint
    from: Address
    onReset: () => void
}

export default function RelayerInterface({ signature, batchData, nonce, from, onReset }: RelayerInterfaceProps) {
    const [isSubmitting, setIsSubmitting] = useState(false)
    const [result, setResult] = useState<{ success: boolean; message: string; txHash?: string } | null>(null)

    const handleRelayerSubmit = async () => {
        if (!signature) {
            setResult({ success: false, message: "No signature available" })
            return
        }

        const relayerPrivateKey = process.env.NEXT_PUBLIC_RELAYER_PRIVATE_KEY
        if (!relayerPrivateKey) {
            setResult({ success: false, message: "Relayer private key not configured" })
            return
        }

        setIsSubmitting(true)
        setResult(null)

        try {
            const relayerAccount = privateKeyToAccount(relayerPrivateKey as Hex)
            const client = createWalletClient({
                chain: moonbeam,
                transport: http(getRpcUrl()),
                account: relayerAccount,
            })
            const tx = await client.sendTransaction({
                to: BATCH_PRECOMPILE,
                value: parseEther("0"),
                data: batchData as Hex,
                gas: 800000n,
            })

            setResult({
                success: true,
                message: `Transaction submitted successfully!`,
                txHash: tx,
            })
        } catch (error) {
            console.error("Relayer submission error:", error)
            setResult({
                success: false,
                message: `Relayer submission failed: ${error instanceof Error ? error.message : "Unknown error"}`,
            })
        } finally {
            setIsSubmitting(false)
        }
    }

    const copyToClipboard = (text: string) => {
        navigator.clipboard.writeText(text)
    }

    if (!signature) {
        return null
    }

    return (
        <div className="card bg-base-100 shadow-2xl">
            <div className="card-body">
                <div className="flex items-center justify-between mb-6">
                    <h2 className="card-title text-2xl">
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        Relayer Submission
                    </h2>
                    <div className="badge badge-success badge-lg">Signature Ready</div>
                </div>

                <div className="space-y-6">
                    <div className="card bg-base-200 shadow-md">
                        <div className="card-body">
                            <h3 className="card-title text-lg">
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                        strokeWidth={2}
                                        d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"
                                    />
                                </svg>
                                Signature Data
                            </h3>
                            <div className="space-y-3">
                                <div className="form-control">
                                    <label className="label">
                                        <span className="label-text font-medium">v</span>
                                    </label>
                                    <div className="input-group">
                                        <input
                                            type="text"
                                            value={signature.v}
                                            readOnly
                                            className="input input-bordered flex-1 font-mono text-sm mr-4"
                                        />
                                        <button onClick={() => copyToClipboard(signature.v.toString())} className="btn btn-square btn-primary">
                                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path
                                                    strokeLinecap="round"
                                                    strokeLinejoin="round"
                                                    strokeWidth={2}
                                                    d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
                                                />
                                            </svg>
                                        </button>
                                    </div>
                                </div>
                                <div className="form-control">
                                    <label className="label">
                                        <span className="label-text font-medium">r</span>
                                    </label>
                                    <div className="input-group">
                                        <input
                                            type="text"
                                            value={signature.r}
                                            readOnly
                                            className="input input-bordered flex-1 font-mono text-sm mr-4"
                                        />
                                        <button onClick={() => copyToClipboard(signature.r)} className="btn btn-square btn-primary">
                                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path
                                                    strokeLinecap="round"
                                                    strokeLinejoin="round"
                                                    strokeWidth={2}
                                                    d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
                                                />
                                            </svg>
                                        </button>
                                    </div>
                                </div>
                                <div className="form-control">
                                    <label className="label">
                                        <span className="label-text font-medium">s</span>
                                    </label>
                                    <div className="input-group">
                                        <input
                                            type="text"
                                            value={signature.s}
                                            readOnly
                                            className="input input-bordered flex-1 font-mono text-sm mr-4"
                                        />
                                        <button onClick={() => copyToClipboard(signature.s)} className="btn btn-square btn-primary ">
                                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path
                                                    strokeLinecap="round"
                                                    strokeLinejoin="round"
                                                    strokeWidth={2}
                                                    d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
                                                />
                                            </svg>
                                        </button>
                                    </div>
                                </div>
                                <div className="form-control">
                                    <label className="label">
                                        <span className="label-text font-medium">Nonce</span>
                                    </label>
                                    <div>
                                        <input type="text" value={nonce.toString()} readOnly className="input input-bordered font-mono text-sm" />
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="card bg-base-200 shadow-md">
                        <div className="card-body">
                            <h3 className="card-title text-lg">
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                        strokeWidth={2}
                                        d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                                    />
                                </svg>
                                Batch Data
                            </h3>
                            <div className="form-control">
                                <div className="input-group w-full">
                                    <input
                                        type="text"
                                        value={batchData}
                                        readOnly
                                        className="input input-bordered flex-1 font-mono text-xs mr-4 w-10/11"
                                    />
                                    <button onClick={() => copyToClipboard(batchData)} className="btn btn-square btn-primary">
                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path
                                                strokeLinecap="round"
                                                strokeLinejoin="round"
                                                strokeWidth={2}
                                                d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
                                            />
                                        </svg>
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="card bg-base-200 shadow-md">
                        <div className="card-body">
                            <h3 className="card-title text-lg">
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                        strokeWidth={2}
                                        d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                                    />
                                </svg>
                                Transaction Details
                            </h3>
                            <div className="stats stats-vertical lg:stats-horizontal shadow">
                                <div className="stat">
                                    <div className="stat-title">From</div>
                                    <div className="stat-desc font-mono text-xs">{from}</div>
                                </div>
                                <div className="stat">
                                    <div className="stat-title">To</div>
                                    <div className="stat-desc font-mono text-xs">0x0000000000000000000000000000000000000808</div>
                                </div>
                                <div className="stat">
                                    <div className="stat-title">Value</div>
                                    <div className="stat-value text-primary text-sm">0 ETH</div>
                                </div>
                                <div className="stat">
                                    <div className="stat-title">Gas Limit</div>
                                    <div className="stat-value text-secondary text-sm">800,000</div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {result && (
                        <div className={`alert ${result.success ? "alert-success" : "alert-error"}`}>
                            {result.success ? (
                                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                        strokeWidth={2}
                                        d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                                    />
                                </svg>
                            ) : (
                                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                        strokeWidth={2}
                                        d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                                    />
                                </svg>
                            )}
                            <div className="flex flex-col">
                                <span>{result.message}</span>
                                {result.txHash && (
                                    <div className="mt-2 w-full">
                                        <div className="text-sm font-medium">Transaction Hash:</div>
                                        <div className="flex flex-row gap-2 items-center pt-2">
                                            <button onClick={() => copyToClipboard(result.txHash!)} className="btn btn-square btn-primary btn-sm">
                                                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path
                                                        strokeLinecap="round"
                                                        strokeLinejoin="round"
                                                        strokeWidth={2}
                                                        d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
                                                    />
                                                </svg>
                                            </button>
                                            <p className="flex-1 font-mono text-s w-10/11 text-white border rounded-md p-2">{result.txHash}</p>

                                            <a
                                                href={`https://moonscan.io/tx/${result.txHash}`}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="link link-primary text-s"
                                            >
                                                View on Moonscan →
                                            </a>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    <div className="card-actions justify-between">
                        <button onClick={onReset} className="btn btn-outline btn-secondary">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeWidth={2}
                                    d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                                />
                            </svg>
                            Reset
                        </button>
                        {!result && (
                            <button
                                onClick={handleRelayerSubmit}
                                disabled={isSubmitting}
                                className={`btn btn-primary btn-lg ${isSubmitting ? "loading" : ""}`}
                            >
                                {isSubmitting ? (
                                    "Submitting to Relayer..."
                                ) : (
                                    <>
                                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                                        </svg>
                                        Submit to Relayer
                                    </>
                                )}
                            </button>
                        )}
                    </div>

                    <div className="alert alert-info">
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                            />
                        </svg>
                        <div>
                            <h4 className="font-bold">Instructions</h4>
                            <p className="text-sm">
                                The relayer will submit the transaction directly using the configured private key. Make sure to set the
                                RELAYER_PRIVATE_KEY environment variable with a valid private key that has sufficient funds to cover gas fees.
                            </p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}
