// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import {
  demoBlockingResult,
  demoBlockingScenario,
  demoResult,
  demoScenario,
} from '@/fixtures/demo'
import { useUiStore } from '@/state/uiStore'
import { deliveryClock, resetDeliveryClock } from '@/three/Animations/playbackClock'
import { DeliveryPanel } from './DeliveryPanel'

const blockingTrip = demoBlockingResult.trips[0]

afterEach(() => {
  cleanup()
  useUiStore
    .getState()
    .setPlayback({ mode: 'idle', playing: false, speed: 1, index: 0, autoPlay: false })
  resetDeliveryClock(0)
})

function enterDelivery(index = 0) {
  useUiStore.getState().setPlayback({ mode: 'delivery', playing: true, index })
}

describe('DeliveryPanel — idle', () => {
  it('offers the route entry point, which starts delivery from stop 0', () => {
    deliveryClock.t = 3 // stale clock must not survive the (re)start
    render(<DeliveryPanel trip={blockingTrip} scenario={demoBlockingScenario} />)

    fireEvent.click(screen.getByRole('button', { name: /simulate route/i }))

    expect(useUiStore.getState().playback).toMatchObject({
      mode: 'delivery',
      playing: true,
      index: 0,
    })
    expect(deliveryClock.t).toBe(0)
  })

  it('renders nothing in loading mode (T14 owns that transport)', () => {
    useUiStore.getState().setPlayback({ mode: 'loading' })
    const { container } = render(
      <DeliveryPanel trip={blockingTrip} scenario={demoBlockingScenario} />,
    )
    expect(container).toBeEmptyDOMElement()
  })
})

describe('DeliveryPanel — delivery mode', () => {
  it('shows the stop card: shop, stop x/y, door, units, blockers, extra moves', () => {
    enterDelivery(0)
    render(<DeliveryPanel trip={blockingTrip} scenario={demoBlockingScenario} />)

    expect(screen.getByText('Volt Hub')).toBeInTheDocument()
    expect(screen.getByText('stop 1 / 3')).toBeInTheDocument()
    expect(screen.getByText('Rear door')).toBeInTheDocument()
    expect(screen.getByText(/1 item\(s\) moved temporarily/)).toBeInTheDocument()
    // Running total already counts this stop's move; route total matches the
    // report metric (1) — same findBlockers source of truth.
    expect(screen.getByText(/extra moves:/i)).toHaveTextContent(
      'Extra moves: 1 / 1 route total',
    )
    expect(screen.getByText(/2\. Hop Cellar · 3\. Metro Market/)).toBeInTheDocument()
  })

  it('hides the blocker callout on a blocker-free stop', () => {
    enterDelivery(1)
    render(<DeliveryPanel trip={blockingTrip} scenario={demoBlockingScenario} />)
    expect(screen.getByText('Hop Cellar')).toBeInTheDocument()
    expect(screen.queryByText(/moved temporarily/)).not.toBeInTheDocument()
  })

  it('Next stop advances and rewinds the stop clock', () => {
    enterDelivery(0)
    deliveryClock.t = 2.5
    render(<DeliveryPanel trip={blockingTrip} scenario={demoBlockingScenario} />)

    fireEvent.click(screen.getByRole('button', { name: /advance to the next stop/i }))

    expect(useUiStore.getState().playback).toMatchObject({ index: 1, playing: true })
    expect(deliveryClock.t).toBe(0)
  })

  it('Next stop on the last stop is inert', () => {
    enterDelivery(2)
    render(<DeliveryPanel trip={blockingTrip} scenario={demoBlockingScenario} />)

    fireEvent.click(screen.getByRole('button', { name: /this is the last stop/i }))
    expect(useUiStore.getState().playback.index).toBe(2)
  })

  it('Auto-play toggle also resumes a route waiting at a finished stop', () => {
    enterDelivery(0)
    useUiStore.getState().setPlayback({ playing: false })
    render(<DeliveryPanel trip={blockingTrip} scenario={demoBlockingScenario} />)

    fireEvent.click(screen.getByRole('button', { name: /auto-play/i }))
    expect(useUiStore.getState().playback).toMatchObject({ autoPlay: true, playing: true })

    fireEvent.click(screen.getByRole('button', { name: /auto-play/i }))
    expect(useUiStore.getState().playback.autoPlay).toBe(false)
  })

  it('Restart route returns to stop 0 with the clock rewound', () => {
    enterDelivery(2)
    deliveryClock.t = 1.7
    render(<DeliveryPanel trip={blockingTrip} scenario={demoBlockingScenario} />)

    fireEvent.click(screen.getByRole('button', { name: /restart route/i }))

    expect(useUiStore.getState().playback).toMatchObject({ index: 0, playing: true })
    expect(deliveryClock.t).toBe(0)
  })

  it('Exit returns playback to idle', () => {
    enterDelivery(1)
    render(<DeliveryPanel trip={blockingTrip} scenario={demoBlockingScenario} />)
    fireEvent.click(screen.getByRole('button', { name: /exit route simulation/i }))
    expect(useUiStore.getState().playback).toMatchObject({ mode: 'idle', index: 0 })
  })

  it('demo fixture route shows zero extra moves end to end', () => {
    useUiStore.getState().setPlayback({ mode: 'delivery', playing: true, index: 2 })
    render(<DeliveryPanel trip={demoResult.trips[0]} scenario={demoScenario} />)
    expect(screen.getByText(/\/ 0 route total/)).toBeInTheDocument()
  })
})
