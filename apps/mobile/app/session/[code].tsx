import { useLocalSearchParams } from 'expo-router'
import SessionFollowerScreen from '../../src/screens/SessionFollowerScreen'

// Live-session follower route, reached from a /s/{code} deep link (see
// app/+native-intent.tsx) or the custom scheme. Public/anonymous — the auth gate
// in app/_layout.tsx whitelists the `session` segment.
function LvmSessionRoute() {
  const params = useLocalSearchParams<{ code: string | string[] }>()
  const code = Array.isArray(params.code) ? params.code[0] : params.code
  return <SessionFollowerScreen code={code} />
}

export default LvmSessionRoute
