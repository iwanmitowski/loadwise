import { Component, type ErrorInfo, type ReactNode } from 'react'

// Generic error boundary (T17). Wraps the 3D canvas so a WebGL/R3F failure
// degrades to a card with a reset button instead of taking down the whole app.
// React only supports class components as error boundaries.

type Props = {
  children: ReactNode
  /** Rendered when a child throws. `reset` clears the error to remount children. */
  fallback: (reset: () => void) => ReactNode
  /** Optional label for the console diagnostic. */
  label?: string
}

type State = { error: Error | null }

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    // Keep a diagnostic in the console; the UI stays friendly.
    console.error(`[${this.props.label ?? 'ErrorBoundary'}]`, error, info.componentStack)
  }

  reset = (): void => this.setState({ error: null })

  render(): ReactNode {
    if (this.state.error) return this.props.fallback(this.reset)
    return this.props.children
  }
}
