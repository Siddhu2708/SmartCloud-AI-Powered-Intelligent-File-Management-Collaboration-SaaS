'use client'

import { createContext, useCallback, useContext, useMemo, useState } from 'react'
import { AlertTriangle, CheckCircle2, Info, X, XCircle } from 'lucide-react'

type ToastType = 'success' | 'error' | 'warning' | 'info'

interface Toast {
  id: number
  type: ToastType
  message: string
}

interface ToastContextValue {
  toast: (message: string, type?: ToastType) => void
  success: (message: string) => void
  error: (message: string) => void
  warning: (message: string) => void
  info: (message: string) => void
}

const ToastContext = createContext<ToastContextValue | null>(null)

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])

  const remove = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id))
  }, [])

  const toast = useCallback((message: string, type: ToastType = 'info') => {
    const id = Date.now() + Math.random()
    setToasts((prev) => [...prev, { id, type, message }])
    window.setTimeout(() => remove(id), 4200)
  }, [remove])

  // Stable, memoised context value — same reference across renders so
  // consumers that list these in useCallback/useEffect deps don't re-fire.
  const value = useMemo<ToastContextValue>(() => ({
    toast,
    success: (message) => toast(message, 'success'),
    error:   (message) => toast(message, 'error'),
    warning: (message) => toast(message, 'warning'),
    info:    (message) => toast(message, 'info'),
  }), [toast])

  const icons: Record<ToastType, React.ReactNode> = {
    success: <CheckCircle2 className="w-5 h-5 text-green-500" />,
    error: <XCircle className="w-5 h-5 text-red-500" />,
    warning: <AlertTriangle className="w-5 h-5 text-amber-500" />,
    info: <Info className="w-5 h-5 text-blue-500" />,
  }

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="fixed right-4 top-4 z-[100] flex w-[min(22rem,calc(100vw-1.5rem))] flex-col gap-2">
        {toasts.map((t) => (
          <div
            key={t.id}
            role={t.type === 'error' ? 'alert' : 'status'}
            aria-live={t.type === 'error' ? 'assertive' : 'polite'}
            className="flex items-start gap-3 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-3.5 shadow-lg ring-1 ring-black/5 animate-in"
          >
            <span className="mt-0.5 shrink-0">{icons[t.type]}</span>
            <p className="flex-1 text-sm text-neutral-800 dark:text-neutral-200">{t.message}</p>
            <button
              type="button"
              aria-label="Dismiss notification"
              onClick={() => remove(t.id)}
              className="shrink-0 text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-300"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  )
}

export function useToast(): ToastContextValue {
  const context = useContext(ToastContext)

  if (!context) {
    throw new Error('useToast must be used within ToastProvider')
  }

  return context
}
