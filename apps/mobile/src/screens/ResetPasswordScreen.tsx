import { useState } from 'react'
import { Alert, Text, View } from 'react-native'
import { useTranslation } from 'react-i18next'
import { useRouter } from 'expo-router'
import Button from '../components/Button'
import TextField from '../components/TextField'
import AuthFormLayout from '../components/auth/AuthFormLayout'
import { useTheme } from '../theme/ThemeProvider'
import { supabase } from '../lib/supabase'
import { completePasswordReset } from '../lib/passwordReset'
import { MIN_PASSWORD_LENGTH, validatePasswordReset } from '../lib/authValidation'
import { markSessionError } from '../lib/sessionError'

// Set a new password, reached from a recovery email opened on this device
// (/app/reset-password -> AuthLinkScreen -> here, with the recovery session
// already adopted).
//
// No current-password field, unlike ChangePasswordScreen: the link is the proof
// of identity, and not knowing the current password is the reason for being
// here. The same full strength policy applies, checked before the request so a
// weak password is refused in our words rather than GoTrue's.
//
// NOTHING on this screen may be logged: no password values in console output,
// breadcrumbs or analytics, and no analytics events at all — the same rule
// ChangePasswordScreen carries, for the same reason.

export default function ResetPasswordScreen() {
  const t = useTheme()
  const { t: tx } = useTranslation(['auth', 'common'])
  const router = useRouter()

  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function onSubmit() {
    if (busy) return
    const invalid = validatePasswordReset({ password, confirmPassword })
    if (invalid) {
      setError(invalid)
      return
    }
    setError(null)
    setBusy(true)
    try {
      const result = await completePasswordReset(supabase, { password })
      if (!result.ok) {
        markSessionError('ResetPasswordScreen')
        setError(result.error ?? 'errors.generic')
        return
      }
      // The recovery session is a real session, so the user is already signed
      // in — send them into the app rather than back to a sign-in form they no
      // longer need.
      Alert.alert(tx('resetPassword.successTitle'), tx('resetPassword.successMessage'), [
        { text: tx('common:ok'), onPress: () => router.replace('/') },
      ])
    } finally {
      setBusy(false)
    }
  }

  return (
    <AuthFormLayout
      title={tx('resetPassword.title')}
      subtitle={tx('resetPassword.subtitle')}
    >
      <View style={{ gap: t.spacing.lg }}>
              {/* autoComplete/textContentType mark both fields as NEW so the OS
                  offers to generate and save a password rather than autofilling
                  the old one. */}
              <TextField
                label={tx('resetPassword.newPassword')}
                icon="lock"
                value={password}
                onChangeText={setPassword}
                secureTextEntry
                autoComplete="new-password"
                textContentType="newPassword"
              />
              <TextField
                label={tx('resetPassword.confirmPassword')}
                icon="lock"
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                secureTextEntry
                autoComplete="new-password"
                textContentType="newPassword"
              />

              {error ? (
                <Text style={{ fontSize: 13.5, color: t.colors.danger }}>
                  {tx(error, { min: MIN_PASSWORD_LENGTH })}
                </Text>
              ) : null}

              <Button title={tx('resetPassword.submit')} onPress={onSubmit} disabled={busy} />
      </View>
    </AuthFormLayout>
  )
}
