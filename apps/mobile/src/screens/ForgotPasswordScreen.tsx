import { useEffect, useRef, useState } from 'react'
import { Pressable, Text, View } from 'react-native'
import { useTranslation } from 'react-i18next'
import { useRouter } from 'expo-router'
import TextField from '../components/TextField'
import AuthFormLayout from '../components/auth/AuthFormLayout'
import { useTheme } from '../theme/ThemeProvider'
import { supabase } from '../lib/supabase'
import { isValidEmail } from '../lib/authValidation'
import { requestPasswordReset } from '../lib/authFlows'
import { passwordResetRedirectUrl } from '../lib/passwordResetLink'
import { markSessionError } from '../lib/sessionError'

// "Forgot?" on the sign-in screen. The user asks for the link here and, if they
// open it on this device, sets the new password in the app: the email points at
// /app/reset-password, which the app claims as a Universal Link / App Link and
// lands on app/auth-link.tsx -> app/reset-password.tsx. Opened anywhere the app
// is not installed — a desktop browser, or a mail client's in-app browser that
// does not fire App Links — the same URL serves the web reset page instead, so
// the link always works.
//
// The confirmation NEVER says whether the address has an account. Supabase
// returns 200 either way by design, and the copy has to match, or this screen
// becomes a way to test whether someone is a user.
//
// NOTHING here may be logged: no email address in console output or breadcrumbs.

// GoTrue throttles this endpoint per address and per IP. The cooldown is our own
// front door, so a user tapping again after nothing arrives gets a countdown
// instead of a throttle error — one minute is above Supabase's default
// per-address email interval.
const COOLDOWN_SECONDS = 60

export default function ForgotPasswordScreen() {
  const t = useTheme()
  const { t: tx } = useTranslation(['auth', 'common'])
  const router = useRouter()

  const [email, setEmail] = useState('')
  const [busy, setBusy] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [cooldown, setCooldown] = useState(0)
  const timer = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    if (cooldown <= 0) return
    timer.current = setInterval(() => {
      setCooldown((seconds) => (seconds <= 1 ? 0 : seconds - 1))
    }, 1000)
    return () => {
      if (timer.current) clearInterval(timer.current)
    }
  }, [cooldown > 0])

  async function onSubmit() {
    if (busy || cooldown > 0) return
    setError(null)
    if (!isValidEmail(email)) {
      setError('errors.invalidEmail')
      return
    }
    setBusy(true)
    try {
      const result = await requestPasswordReset(supabase, {
        email,
        redirectTo: passwordResetRedirectUrl(),
      })
      if (!result.ok) {
        markSessionError('ForgotPassword.request')
        setError(result.error ?? 'errors.generic')
        return
      }
      // Start the cooldown on success only: a throttle or a dead network should
      // leave the button tappable once the cause is fixed.
      setCooldown(COOLDOWN_SECONDS)
      setSent(true)
    } catch {
      markSessionError('ForgotPassword.request')
      setError('errors.generic')
    } finally {
      setBusy(false)
    }
  }

  const submitDisabled = busy || cooldown > 0
  const submitLabel = busy
    ? tx('pleaseWait')
    : cooldown > 0
      ? tx('forgotPassword.cooldown', { seconds: cooldown })
      : sent
        ? tx('forgotPassword.resend')
        : tx('forgotPassword.submit')

  return (
    <AuthFormLayout
      title={tx('forgotPassword.title')}
      subtitle={tx('forgotPassword.subtitle')}
      backLabel={tx('forgotPassword.backToSignIn')}
      onBack={() => router.back()}
    >
      <View style={{ gap: t.spacing.lg }}>
            <TextField
              label={tx('email')}
              icon="envelope"
              value={email}
              onChangeText={setEmail}
              placeholder={tx('emailPlaceholder')}
              keyboardType="email-address"
              autoComplete="email"
              textContentType="emailAddress"
            />

            {sent ? (
              <Text
                accessibilityLiveRegion="polite"
                style={{ fontSize: 13.5, lineHeight: 19, color: t.colors.sec }}
              >
                {tx('forgotPassword.sentMessage')}
              </Text>
            ) : null}

            {error ? (
              <Text
                accessibilityLiveRegion="polite"
                style={{ fontSize: 13.5, color: t.colors.danger }}
              >
                {tx(error)}
              </Text>
            ) : null}

            <Pressable
              onPress={() => void onSubmit()}
              disabled={submitDisabled}
              accessibilityRole="button"
              accessibilityLabel={submitLabel}
              style={({ pressed }) => ({
                minHeight: 50,
                paddingHorizontal: t.spacing.md,
                borderRadius: t.radii.md,
                backgroundColor: t.colors.accent,
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'center',
                gap: t.spacing.sm,
                opacity: submitDisabled ? 0.5 : pressed ? 0.85 : 1,
              })}
            >
              <Text
                style={{ fontSize: 16.5, fontWeight: '700', color: t.colors.onAccent }}
                numberOfLines={2}
              >
                {submitLabel}
              </Text>
            </Pressable>

            <Text style={{ fontSize: 12.5, lineHeight: 17, color: t.colors.sec }}>
              {tx('forgotPassword.webNote')}
            </Text>
      </View>
    </AuthFormLayout>
  )
}
