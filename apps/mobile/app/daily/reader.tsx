import { useLocalSearchParams } from 'expo-router'
import DailyWordScreen from '../../src/screens/DailyWordScreen'

// The M'Cheyne Reader pushed from the Daily Word landing — it carries a back
// chevron to the landing (the tab-root Reader in reader-direct mode does not).
// The optional `passage` param is a core `passageId()`, so tapping a specific
// reading on the landing opens ON that chapter instead of the day's first one.
function LvmDailyReaderRoute() {
  const params = useLocalSearchParams<{ passage?: string | string[] }>()
  const passage = Array.isArray(params.passage) ? params.passage[0] : params.passage
  return <DailyWordScreen showBackToLanding initialPassageId={passage} />
}

export default LvmDailyReaderRoute
