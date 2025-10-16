import React from "react"

interface VariantSelectorProps {
    variant: "relayer" | "self-transmit"
    onVariantChange: (variant: "relayer" | "self-transmit") => void
}

export default function VariantSelector({ variant, onVariantChange }: VariantSelectorProps) {
    return (
        <div className="mb-8">
            <h2 className="text-2xl font-bold text-center mb-8 bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">
                Choose Transaction Mode
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div
                    className={`card bg-base-100 shadow-xl cursor-pointer transition-all duration-300 hover:scale-105 ${
                        variant === "relayer" ? "ring-2 ring-primary" : "hover:shadow-2xl"
                    }`}
                    onClick={() => onVariantChange("relayer")}
                >
                    <div className="card-body">
                        <div className="flex items-center mb-4">
                            <input
                                type="radio"
                                name="variant"
                                className="radio radio-primary"
                                checked={variant === "relayer"}
                                onChange={() => onVariantChange("relayer")}
                            />
                            <div className="ml-4 flex flex-row gap-4">
                                <h3 className="text-xl font-bold text-primary">Relayer Mode</h3>
                                <div className="badge badge-primary badge-sm">Gasless</div>
                            </div>
                        </div>
                        <p className="text-base-content/70 mb-4">Submit by a relayer.</p>
                    </div>
                </div>

                <div
                    className={`card bg-base-100 shadow-xl cursor-pointer transition-all duration-300 hover:scale-105 ${
                        variant === "self-transmit" ? "ring-2 ring-primary" : "hover:shadow-2xl"
                    }`}
                    onClick={() => onVariantChange("self-transmit")}
                >
                    <div className="card-body">
                        <div className="flex items-center mb-4">
                            <input
                                type="radio"
                                name="variant"
                                className="radio radio-primary"
                                checked={variant === "self-transmit"}
                                onChange={() => onVariantChange("self-transmit")}
                            />
                            <div className="ml-4 flex flex-row gap-4">
                                <h3 className="text-xl font-bold text-secondary">Self-Transmit Mode</h3>
                                <div className="badge badge-secondary badge-sm">Direct</div>
                            </div>
                        </div>
                        <p className="text-base-content/70 mb-4">Submit yourself.</p>
                    </div>
                </div>
            </div>
        </div>
    )
}
