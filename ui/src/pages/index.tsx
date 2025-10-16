import { ConnectButton } from "@rainbow-me/rainbowkit"
import type { NextPage } from "next"
import { useState } from "react"
import { useAccount } from "wagmi"
import { type Hex } from "viem"
import VariantSelector from "../components/VariantSelector"
import BatchTransactionForm from "../components/BatchTransactionForm"
import RelayerInterface from "../components/RelayerInterface"

const Home: NextPage = () => {
    const { address, isConnected } = useAccount()
    const [variant, setVariant] = useState<"relayer" | "self-transmit">("relayer")
    const [signature, setSignature] = useState<{ v: number; r: Hex; s: Hex } | null>(null)
    const [batchData, setBatchData] = useState<Hex>("0x")
    const [nonce, setNonce] = useState<bigint>(BigInt(0))
    const [transactionHash, setTransactionHash] = useState<Hex | null>(null)

    const handleSignatureCreated = (sig: { v: number; r: Hex; s: Hex }, data: Hex, nonceValue: bigint) => {
        setSignature(sig)
        setBatchData(data)
        setNonce(nonceValue)
    }

    const handleTransactionExecuted = (hash: Hex) => {
        setTransactionHash(hash)
    }

    const handleReset = () => {
        setSignature(null)
        setBatchData("0x")
        setNonce(BigInt(0))
        setTransactionHash(null)
    }

    return (
        <div className="min-h-screen bg-base-200" data-theme="moonbeam">
            <div className="navbar bg-base-100 shadow-lg">
                <div className="flex flex-row p-2 flex-grow">
                    <div className="flex-1">
                        <div className="flex items-center space-x-2">
                            <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                                Moonbeamer
                            </h1>
                        </div>
                    </div>
                    <div className="flex-none">
                        <ConnectButton />
                    </div>
                </div>
            </div>

            <>
                <main className="max-w-7xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
                    {!isConnected ? (
                        <div className="hero min-h-[60vh]">
                            <div className="     flex flex-col items-center justify-center">
                                <h1 className="text-4xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent mb-4">
                                    Connect Your Wallet
                                </h1>
                                <ConnectButton />
                            </div>
                        </div>
                    ) : (
                        <div className="space-y-8">
                            <VariantSelector variant={variant} onVariantChange={setVariant} />

                            {signature && variant === "relayer" ? (
                                <RelayerInterface signature={signature} batchData={batchData} nonce={nonce} from={address!} onReset={handleReset} />
                            ) : transactionHash && variant === "self-transmit" ? (
                                <div className="card bg-base-100 shadow-2xl">
                                    <div className="card-body">
                                        <div className="flex items-center justify-between mb-6">
                                            <h2 className="card-title text-2xl">
                                                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path
                                                        strokeLinecap="round"
                                                        strokeLinejoin="round"
                                                        strokeWidth={2}
                                                        d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                                                    />
                                                </svg>
                                                Transaction Executed
                                            </h2>
                                            <div className="badge badge-success badge-lg">Success</div>
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
                                                                d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                                                            />
                                                        </svg>
                                                        Transaction Hash
                                                    </h3>
                                                    <div className="flex flex-row gap-2 items-center pt-2">
                                                        <button
                                                            onClick={() => () => navigator.clipboard.writeText(transactionHash)}
                                                            className="btn btn-square btn-primary btn-sm"
                                                        >
                                                            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                <path
                                                                    strokeLinecap="round"
                                                                    strokeLinejoin="round"
                                                                    strokeWidth={2}
                                                                    d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
                                                                />
                                                            </svg>
                                                        </button>
                                                        <p className="flex-1 font-mono text-s w-10/11 text-white border rounded-md p-2">
                                                            {transactionHash}
                                                        </p>

                                                        <a
                                                            href={`https://moonscan.io/tx/${transactionHash}`}
                                                            target="_blank"
                                                            rel="noopener noreferrer"
                                                            className="link link-primary text-s"
                                                        >
                                                            View on Moonscan →
                                                        </a>
                                                    </div>
                                                </div>
                                            </div>

                                            <div className="card-actions justify-between">
                                                <button onClick={handleReset} className="btn btn-outline btn-secondary">
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
                                                <button onClick={handleReset} className="btn btn-primary btn-lg">
                                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                                                    </svg>
                                                    Create New Transaction
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            ) : (
                                <BatchTransactionForm
                                    onSignatureCreated={handleSignatureCreated}
                                    onTransactionExecuted={handleTransactionExecuted}
                                    variant={variant}
                                />
                            )}
                        </div>
                    )}
                </main>
            </>
        </div>
    )
}

export default Home
