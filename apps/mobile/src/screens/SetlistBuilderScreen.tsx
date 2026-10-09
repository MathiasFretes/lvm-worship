import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { ActivityIndicator, Alert, Pressable, ScrollView, Text, TextInput, View } from 'react-native'
import { useRouter } from 'expo-router'
import { useTranslation } from 'react-i18next'
import * as Clipboard from 'expo-clipboard'
import * as Sharing from 'expo-sharing'
import { createSetlist, effectiveKey, formatSetSummary, summarizeSet, timeAgo } from '@lavozmisionera/core'
import AddSongsModal from '../components/setlist/AddSongsModal'
import AddVerseModal from '../components/setlist/AddVerseModal'
import KeyPickerSheet from '../components/setlist/KeyPickerSheet'
import LibraryPane from '../components/setlist/LibraryPane'
import SetOptionsSheet from '../components/setlist/SetOptionsSheet'
import SetlistTimeline, { type TimelineCallbacks } from '../components/setlist/SetlistTimeline'
import ShareSetSheet from '../components/setlist/ShareSetSheet'
import Button from '../components/Button'
import Card from '../components/Card'
import HeaderIconButton from '../components/HeaderIconButton'
import Screen from '../components/Screen'
import SymbolIcon from '../components/SymbolIcon'
import { actionFailureMessage } from '../lib/errors'
import { exportSetlist } from '../lib/exportSong'
import { defaultSetlistName } from '../lib/setlistName'
import { buildSetlistShareUrl } from '../lib/setlistShare'
import { supabase } from '../lib/supabase'
import { useIsTabletWidth } from '../lib/useIsTabletWidth'
import { useSetlistBuilder } from '../lib/useSetlistBuilder'
import { uuidv4 } from '../lib/uuid'
import { useTheme } from '../theme/ThemeProvider'

export default function SetlistBuilderScreen({ setlistId }: { setlistId: string }) {
  const theme = useTheme()
  const { t, i18n } = useTranslation(['setlist', 'common', 'export', 'errors'])
  const router = useRouter()
  const tablet = useIsTabletWidth()
  const builder = useSetlistBuilder(setlistId)
  const { name, items, songs, songsLoading, loading, notFound, loadFailed, error,
    retryLoad, setName, toggleSong, addVerse, removeEntry, duplicateEntry, moveEntry, setKeyFor,
    deleteSet, updatedAt } = builder

  const [renaming, setRenaming] = useState(false)
  const [draftName, setDraftName] = useState('')
  const nameInput = useRef<TextInput>(null)
  const [keyIndex, setKeyIndex] = useState<number | null>(null)
  const [optionsOpen, setOptionsOpen] = useState(false)
  const [shareOpen, setShareOpen] = useState(false)
  const [addSongsOpen, setAddSongsOpen] = useState(false)
  const [addVerseOpen, setAddVerseOpen] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)
  const noticeTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  useEffect(() => () => { if (noticeTimer.current) clearTimeout(noticeTimer.current) }, [])

  const keys = useMemo(() => items.map((item) => effectiveKey(item, item.song)), [items])
  const songIds = useMemo(() => new Set(items.map((item) => item.songId)), [items])
  const summary = useMemo(() => summarizeSet(items.map((item) => ({
    toKey: item.toKey, default_key: item.song.default_key, tempo: item.song.tempo,
  }))), [items])

  function showNotice(message: string) {
    if (noticeTimer.current) clearTimeout(noticeTimer.current)
    setNotice(message)
    noticeTimer.current = setTimeout(() => setNotice(null), 1900)
  }

  function beginRename() { setDraftName(name); setRenaming(true) }
  function finishRename() {
    const trimmed = draftName.trim()
    if (trimmed && trimmed !== name) setName(trimmed)
    setRenaming(false)
  }

  const openSong = useCallback((index: number) => {
    const item = items[index]
    if (!item) return
    router.push({ pathname: '/viewer/[slug]', params: {
      slug: item.song.slug, title: item.song.title, songKey: item.song.default_key ?? '',
      ...(keys[index] ? { initialKey: keys[index] } : {}),
    } })
  }, [items, keys, router])

  const timelineActions: TimelineCallbacks = useMemo(() => ({
    onPressRow: openSong,
    onKeyTap: setKeyIndex,
    onMove: (from, to) => {
      const before = items[from]?.entryKey
      const after = items[to]?.entryKey
      if (before && after) moveEntry(before, after)
    },
    onRemove: (index) => {
      const key = items[index]?.entryKey
      if (key) { removeEntry(key); showNotice(t('toasts.removedFromSet')) }
    },
    onDuplicate: (index) => {
      const key = items[index]?.entryKey
      if (key) duplicateEntry(key)
    },
  }), [openSong, items, moveEntry, removeEntry, duplicateEntry, t])

  function confirmDelete() {
    Alert.alert(t('alerts.deleteSetTitle'), t('alerts.deleteSetMessage', { name }), [
      { text: t('common:cancel'), style: 'cancel' },
      { text: t('common:delete'), style: 'destructive', onPress: async () => {
        try { await deleteSet(); router.back() } catch (failure) {
          Alert.alert(t('alerts.couldNotDelete'), actionFailureMessage('SetlistBuilder.delete', failure, t))
        }
      } },
    ])
  }

  function createAnother() {
    const id = uuidv4()
    const nextName = defaultSetlistName((key, options) => t(key, options), i18n.language)
    router.replace(`/setlist/${id}`)
    void createSetlist(supabase, { id, name: nextName }).catch((failure) =>
      Alert.alert(t('alerts.couldNotCreate'), actionFailureMessage('SetlistBuilder.create', failure, t)))
  }

  async function copyLink() {
    if (!items.length) { showNotice(t('toasts.addSongsFirst')); return }
    try {
      await Clipboard.setStringAsync(buildSetlistShareUrl(items))
      showNotice(t('toasts.setLinkCopied'))
    } catch (failure) {
      Alert.alert(t('alerts.couldNotCopyLink'), actionFailureMessage('SetlistBuilder.copyLink', failure, t))
    }
  }

  async function sharePdf() {
    if (!items.length) { showNotice(t('toasts.addSongsFirst')); return }
    try {
      const uri = await exportSetlist(items.map((item, index) => ({ songId: item.songId, key: keys[index] })))
      await Sharing.shareAsync(uri)
    } catch (failure) {
      Alert.alert(t('export:alerts.exportFailedTitle'), actionFailureMessage('SetlistBuilder.export', failure, t))
    }
  }

  function message(text: string, retry = false) {
    return <Screen edges={['top', 'left', 'right', 'bottom']}>
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: theme.spacing.lg, padding: theme.spacing.xl }}>
        <Text style={{ color: theme.colors.sec, textAlign: 'center' }}>{text}</Text>
        {retry && <Button title={t('common:retry')} onPress={retryLoad} fullWidth={false} />}
        {retry && <Pressable accessibilityRole="button" onPress={() => router.back()}>
          <Text style={{ color: theme.colors.textAccent }}>{t('builder.backToSets')}</Text>
        </Pressable>}
      </View>
    </Screen>
  }

  if (notFound) return message(t('builder.notFound'))
  if (loadFailed) return message(t('builder.loadFailed'), true)

  const edited = timeAgo(updatedAt, (key, options) => t(`common:${key}`, options), i18n.language)
  const pane = <>
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: theme.spacing.lg, paddingVertical: theme.spacing.sm }}>
      <Pressable accessibilityRole="button" accessibilityLabel={t('builder.backToSetlists')}
        onPress={() => router.back()} hitSlop={8} style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}>
        <SymbolIcon name="chevron.left" size={17} color={theme.colors.textAccent} weight="semibold" />
        <Text style={{ color: theme.colors.textAccent, fontSize: 16 }}>{t('builder.back')}</Text>
      </Pressable>
      <View style={{ flexDirection: 'row', gap: theme.spacing.sm }}>
        <HeaderIconButton icon="ellipsis" label={t('builder.setlistOptions')} onPress={() => setOptionsOpen(true)} />
        <HeaderIconButton icon="square.and.arrow.up" iconSize={22} label={t('export:exportAndShare')}
          onPress={() => setShareOpen(true)} />
      </View>
    </View>

    {loading ? <View style={{ flex: 1, justifyContent: 'center' }}><ActivityIndicator color={theme.colors.accent} /></View>
      : <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingHorizontal: theme.spacing.lg, paddingBottom: theme.spacing.xl }}>
        <Card style={{ padding: theme.spacing.lg, marginBottom: theme.spacing.lg }}>
          {renaming ? <View style={{ gap: theme.spacing.sm }}>
            <Text style={{ ...theme.typography.overline, color: theme.colors.sec }}>{t('builder.setName')}</Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', height: 46, paddingHorizontal: 12,
              borderWidth: 1.5, borderColor: theme.colors.accent, borderRadius: theme.radii.md }}>
              <TextInput ref={nameInput} value={draftName} onChangeText={setDraftName} autoFocus
                selectTextOnFocus returnKeyType="done" onSubmitEditing={finishRename}
                accessibilityLabel={t('builder.setName')}
                style={{ flex: 1, color: theme.colors.ink, fontSize: 17, fontWeight: '600', padding: 0 }} />
              <Pressable accessibilityRole="button" accessibilityLabel={t('builder.clearSetName')}
                onPress={() => { setDraftName(''); nameInput.current?.focus() }} hitSlop={8}>
                <SymbolIcon name="xmark.circle.fill" size={18} color={theme.colors.sec} />
              </Pressable>
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
              <Text style={{ color: theme.colors.sec }}>{formatSetSummary(summary)}</Text>
              <Button title={t('common:done')} onPress={finishRename} fullWidth={false} style={{ height: 40 }} />
            </View>
          </View> : <Pressable accessibilityRole="button" accessibilityLabel={t('builder.renameSet')} onPress={beginRename}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm }}>
              <Text numberOfLines={1} style={{ color: theme.colors.ink, fontSize: 22, fontWeight: '700', flexShrink: 1 }}>{name}</Text>
              <SymbolIcon name="pencil" size={15} color={theme.colors.sec} />
            </View>
            <Text style={{ color: theme.colors.sec, marginTop: 6 }}>{formatSetSummary(summary)}</Text>
            {edited && <Text style={{ color: theme.colors.sec, marginTop: 2 }}>{t('builder.lastEdited', { time: edited })}</Text>}
          </Pressable>}
        </Card>
        {error && <Text style={{ color: theme.colors.danger, marginBottom: theme.spacing.sm }}>{t(error)}</Text>}
        {items.length
          ? <SetlistTimeline items={items} effectiveKeys={keys} callbacks={timelineActions} />
          : <View style={{ alignItems: 'center', paddingVertical: theme.spacing.xxl, gap: 4 }}>
              <Text style={{ color: theme.colors.ink, fontWeight: '600' }}>{t('builder.noSongs')}</Text>
              <Text style={{ color: theme.colors.sec }}>
                {tablet ? t('builder.addHintTablet') : t('builder.addHintPhone')}
              </Text>
            </View>}
      </ScrollView>}

    <View style={{ flexDirection: 'row', gap: theme.spacing.sm, paddingHorizontal: theme.spacing.lg,
      paddingTop: theme.spacing.sm }}>
      {!tablet && <Pressable accessibilityRole="button" accessibilityLabel={t('builder.addSongs')}
        onPress={() => setAddSongsOpen(true)} style={{ height: 48, paddingHorizontal: theme.spacing.lg,
          borderRadius: theme.radii.md, backgroundColor: theme.colors.surfaceAlt,
          flexDirection: 'row', alignItems: 'center', gap: 6 }}>
        <SymbolIcon name="plus" size={16} color={theme.colors.ink} weight="semibold" />
        <Text style={{ color: theme.colors.ink, fontWeight: '600' }}>{t('builder.add')}</Text>
      </Pressable>}
      <Pressable accessibilityRole="button" accessibilityLabel={t('verse.add')}
        onPress={() => setAddVerseOpen(true)} style={{ height: 48, paddingHorizontal: theme.spacing.lg,
          borderRadius: theme.radii.md, backgroundColor: theme.colors.surfaceAlt,
          flexDirection: 'row', alignItems: 'center', gap: 6 }}>
        <SymbolIcon name="book.closed" size={16} color={theme.colors.ink} weight="semibold" />
        <Text style={{ color: theme.colors.ink, fontWeight: '600' }}>{t('verse.add')}</Text>
      </Pressable>
      <Button title={t('builder.startSet')} onPress={() => router.push(`/perform/${setlistId}`)}
        disabled={!items.length} style={{ flex: 1 }} fullWidth={false} />
    </View>
    {notice && <View style={{ position: 'absolute', bottom: 84, alignSelf: 'center',
      backgroundColor: theme.colors.ink, borderRadius: theme.radii.pill,
      paddingHorizontal: theme.spacing.lg, paddingVertical: 10 }}>
      <Text style={{ color: theme.colors.bg }}>{notice}</Text>
    </View>}
  </>

  return <Screen edges={['top', 'left', 'right', 'bottom']}>
    {tablet ? <View style={{ flex: 1, flexDirection: 'row' }}>
      <View style={{ flex: theme.layout.split.list, borderRightWidth: 1, borderRightColor: theme.colors.border }}>
        <LibraryPane songs={songs} addedSongIds={songIds} onToggle={toggleSong} loading={songsLoading} />
      </View>
      <View style={{ flex: theme.layout.split.detail }}>{pane}</View>
    </View> : pane}
    <KeyPickerSheet visible={keyIndex != null} onClose={() => setKeyIndex(null)}
      songTitle={keyIndex != null ? items[keyIndex]?.song.title ?? null : null}
      currentKey={keyIndex != null ? keys[keyIndex] ?? null : null}
      nativeKey={keyIndex != null ? items[keyIndex]?.song.default_key ?? null : null}
      hasOverride={keyIndex != null ? items[keyIndex]?.toKey != null : false}
      onPick={(key) => { const entryKey = keyIndex != null ? items[keyIndex]?.entryKey : null;
        if (entryKey) setKeyFor(entryKey, key) }} />
    <SetOptionsSheet visible={optionsOpen} onClose={() => setOptionsOpen(false)}
      onRename={beginRename} onSavedSets={() => router.navigate('/setlists')}
      onNewSet={createAnother} onDeleteSet={confirmDelete} />
    <ShareSetSheet visible={shareOpen} onClose={() => setShareOpen(false)}
      songCount={items.length} onExport={sharePdf} onCopyLink={copyLink} />
    <AddSongsModal visible={addSongsOpen} onClose={() => setAddSongsOpen(false)}
      songs={songs} addedSongIds={songIds} onToggle={toggleSong} />
    <AddVerseModal visible={addVerseOpen} onClose={() => setAddVerseOpen(false)} onAdd={addVerse} />
  </Screen>
}
