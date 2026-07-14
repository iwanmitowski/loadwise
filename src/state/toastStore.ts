import { create } from 'zustand'

// Minimal global toast/banner primitive (T17) — no library. Transient,
// user-facing notices (e.g. "Plan needs 2 trips"). Timers live in the <Toaster>
// host, not here, so the store stays a plain data holder.

export type ToastTone = 'info' | 'warn' | 'error' | 'success'

export type Toast = {
  id: string
  message: string
  tone: ToastTone
}

export type ToastState = {
  toasts: Toast[]
  /** Queue a toast; returns its id. Deduplicates against an identical live toast. */
  show(message: string, tone?: ToastTone): string
  dismiss(id: string): void
  clear(): void
}

export const useToastStore = create<ToastState>((set, get) => ({
  toasts: [],
  show: (message, tone = 'info') => {
    // Skip if an identical toast is already on screen (avoids double-fire from
    // React StrictMode / rapid re-runs).
    const existing = get().toasts.find((t) => t.message === message && t.tone === tone)
    if (existing) return existing.id
    // UI-layer id — crypto.randomUUID is allowed outside the domain layer.
    const id = crypto.randomUUID()
    set((state) => ({ toasts: [...state.toasts, { id, message, tone }] }))
    return id
  },
  dismiss: (id) => set((state) => ({ toasts: state.toasts.filter((t) => t.id !== id) })),
  clear: () => set({ toasts: [] }),
}))
