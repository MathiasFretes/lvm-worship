import { useCallback, useEffect, useRef, useState } from 'react'
import { ActivityIndicator, AppState, ScrollView, Text, View } from 'react-native'
import { Stack } from 'expo-router'
import * as Network from 'expo-network'
import { File, Paths } from 'expo-file-system'
import * as Sharing from 'expo-sharing'
import { useTranslation } from 'react-i18next'
import type { ConnectedWorshipDraft, ConnectedWorshipState, WorshipScope } from '@lavozmisionera/core/setlists/worshipExchange'
import Button from '../components/Button'
import HeaderIconButton from '../components/HeaderIconButton'
import Screen from '../components/Screen'
import AddSongsModal from '../components/setlist/AddSongsModal'
import KeyPickerSheet from '../components/setlist/KeyPickerSheet'
import { openConnectedWorship } from '../lib/connectedWorship'
import { useSongList, type Song } from '../lib/useSongList'
import { exportServiceDraft } from '../lib/worshipServiceDraft'
import { uuidv4 } from '../lib/uuid'
import { getCurrentUserSnapshot } from '../lib/currentUser'
import { useTheme } from '../theme/ThemeProvider'

type Repository = ReturnType<typeof openConnectedWorship>

export default function ConnectedServiceRepertoireScreen({ scope }: { scope: WorshipScope }) {
  const theme = useTheme()
  const { t } = useTranslation(['setlist', 'common'])
  const catalog = useSongList()
  const repository = useRef<Repository | null>(null)
  const sending = useRef<Repository | null>(null)
  const [state, setState] = useState<ConnectedWorshipState | null>(null)
  const [loading, setLoading] = useState(true)
  const [syncing, setSyncing] = useState(false)
  const [failure, setFailure] = useState('')
  const [adding, setAdding] = useState(false)
  const [keyId, setKeyId] = useState<string | null>(null)
  const adopt = useCallback((repo: Repository, next: ConnectedWorshipState) => {
    if (repository.current === repo) setState(previous => previous && previous.localRevision > next.localRevision ? previous : next)
  }, [])

  const send = useCallback(async (repo: Repository, queue = false) => {
    if (sending.current === repo || repository.current !== repo) return
    sending.current = repo
    setSyncing(true); setFailure('')
    try {
      let current = await repo.read()
      if (queue && !current.pending) current = await repo.queue()
      adopt(repo, current)
      if (!current.conflict && current.pending) adopt(repo, await repo.flush())
    } catch (error) {
      if (repository.current === repo) {
        const status = (error as { status?: number }).status
        setFailure(status === 409 ? 'service.connected.conflict' : status === 401 || status === 403 || status === 404 ? 'service.connected.noAccess' : 'service.connected.sendError')
        try { adopt(repo, await repo.read()) } catch { /* Keep the last visible, scoped copy. */ }
      }
    } finally {
      if (sending.current === repo) sending.current = null
      if (repository.current === repo) setSyncing(false)
    }
  }, [adopt])

  useEffect(() => {
    let repo: Repository
    try { repo = openConnectedWorship(scope) }
    catch { setFailure('service.connected.invalidLink'); setLoading(false); return }
    repository.current = repo
    setState(null); setLoading(true); setSyncing(false); setFailure('')
    void (async () => {
      try {
        const saved = await repo.read()
        adopt(repo, saved)
        if (!saved.exchange) adopt(repo, await repo.refresh())
        else if (saved.pending && !saved.conflict) await send(repo)
      } catch { if (repository.current === repo) setFailure('service.connected.loadError') }
      finally { if (repository.current === repo) setLoading(false) }
    })()
    const reconnect = () => { void send(repo) }
    const network = Network.addNetworkStateListener(value => { if (value.isConnected && value.isInternetReachable !== false) reconnect() })
    const appState = AppState.addEventListener('change', value => { if (value === 'active') reconnect() })
    return () => {
      if (repository.current === repo) repository.current = null
      network.remove(); appState.remove(); repo.dispose()
    }
  }, [scope, adopt, send])

  async function edit(change: (draft: ConnectedWorshipDraft) => ConnectedWorshipDraft) {
    const repo = repository.current
    if (!repo) return
    try { adopt(repo, await repo.edit(change)) }
    catch { if (repository.current === repo) setFailure('service.storageError') }
  }
  async function refresh() {
    const repo = repository.current
    if (!repo || syncing) return
    setSyncing(true); setFailure('')
    try { adopt(repo, await repo.refresh()) }
    catch { if (repository.current === repo) setFailure('service.connected.loadError') }
    finally { if (repository.current === repo) setSyncing(false) }
  }
  async function cancel() {
    const repo = repository.current
    if (!repo || syncing) return
    try { adopt(repo, await repo.cancelPending()); setFailure('') }
    catch { if (repository.current === repo) setFailure('service.storageError') }
  }
  function toggleSong(song: Song) {
    void edit(draft => ({ ...draft, entries: draft.entries.some(entry => entry.song.id === song.id)
      ? draft.entries.filter(entry => entry.song.id !== song.id)
      : [...draft.entries, { id: uuidv4(), song: { id: song.id, title: song.title, originalKey: song.default_key || '', chordpro_content: song.chordpro_content || '' }, toKey: null }] }))
  }
  function move(id: string, direction: -1 | 1) {
    void edit(draft => {
      const index = draft.entries.findIndex(entry => entry.id === id)
      const entries = draft.entries.slice()
      if (index >= 0 && entries[index + direction]) [entries[index], entries[index + direction]] = [entries[index + direction], entries[index]]
      return { ...draft, entries }
    })
  }
  async function share() {
    const repo = repository.current
    if (!repo) return
    try {
      const saved = await repo.read()
      if (!saved.draft || !await Sharing.isAvailableAsync()) throw new Error('Sharing unavailable')
      const plan = exportServiceDraft(saved.draft)
      const file = new File(Paths.cache, `WorshipPlan-${uuidv4()}.json`)
      file.create(); file.write(JSON.stringify(plan, null, 2))
      if (repository.current === repo && getCurrentUserSnapshot().user?.id === scope.userId) await Sharing.shareAsync(file.uri, { mimeType: 'application/json', UTI: 'public.json' })
    } catch { if (repository.current === repo) setFailure('service.exportError') }
  }
  const draft = state?.draft
  const canEdit = !!state?.exchange?.canPrepare
  const keyEntry = draft?.entries.find(entry => entry.id === keyId)
  const status = state?.conflict ? 'service.connected.conflict' : state?.pending ? 'service.connected.pending'
    : state && state.generation > state.savedGeneration ? 'service.connected.local' : state?.savedGeneration ? 'service.connected.sent' : ''

  return <Screen edges={['left', 'right', 'bottom']}>
    <Stack.Screen options={{ headerShown: true, title: t('service.title') }} />
    <ScrollView style={{ flex: 1 }} contentInsetAdjustmentBehavior="automatic" contentContainerStyle={{ padding: theme.spacing.lg, gap: theme.spacing.md }}>
      {draft ? <>
        <Text accessibilityRole="header" style={{ ...theme.typography.largeTitle, color: theme.colors.ink }}>{draft.context.title}</Text>
        <Text style={{ color: theme.colors.sec }}>{draft.context.name}</Text>
        {draft.entries.map((entry, index) => <View key={entry.id} style={{ borderRadius: theme.radii.md, padding: theme.spacing.md, backgroundColor: theme.colors.surfaceAlt, gap: theme.spacing.sm }}>
          <Text style={{ ...theme.typography.rowTitle, color: theme.colors.ink }}>{index + 1}. {entry.song.title}</Text>
          <Text style={{ color: theme.colors.sec }}>{entry.toKey || entry.song.originalKey}</Text>
          {canEdit && <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing.sm }}>
            {index > 0 && <HeaderIconButton icon="chevron.up" label={t('service.up', { title: entry.song.title })} onPress={() => move(entry.id, -1)} />}
            {index < draft.entries.length - 1 && <HeaderIconButton icon="chevron.down" label={t('service.down', { title: entry.song.title })} onPress={() => move(entry.id, 1)} />}
            <HeaderIconButton icon="plus" label={t('service.connected.duplicate', { title: entry.song.title })} onPress={() => void edit(value => ({ ...value, entries: value.entries.flatMap(item => item.id === entry.id ? [item, { ...item, id: uuidv4() }] : [item]) }))} />
            <HeaderIconButton icon="music.note" label={t('timeline.changeKeyFor', { title: entry.song.title })} onPress={() => setKeyId(entry.id)} />
            <HeaderIconButton icon="trash" label={t('service.remove', { title: entry.song.title })} onPress={() => void edit(value => ({ ...value, entries: value.entries.filter(item => item.id !== entry.id) }))} />
          </View>}
        </View>)}
        {!draft.entries.length && <Text style={{ color: theme.colors.sec }}>{t('builder.addHintPhone')}</Text>}
      </> : loading ? <ActivityIndicator color={theme.colors.accent} /> : <Text style={{ color: theme.colors.sec }}>{t('service.connected.noContext')}</Text>}
      {status ? <Text accessibilityLiveRegion="polite" style={{ color: theme.colors.sec }}>{t(status)}</Text> : null}
      {failure ? <Text accessibilityRole="alert" style={{ color: theme.colors.ink }}>{t(failure)}</Text> : null}
      {catalog.error && adding ? <Text accessibilityRole="alert" style={{ color: theme.colors.ink }}>{t(catalog.error)}</Text> : null}
      {syncing && <ActivityIndicator color={theme.colors.accent} />}
      <Button title={t('service.connected.refresh')} variant="secondary" disabled={syncing || !!state?.pending} onPress={() => void refresh()} />
      {!!state?.pending && <Button title={t('service.connected.cancelSend')} variant="secondary" disabled={syncing} onPress={() => void cancel()} />}
      {!!draft?.entries.length && <Button title={t('service.export')} variant="secondary" onPress={() => void share()} />}
    </ScrollView>
    {draft && <View style={{ padding: theme.spacing.lg, gap: theme.spacing.sm }}>
      <Button title={t('builder.addSongs')} variant="secondary" disabled={!canEdit} onPress={() => setAdding(true)} />
      <Button title={t(state?.pending ? 'common:retry' : 'service.connected.send')} disabled={syncing || !canEdit || !draft.entries.length || !!state?.conflict} onPress={() => { const repo = repository.current; if (repo) void send(repo, true) }} />
    </View>}
    <AddSongsModal visible={adding} onClose={() => setAdding(false)} songs={catalog.songs} addedSongIds={new Set(draft?.entries.map(entry => entry.song.id))} onToggle={toggleSong} />
    <KeyPickerSheet visible={!!keyEntry} onClose={() => setKeyId(null)} songTitle={keyEntry?.song.title || null} currentKey={keyEntry?.toKey || keyEntry?.song.originalKey || null} nativeKey={keyEntry?.song.originalKey || null} hasOverride={!!keyEntry?.toKey} onPick={toKey => { const id = keyId; setKeyId(null); if (id) void edit(value => ({ ...value, entries: value.entries.map(entry => entry.id === id ? { ...entry, toKey } : entry) })) }} />
  </Screen>
}
