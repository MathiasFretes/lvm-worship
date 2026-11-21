import { useMemo } from 'react'
import { Text } from 'react-native'
import { Stack, useLocalSearchParams } from 'expo-router'
import { useTranslation } from 'react-i18next'
import ServiceRepertoireScreen from '../../src/screens/ServiceRepertoireScreen'
import ConnectedServiceRepertoireScreen from '../../src/screens/ConnectedServiceRepertoireScreen'
import Screen from '../../src/components/Screen'
import { useCurrentUser } from '../../src/lib/currentUser'
import { connectedWorshipRoute } from '../../src/lib/connectedWorshipRoute'
import { usesVpsBackend } from '../../src/lib/supabase'
import { useTheme } from '../../src/theme/ThemeProvider'

export default function ServiceRepertoireRoute() {
  const params = useLocalSearchParams<{ churchId?: string | string[]; serviceId?: string | string[]; branchId?: string | string[] }>()
  const userId = useCurrentUser()?.id || ''
  const { t } = useTranslation('setlist')
  const theme = useTheme()
  const parsed = useMemo(() => {
    try { return { scope: connectedWorshipRoute(userId, { churchId: params.churchId, serviceId: params.serviceId, branchId: params.branchId }), invalid: false } }
    catch { return { scope: null, invalid: true } }
  }, [userId, params.churchId, params.serviceId, params.branchId])
  if (parsed.invalid || (parsed.scope && !usesVpsBackend)) return <Screen><Stack.Screen options={{ title: t('service.title') }} /><Text accessibilityRole="alert" style={{ padding: theme.spacing.lg, color: theme.colors.ink }}>{t('service.connected.invalidLink')}</Text></Screen>
  return parsed.scope ? <ConnectedServiceRepertoireScreen key={JSON.stringify(parsed.scope)} scope={parsed.scope} /> : <ServiceRepertoireScreen />
}
