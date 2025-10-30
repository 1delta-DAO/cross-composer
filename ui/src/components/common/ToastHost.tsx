import React from "react"

type Toast = { id: number; message: string }

const ToastContext = React.createContext<(msg: string) => void>(() => {})

export function ToastProvider({ children }: { children: React.ReactNode }) {
    const [toasts, setToasts] = React.useState<Toast[]>([])
    const show = React.useCallback((message: string) => {
        const id = Date.now() + Math.random()
        setToasts((t) => [...t, { id, message }])
        setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 3000)
    }, [])
    return (
        <ToastContext.Provider value={show}>
            {children}
            <div className="toast toast-end">
                {toasts.map((t) => (
                    <div key={t.id} className="alert alert-info">
                        <span>{t.message}</span>
                    </div>
                ))}
            </div>
        </ToastContext.Provider>
    )
}

export function useToast() {
    return React.useContext(ToastContext)
}


