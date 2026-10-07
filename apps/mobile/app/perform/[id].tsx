import { useLocalSearchParams } from 'expo-router'
import PerformerScreen from '../../src/screens/PerformerScreen'

// Performer / Setlist Viewer route, pushed over the tab shell like
// viewer/[slug] and setlist/[id].
function LvmPerformerRoute() {
  const params = useLocalSearchParams<{ id: string | string[] }>()
  const id = Array.isArray(params.id) ? params.id[0] : params.id
  return <PerformerScreen setlistId={id} />
}

export default LvmPerformerRoute
