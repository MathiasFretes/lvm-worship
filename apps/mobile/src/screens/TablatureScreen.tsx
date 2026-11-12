import { useEffect, useState } from 'react'
import { Platform, ScrollView, Text, TextInput, View } from 'react-native'
import { Stack } from 'expo-router'
import AsyncStorage from '@react-native-async-storage/async-storage'
import * as DocumentPicker from 'expo-document-picker'
import { File, Paths } from 'expo-file-system'
import * as Sharing from 'expo-sharing'
import { useTranslation } from 'react-i18next'
import { TAB_EXAMPLE, TAB_MAX_LENGTH, parseTablature } from '@lavozmisionera/core/music/tablature'
import Button from '../components/Button'
import Screen from '../components/Screen'
import { useTheme } from '../theme/ThemeProvider'

const draftKey = 'lvm.worship.tablature.draft'
const monospace = Platform.select({ ios: 'Menlo', default: 'monospace' })

export default function TablatureScreen({ embedded = false }: { embedded?: boolean }) {
  const theme = useTheme()
  const { t } = useTranslation('utilities')
  const [draft, setDraft] = useState('')
  const [saved, setSaved] = useState('')
  const [imported, setImported] = useState<string | null>(null)
  const [busy, setBusy] = useState(true)
  const [message, setMessage] = useState('')
  const [zoom, setZoom] = useState(16)
  const parsed = parseTablature(draft)
  const preview = imported ?? draft

  useEffect(() => {
    let active = true
    void AsyncStorage.getItem(draftKey).then(value => {
      if (active) {
        setDraft(value ?? '')
        setSaved(value ?? '')
      }
    }).catch(() => {
      if (active) setMessage('storageError')
    }).finally(() => {
      if (active) setBusy(false)
    })
    return () => { active = false }
  }, [])

  async function run(action: () => Promise<void>, failure: string) {
    setBusy(true)
    setMessage('')
    try { await action() } catch { setMessage(failure) } finally { setBusy(false) }
  }

  async function importTab() {
    const selection = await DocumentPicker.getDocumentAsync({ copyToCacheDirectory: true })
    if (selection.canceled) return
    const file = new File(selection.assets[0].uri)
    if (file.size > TAB_MAX_LENGTH * 4) {
      setMessage('tooLarge')
      return
    }
    const result = parseTablature(await file.text())
    if (result.ok) setImported(result.source)
    else setMessage(result.reason)
  }

  async function exportTab() {
    if (!parsed.ok) return
    if (!await Sharing.isAvailableAsync()) throw new Error('Sharing is unavailable')
    const file = new File(Paths.cache, 'tablatura.txt')
    file.create({ overwrite: true })
    file.write(parsed.source)
    await Sharing.shareAsync(file.uri, { mimeType: 'text/plain', UTI: 'public.plain-text' })
  }

  const heading = { ...theme.typography.rowTitle, color: theme.colors.ink }
  const text = { color: theme.colors.sec }
  const panel = {
    borderWidth: 1, borderColor: theme.colors.border, borderRadius: theme.radii.md,
    backgroundColor: theme.colors.surfaceAlt, padding: theme.spacing.md,
  }
  const actions = { flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing.sm } as const
  const content = (
    <ScrollView keyboardShouldPersistTaps="handled" contentInsetAdjustmentBehavior="automatic"
      contentContainerStyle={{ padding: theme.spacing.lg, gap: theme.spacing.md }}>
      <Text style={text}>{t('tablature.description')}</Text>
      <Text accessibilityRole="header" style={heading}>{t('tablature.source')}</Text>
      <TextInput accessibilityLabel={t('tablature.source')} multiline editable={!busy}
        autoCapitalize="none" autoCorrect={false} spellCheck={false} maxLength={TAB_MAX_LENGTH}
        value={draft} onChangeText={value => { setDraft(value); setMessage('') }}
        placeholder={TAB_EXAMPLE} placeholderTextColor={theme.colors.sec}
        style={{ ...panel, fontFamily: monospace, color: theme.colors.ink, minHeight: 168, textAlignVertical: 'top' }} />
      <View style={actions}>
        <Button title={t('tablature.save')} disabled={busy || draft === saved} onPress={() => void run(async () => {
          await AsyncStorage.setItem(draftKey, draft)
          setSaved(draft)
          setMessage('saved')
        }, 'storageError')} />
        <Button title={t('tablature.import')} disabled={busy || imported !== null} variant="secondary" onPress={() => void run(importTab, 'readError')} />
        <Button title={t('tablature.export')} disabled={busy || !parsed.ok} variant="secondary" onPress={() => void run(exportTab, 'exportError')} />
      </View>
      {!!message && <Text accessibilityLiveRegion="polite" style={text}>{t(`tablature.${message}`)}</Text>}
      {!!draft && !parsed.ok && !message && <Text style={text}>{t(`tablature.${parsed.reason}`)}</Text>}
      <Text accessibilityRole="header" style={heading}>{t(imported ? 'tablature.importPreview' : 'tablature.preview')}</Text>
      <View style={actions}>
        <Button title={t('tablature.zoomOut')} disabled={zoom <= 12} variant="secondary" onPress={() => setZoom(zoom - 2)} />
        <Button title={t('tablature.zoomIn')} disabled={zoom >= 28} variant="secondary" onPress={() => setZoom(zoom + 2)} />
      </View>
      <ScrollView horizontal style={panel} keyboardShouldPersistTaps="handled">
        <Text selectable style={{ fontFamily: monospace, fontSize: zoom, color: theme.colors.ink }}>
          {preview || t('tablature.empty')}
        </Text>
      </ScrollView>
      {imported !== null && <View style={actions}>
        <Button title={t('common:cancel')} variant="secondary" onPress={() => setImported(null)} />
        <Button title={t('tablature.applyImport')} onPress={() => { setDraft(imported); setImported(null); setMessage('') }} />
      </View>}
    </ScrollView>
  )
  if (embedded) return content
  return (
    <Screen edges={['left', 'right', 'bottom']}>
      <Stack.Screen options={{ headerShown: true, title: t('tablature.title') }} />
      {content}
    </Screen>
  )
}
