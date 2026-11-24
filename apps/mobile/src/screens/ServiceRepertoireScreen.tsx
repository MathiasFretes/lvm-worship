import { useCallback, useState } from 'react'
import { ActivityIndicator, Alert, ScrollView, Text, View } from 'react-native'
import { Stack, useFocusEffect } from 'expo-router'
import * as DocumentPicker from 'expo-document-picker'
import { File, Paths } from 'expo-file-system'
import * as Sharing from 'expo-sharing'
import { useTranslation } from 'react-i18next'
import { parseWorshipContext } from '@lavozmisionera/core/setlists/worshipPlan.js'
import Button from '../components/Button'
import Screen from '../components/Screen'
import HeaderIconButton from '../components/HeaderIconButton'
import { useCurrentUser } from '../lib/currentUser'
import { uuidv4 } from '../lib/uuid'
import { editServiceDraftEntries, exportServiceDraft, readServiceDraft, saveServiceContext, type ServiceDraft } from '../lib/worshipServiceDraft'
import { useTheme } from '../theme/ThemeProvider'

export default function ServiceRepertoireScreen() {
  const theme = useTheme()
  const { t } = useTranslation('setlist')
  const userId = useCurrentUser()?.id
  const [draft, setDraft] = useState<ServiceDraft | null>(null)
  const [busy, setBusy] = useState(true)
  const [error, setError] = useState('')

  useFocusEffect(useCallback(() => {
    if (!userId) {
      setDraft(null)
      setBusy(false)
      return
    }
    let active = true
    setDraft(null)
    setBusy(true)
    setError('')
    void readServiceDraft(userId)
      .then((value) => { if (active) setDraft(value) })
      .catch(() => { if (active) setError('service.storageError') })
      .finally(() => { if (active) setBusy(false) })
    return () => { active = false }
  }, [userId]))

  async function run(action: () => Promise<void>, failure: string) {
    setBusy(true)
    setError('')
    try { await action() } catch { setError(failure) } finally { setBusy(false) }
  }

  async function importContext() {
    if (!userId) return
    const result = await DocumentPicker.getDocumentAsync({ copyToCacheDirectory: true })
    if (result.canceled) return
    const file = new File(result.assets[0].uri)
    if (file.size > 256 * 1024) throw new Error('Context exceeds the size limit')
    const context = parseWorshipContext(JSON.parse(await file.text()))
    if (draft?.entries.length && (draft.context.serviceId !== context.serviceId || draft.context.setlistId !== context.setlistId)) {
      Alert.alert(t('service.replaceTitle'), t('service.replaceBody'), [
        { text: t('common:cancel'), style: 'cancel' },
        { text: t('service.import'), onPress: () => void run(async () => {
          setDraft(await saveServiceContext(userId, context))
        }, 'service.storageError') },
      ])
      return
    }
    setDraft(await saveServiceContext(userId, context))
  }

  async function sharePlan() {
    if (!draft || !await Sharing.isAvailableAsync()) throw new Error('Sharing is unavailable')
    const plan = exportServiceDraft(draft)
    const file = new File(Paths.cache, `WorshipPlan-${uuidv4()}.json`)
    file.create()
    file.write(JSON.stringify(plan, null, 2))
    await Sharing.shareAsync(file.uri, { mimeType: 'application/json', UTI: 'public.json' })
  }

  function edit(id: string, action: 'up' | 'down' | 'remove') {
    if (!draft || !userId || busy) return
    void run(async () => setDraft(await editServiceDraftEntries(userId, id, action)), 'service.storageError')
  }

  return (
    <Screen edges={['left', 'right', 'bottom']}>
      <Stack.Screen options={{ headerShown: true, title: t('service.title') }} />
      <ScrollView contentInsetAdjustmentBehavior="automatic" contentContainerStyle={{ padding: theme.spacing.lg, gap: theme.spacing.md }}>
        <Button title={t('service.import')} disabled={busy || !userId}
          onPress={() => void run(importContext, 'service.importError')} />
        {error ? <Text accessibilityRole="alert" selectable style={{ color: theme.colors.ink }}>{t(error)}</Text> : null}
        {draft ? <>
          <Text accessibilityRole="header" style={{ ...theme.typography.largeTitle, color: theme.colors.ink }}>{draft.context.title}</Text>
          <Text selectable style={{ color: theme.colors.sec }}>{draft.context.name}</Text>
          {draft.entries.map(({ id, song, toKey }, index) => (
            <View key={id} style={{ borderRadius: theme.radii.md, padding: theme.spacing.md, backgroundColor: theme.colors.surfaceAlt, gap: theme.spacing.sm }}>
              <Text style={{ ...theme.typography.rowTitle, color: theme.colors.ink }}>{index + 1}. {song.title}</Text>
              <Text style={{ color: theme.colors.sec }}>{toKey || song.originalKey}</Text>
              {!busy && <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing.sm }}>
                {index > 0 && <HeaderIconButton icon="chevron.up" label={t('service.up', { title: song.title })} onPress={() => edit(id, 'up')} />}
                {index < draft.entries.length - 1 && <HeaderIconButton icon="chevron.down" label={t('service.down', { title: song.title })} onPress={() => edit(id, 'down')} />}
                <HeaderIconButton icon="trash" label={t('service.remove', { title: song.title })} onPress={() => edit(id, 'remove')} />
              </View>}
            </View>
          ))}
          {draft.entries.length === 0 && <Text style={{ color: theme.colors.sec }}>{t('service.empty')}</Text>}
          <Button title={t('service.export')} disabled={busy || !draft.entries.length}
            variant="secondary" onPress={() => void run(sharePlan, 'service.exportError')} />
        </> : busy
          ? <ActivityIndicator color={theme.colors.accent} />
          : <Text style={{ color: theme.colors.sec }}>{t('service.noContext')}</Text>}
      </ScrollView>
    </Screen>
  )
}
