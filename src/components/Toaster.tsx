import { useEffect } from 'react'
import { useToastStore, type Toast, type ToastTone } from '@/state/toastStore'

// Toast host (T17). Renders the global toast stack bottom-center over every
// screen and auto-dismisses each toast after a few seconds. Mounted once in App.

const AUTO_DISMISS_MS = 5000

const TONE_CLASS: Record<ToastTone, string> = {
  info: 'border-slate-600 bg-slate-800 text-slate-100',
  success: 'border-emerald-600/60 bg-emerald-900/70 text-emerald-100',
  warn: 'border-amber-600/60 bg-amber-900/70 text-amber-100',
  error: 'border-red-600/60 bg-red-950/80 text-red-100',
}

const TONE_ICON: Record<ToastTone, string> = {
  info: 'ℹ',
  success: '✓',
  warn: '⚠',
  error: '⛔',
}

export function Toaster() {
  const toasts = useToastStore((s) => s.toasts)
  if (toasts.length === 0) return null

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-6 z-50 flex flex-col items-center gap-2 px-4">
      {toasts.map((toast) => (
        <ToastItem key={toast.id} toast={toast} />
      ))}
    </div>
  )
}

function ToastItem({ toast }: { toast: Toast }) {
  const dismiss = useToastStore((s) => s.dismiss)
  useEffect(() => {
    const timer = setTimeout(() => dismiss(toast.id), AUTO_DISMISS_MS)
    return () => clearTimeout(timer)
  }, [toast.id, dismiss])

  return (
    <div
      role="status"
      className={[
        'pointer-events-auto flex items-center gap-3 rounded-lg border px-4 py-2.5 text-sm shadow-lg backdrop-blur',
        TONE_CLASS[toast.tone],
      ].join(' ')}
    >
      <span aria-hidden>{TONE_ICON[toast.tone]}</span>
      <span>{toast.message}</span>
      <button
        type="button"
        onClick={() => dismiss(toast.id)}
        aria-label="Dismiss"
        className="ml-1 text-current opacity-60 transition hover:opacity-100"
      >
        ✕
      </button>
    </div>
  )
}
