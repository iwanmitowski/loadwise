// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { useUiStore } from '@/state/uiStore'
import { loadingClock, resetLoadingClock } from '@/three/Animations/playbackClock'
import { PlaybackControls } from './PlaybackControls'

afterEach(() => {
  cleanup()
  useUiStore.getState().setPlayback({ mode: 'idle', playing: false, speed: 1, index: 0 })
  resetLoadingClock(0)
})

describe('PlaybackControls — idle', () => {
  it('offers the replay entry point, which starts loading playback from item 0', () => {
    loadingClock.t = 3 // stale clock from a previous run must not survive
    render(<PlaybackControls itemCount={9} />)

    fireEvent.click(screen.getByRole('button', { name: /replay loading/i }))

    const { playback } = useUiStore.getState()
    expect(playback).toMatchObject({ mode: 'loading', playing: true, index: 0 })
    expect(loadingClock.t).toBe(0)
  })

  it('renders nothing for an empty trip', () => {
    const { container } = render(<PlaybackControls itemCount={0} />)
    expect(container).toBeEmptyDOMElement()
  })

  it('renders nothing in delivery mode (T15 owns that transport)', () => {
    useUiStore.getState().setPlayback({ mode: 'delivery' })
    const { container } = render(<PlaybackControls itemCount={9} />)
    expect(container).toBeEmptyDOMElement()
  })
})

describe('PlaybackControls — loading mode', () => {
  function enterLoading() {
    useUiStore.getState().setPlayback({ mode: 'loading', playing: true, index: 0 })
    render(<PlaybackControls itemCount={9} />)
  }

  it('pause/resume toggles playing without touching the clock', () => {
    enterLoading()
    loadingClock.t = 1.23

    fireEvent.click(screen.getByRole('button', { name: /pause loading/i }))
    expect(useUiStore.getState().playback.playing).toBe(false)
    expect(loadingClock.t).toBe(1.23)

    fireEvent.click(screen.getByRole('button', { name: /resume loading/i }))
    expect(useUiStore.getState().playback.playing).toBe(true)
    expect(loadingClock.t).toBe(1.23)
  })

  it('restart rewinds the clock and resumes from item 0', () => {
    enterLoading()
    useUiStore.getState().setPlayback({ playing: false, index: 7 })
    loadingClock.t = 4.2

    fireEvent.click(screen.getByRole('button', { name: /replay from the start/i }))

    expect(loadingClock.t).toBe(0)
    expect(useUiStore.getState().playback).toMatchObject({ playing: true, index: 0 })
  })

  it('cycles speed 0.5× → 1× → 2× → 4× → 0.5×', () => {
    useUiStore.getState().setPlayback({ mode: 'loading', speed: 0.5 })
    render(<PlaybackControls itemCount={9} />)

    for (const next of [1, 2, 4, 0.5]) {
      fireEvent.click(screen.getByRole('button', { name: /cycle playback speed/i }))
      expect(useUiStore.getState().playback.speed).toBe(next)
    }
  })

  it('shows the current item / total and a progress bar', () => {
    useUiStore.getState().setPlayback({ mode: 'loading', index: 11 })
    render(<PlaybackControls itemCount={26} />)

    expect(screen.getByText('item 12 / 26')).toBeInTheDocument()
    expect(screen.getByRole('progressbar')).toBeInTheDocument()
  })

  it('exit returns playback to idle', () => {
    enterLoading()
    fireEvent.click(screen.getByRole('button', { name: /exit loading replay/i }))
    expect(useUiStore.getState().playback).toMatchObject({
      mode: 'idle',
      playing: false,
      index: 0,
    })
  })
})
