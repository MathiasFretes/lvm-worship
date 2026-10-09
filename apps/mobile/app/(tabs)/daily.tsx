import DailyWordScreen from '../../src/screens/DailyWordScreen'
import DailyWordLandingScreen from '../../src/screens/DailyWordLandingScreen'
import { useAppDefaults } from '../../src/lib/defaults'

// The Daily Word tab opens the landing hub by default; the Settings → Reader
// "Daily Word opens" preference can switch it to open the M'Cheyne Reader
// directly (bypassing the landing and reflections). The pref is device-local and
// read synchronously (hydrated at splash), so this branch never flashes.
// Route policy belongs here; both destination screens stay router-agnostic.
function LvmDailyRoute() {
  const { dailyWordDestination } = useAppDefaults()
  return dailyWordDestination === 'reader' ? <DailyWordScreen /> : <DailyWordLandingScreen />
}

export default LvmDailyRoute
