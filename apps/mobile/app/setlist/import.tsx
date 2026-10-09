import { useLocalSearchParams } from 'expo-router'
import SetlistImportScreen from '../../src/screens/SetlistImportScreen'

// Shared-setlist IMPORT preview. Reached via a shared-link deep link
// (app/+native-intent.tsx remaps /setlist/<slugs>?toKeys=, /set/<CODE>, and the
// /worship/... variants here) and directly navigable for testing. The static
// `import` segment takes precedence over the dynamic `setlist/[id]` route.
function firstRouteParam(v: string | string[] | undefined): string | undefined {
  return Array.isArray(v) ? v[0] : v
}

function LvmSetlistImportRoute() {
  const { ids, toKeys, code } = useLocalSearchParams<{
    ids?: string | string[]
    toKeys?: string | string[]
    code?: string | string[]
  }>()
  return (
    <SetlistImportScreen
      ids={firstRouteParam(ids)}
      toKeys={firstRouteParam(toKeys)}
      code={firstRouteParam(code)}
    />
  )
}

export default LvmSetlistImportRoute
