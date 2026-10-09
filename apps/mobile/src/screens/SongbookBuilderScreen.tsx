import { useCallback, useMemo, useReducer, useState } from 'react'
import { Alert, Pressable, ScrollView, Text, View } from 'react-native'
import { router } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useTranslation } from 'react-i18next'
import * as ImagePicker from 'expo-image-picker'
import * as Sharing from 'expo-sharing'
import Screen from '../components/Screen'
import Card from '../components/Card'
import ListRow from '../components/ListRow'
import Button from '../components/Button'
import SectionHeader from '../components/SectionHeader'
import SymbolIcon from '../components/SymbolIcon'
import AddSongsModal from '../components/setlist/AddSongsModal'
import SongbookOptionsSheet from '../components/songbook/SongbookOptionsSheet'
import { useTheme } from '../theme/ThemeProvider'
import { useSongList, type Song } from '../lib/useSongList'
import { exportSongbook } from '../lib/exportSong'
import { actionFailureMessage } from '../lib/errors'
import {
  createSongbookDraft,
  reduceSongbookDraft,
  selectedSongbookSongs,
} from '../lib/songbookModel'

// Utilities tool: build a songbook PDF. Pick songs (reusing the setlist
// AddSongsModal), optionally name it / add a cover image / toggle a numbered
// table of contents, then export one combined PDF (server-rendered via
// /api/export/songbook, the same pdf_mvp engine the web songbook uses) and hand
// it to the system share sheet. Songs always render alphabetically in their
// default key.
//
// `embedded`: rendered inside the Utilities tab's tablet split (right pane) —
// drops the back link and top safe-area padding.

// Server rejects a cover data URL over ~3 MB; guard client-side with a friendly
// message before the round-trip.
const MAX_COVER_CHARS = 3 * 1024 * 1024

function defaultDate() {
  const d = new Date()
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return `${mm}.${dd}.${d.getFullYear()}`
}

export default function SongbookBuilderScreen({ embedded }: { embedded?: boolean }) {
  const t = useTheme()
  const { t: tx, i18n } = useTranslation(['utilities', 'export', 'nav', 'common'])
  const insets = useSafeAreaInsets()
  const { songs, loading } = useSongList()

  const [addOpen, setAddOpen] = useState(false)
  const [optionsOpen, setOptionsOpen] = useState(false)
  const [draft, dispatch] = useReducer(
    reduceSongbookDraft,
    undefined,
    () => createSongbookDraft(tx('songbook.defaultTitle'), defaultDate()),
  )

  const selectedSongs = useMemo(
    () => selectedSongbookSongs(songs, draft.selectedIds, i18n.language),
    [songs, draft.selectedIds, i18n.language],
  )

  const toggleSong = useCallback((song: Song) => {
    dispatch({ type: 'toggleSong', id: song.id })
  }, [])

  const pickCover = useCallback(async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        quality: 0.7,
        base64: true,
      })
      if (result.canceled) return
      const asset = result.assets?.[0]
      if (!asset?.base64) return
      const mime = asset.mimeType || 'image/jpeg'
      const dataUrl = `data:${mime};base64,${asset.base64}`
      if (dataUrl.length > MAX_COVER_CHARS) {
        Alert.alert(tx('songbook.coverTooLargeTitle'), tx('songbook.coverTooLarge'))
        return
      }
      dispatch({
        type: 'cover',
        dataUrl,
        name: asset.fileName || tx('songbook.coverLabel'),
      })
    } catch (err: unknown) {
      Alert.alert(tx('songbook.pickCoverErrorTitle'), actionFailureMessage('SongbookBuilder.pickCover', err, tx))
    }
  }, [tx])

  const clearCover = useCallback(() => {
    dispatch({ type: 'clearCover' })
  }, [])

  const onExport = useCallback(async () => {
    if (selectedSongs.length === 0) return
    try {
      const uri = await exportSongbook({
        items: selectedSongs.map((s) => ({ songId: s.id })),
        title: draft.title.trim(),
        subtitle: draft.subtitle.trim(),
        includeTOC: draft.includeTOC,
        coverImageDataUrl: draft.coverImageDataUrl,
      })
      await Sharing.shareAsync(uri)
    } catch (err: unknown) {
      Alert.alert(tx('export:alerts.exportFailedTitle'), actionFailureMessage('SongbookBuilder.export', err, tx))
    }
  }, [selectedSongs, draft, tx])

  const body = (
    <>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{
          paddingHorizontal: t.spacing.lg,
          paddingBottom: t.spacing.xxl,
          gap: t.spacing.md,
        }}
      >
        <Button
          variant="secondary"
          title={tx('songbook.addSongs')}
          onPress={() => setAddOpen(true)}
        />

        <SectionHeader label={tx('songbook.selectedCount', { count: selectedSongs.length })} />

        {selectedSongs.length === 0 ? (
          <Text style={{ fontSize: t.typography.body.fontSize, color: t.colors.sec, paddingHorizontal: t.spacing.xs }}>
            {tx('songbook.noneSelected')}
          </Text>
        ) : (
          <Card>
            {selectedSongs.map((s, i) => (
              <ListRow
                key={s.id}
                title={s.title}
                subtitle={s.artist}
                trailingTop={s.default_key}
                isLast={i === selectedSongs.length - 1}
                accessibilityLabel={tx('songbook.removeSong', { title: s.title })}
                onPress={() => toggleSong(s)}
                trailing={
                  <View
                    style={{
                      width: 30,
                      height: 30,
                      borderRadius: t.radii.pill,
                      alignItems: 'center',
                      justifyContent: 'center',
                      backgroundColor: t.colors.accentSoft,
                    }}
                  >
                    <SymbolIcon name="minus" size={15} weight="semibold" color={t.colors.textAccent} />
                  </View>
                }
              />
            ))}
          </Card>
        )}
      </ScrollView>

      {/* Pinned export CTA */}
      <View
        style={{
          paddingHorizontal: t.spacing.lg,
          paddingTop: t.spacing.md,
          paddingBottom: (embedded ? t.spacing.md : insets.bottom) + t.spacing.sm,
          borderTopWidth: 1,
          borderTopColor: t.colors.border,
          backgroundColor: t.colors.bg,
        }}
      >
        <Button
          variant="primary"
          title={tx('songbook.customizeExport')}
          disabled={selectedSongs.length === 0}
          onPress={() => setOptionsOpen(true)}
        />
      </View>

      <AddSongsModal
        visible={addOpen}
        onClose={() => setAddOpen(false)}
        songs={songs}
        addedSongIds={draft.selectedIds}
        onToggle={toggleSong}
      />

      <SongbookOptionsSheet
        visible={optionsOpen}
        onClose={() => setOptionsOpen(false)}
        songCount={selectedSongs.length}
        title={draft.title}
        onChangeTitle={(value) => dispatch({ type: 'title', value })}
        subtitle={draft.subtitle}
        onChangeSubtitle={(value) => dispatch({ type: 'subtitle', value })}
        includeTOC={draft.includeTOC}
        onToggleTOC={(value) => dispatch({ type: 'includeTOC', value })}
        coverImageDataUrl={draft.coverImageDataUrl}
        coverName={draft.coverName}
        onPickCover={pickCover}
        onClearCover={clearCover}
        onExport={onExport}
      />
    </>
  )

  return (
    <Screen edges={embedded ? ['left', 'right'] : ['top', 'left', 'right']}>
      {/* Top bar: back link (route) or spacer (embedded), centered title. */}
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          paddingTop: embedded ? t.spacing.sm : t.spacing.xs,
          paddingHorizontal: t.spacing.md,
          paddingBottom: t.spacing.sm,
        }}
      >
        {embedded ? (
          <View style={{ width: 90 }} />
        ) : (
          <Pressable
            onPress={() => router.back()}
            accessibilityRole="button"
            accessibilityLabel={tx('common:back')}
            hitSlop={8}
            style={{ flexDirection: 'row', alignItems: 'center', gap: 2, width: 90 }}
          >
            <SymbolIcon name="chevron.left" size={22} color={t.colors.accent} />
            <Text style={{ fontSize: 16, fontWeight: '500', color: t.colors.textAccent }}>{tx('nav:utilities')}</Text>
          </Pressable>
        )}
        <Text style={{ fontSize: 16, fontWeight: '600', color: t.colors.ink }}>{tx('songbook.title')}</Text>
        <View style={{ width: 90 }} />
      </View>

      {loading && songs.length === 0 ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <Text style={{ fontSize: t.typography.body.fontSize, color: t.colors.sec }}>
            {tx('common:loading')}
          </Text>
        </View>
      ) : (
        body
      )}
    </Screen>
  )
}
