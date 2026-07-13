// Registers @testing-library/jest-dom matchers (toBeInTheDocument, etc.) with
// Vitest's `expect`. Safe to load under the default `node` environment — the
// matchers only touch the DOM when actually called from a jsdom test.
import '@testing-library/jest-dom/vitest'
