// Browser-only helper: trigger a client-side download of `data` as pretty JSON.
// Exempt from the no-DOM rule (see CLAUDE.md) — it is a trivial UI-layer utility
// that happens to live under utils. It must not be imported by the optimizer.
export function downloadJson(filename: string, data: unknown): void {
  const blob = new Blob([JSON.stringify(data, null, 2)], {
    type: 'application/json',
  })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}
