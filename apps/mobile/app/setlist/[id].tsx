import { useLocalSearchParams } from 'expo-router'
import SetlistBuilderScreen from '../../src/screens/SetlistBuilderScreen'

// Builder route, pushed over the tab shell like viewer/[slug].
function LvmSetlistBuilderRoute() {
  const params = useLocalSearchParams<{ id: string | string[] }>()
  const id = Array.isArray(params.id) ? params.id[0] : params.id
  return <SetlistBuilderScreen setlistId={id} />
}

export default LvmSetlistBuilderRoute
