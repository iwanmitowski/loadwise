import { useEffect, useRef, useState } from 'react'

/**
 * Seed badge — click copies the seed to the clipboard (idea.md: the seed must
 * be visible and replayable everywhere). Shows a short "Copied!" confirmation.
 */
export function SeedBadge({ seed }: { seed: string }) {
  const [copied, setCopied] = useState(false)
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined)
  useEffect(() => () => clearTimeout(timer.current), [])

  const copy = () => {
    // Clipboard API may be unavailable (jsdom, insecure contexts) — the badge
    // still shows the seed, so failing silently is fine.
    void navigator.clipboard?.writeText(seed).catch(() => {})
    setCopied(true)
    clearTimeout(timer.current)
    timer.current = setTimeout(() => setCopied(false), 1500)
  }

  return (
    <button
      type="button"
      onClick={copy}
      title="Copy seed"
      className="flex items-center gap-2 rounded-md border border-slate-700 px-3 py-1.5 font-mono text-xs text-slate-300 hover:bg-slate-800"
    >
      <span className="text-slate-500">seed</span>
      {seed}
      <span className="text-slate-500">{copied ? '✓ copied' : '⧉'}</span>
    </button>
  )
}
