import { AppHeader } from '@/components/AppHeader'
import { ScreenSetup } from '@/components/screens/ScreenSetup'
import { ScreenPlanning } from '@/components/screens/ScreenPlanning'
import { ScreenSimulation } from '@/components/screens/ScreenSimulation'
import { ScreenReport } from '@/components/screens/ScreenReport'
import { useUiStore } from '@/state/uiStore'

const SCREENS = {
  setup: ScreenSetup,
  planning: ScreenPlanning,
  simulation: ScreenSimulation,
  report: ScreenReport,
} as const

function App() {
  const screen = useUiStore((s) => s.screen)
  const Screen = SCREENS[screen]

  return (
    <div className="flex h-full flex-col bg-slate-950 text-slate-100">
      <AppHeader />
      <main className="min-h-0 flex-1 overflow-auto">
        <Screen />
      </main>
    </div>
  )
}

export default App
