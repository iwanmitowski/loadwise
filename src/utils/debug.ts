// Dev-only debug flags read from the URL query string (T17). Lets us exercise
// hard-to-reach UX paths in the real app without special builds, e.g.
//   ?debugOptimizerError   → the next optimize run fails (verify the error alert)
// Flags are read live each call so toggling the URL takes effect on the next run.

function hasFlag(name: string): boolean {
  if (typeof window === 'undefined') return false
  try {
    return new URLSearchParams(window.location.search).has(name)
  } catch {
    return false
  }
}

export const debug = {
  /** Force the optimizer run to fail — verifies the retry-able error alert. */
  optimizerError: (): boolean => hasFlag('debugOptimizerError'),
}
