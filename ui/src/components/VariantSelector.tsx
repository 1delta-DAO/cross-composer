import React from "react"

type Tab = "swap" | "transactions"

interface TabSelectorProps {
    activeTab: Tab
    onTabChange: (tab: Tab) => void
}

export default function TabSelector({ activeTab, onTabChange }: TabSelectorProps) {
    return (
        <div className="tabs tabs-boxed mb-8">
            <button
                className={`tab ${activeTab === "swap" ? "tab-active" : ""}`}
                onClick={() => onTabChange("swap")}
            >
                Swap
            </button>
            <button
                className={`tab ${activeTab === "transactions" ? "tab-active" : ""}`}
                onClick={() => onTabChange("transactions")}
            >
                Transactions
            </button>
        </div>
    )
}
