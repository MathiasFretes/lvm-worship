import { Redirect, Stack } from 'expo-router'
import { usesVpsBackend } from '../src/lib/supabase'
import Screen from '../src/components/Screen'
import ForgotPasswordScreen from '../src/screens/ForgotPasswordScreen'

// Reached from "Forgot?" on /login, so it sits OUTSIDE the auth gate — a signed
// out user has to be able to open it.

function LvmForgotPasswordRoute() {
  if (usesVpsBackend) return <Redirect href="/login" />
  return (
    <Screen edges={['bottom', 'left', 'right']}>
      <Stack.Screen options={{ headerShown: false }} />
      <ForgotPasswordScreen />
    </Screen>
  )
}

export default LvmForgotPasswordRoute
