import { useCallback, useMemo, useRef, useState } from 'react'
import { ActivityIndicator, Pressable, SectionList, Text, TextInput, useWindowDimensions, View } from 'react-native'
import { useRouter } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useTranslation } from 'react-i18next'
import * as Crypto from 'expo-crypto'
import { BLANK_SONG_FORM } from '@lavozmisionera/core'
import AlphaScrubber from '../components/AlphaScrubber'
import EmptyState from '../components/EmptyState'
import FilterSortSheet, { type SortDir, type SortKey } from '../components/FilterSortSheet'
import ListRow from '../components/ListRow'
import { songBadge } from '../components/PersonalChip'
import Screen from '../components/Screen'
import SectionHeader from '../components/SectionHeader'
import SymbolIcon from '../components/SymbolIcon'
import { upsertDraft } from '../lib/drafts/draftsStore'
import { chunkRows } from '../lib/gridRows'
import { makeLibrarySections, findLibrarySongs, type LibrarySection } from '../lib/libraryPresentation'
import { buildSectionListLayout, cellLayoutAt, listRowHeight, sectionHeaderHeight } from '../lib/listRowMetrics'
import { useIsTabletWidth } from '../lib/useIsTabletWidth'
import { useSongList, type Song } from '../lib/useSongList'
import { useTheme } from '../theme/ThemeProvider'

type Row = Song | Song[]
type Section = Omit<LibrarySection, 'data'> & { data: Row[] }

export default function SongLibraryScreen() {
  const theme = useTheme()
  const { t } = useTranslation(['song', 'common', 'errors'])
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const tablet = useIsTabletWidth()
  const { width, height, fontScale } = useWindowDimensions()
  const { songs, loading, error, reload } = useSongList()
  const columns = tablet
    ? width > height ? theme.layout.libraryColumns.landscape : theme.layout.libraryColumns.portrait
    : 1

  const [query, setQuery] = useState('')
  const [searching, setSearching] = useState(false)
  const [filterOpen, setFilterOpen] = useState(false)
  const [sortKey, setSortKey] = useState<SortKey>('title')
  const [sortDir, setSortDir] = useState<SortDir>('asc')
  const [tags, setTags] = useState<Set<string>>(() => new Set())
  const input = useRef<TextInput>(null)
  const list = useRef<SectionList<Row, Section>>(null)

  const allTags = useMemo(
    () => [...new Set(songs.flatMap((song) => song.tags ?? []))].sort(),
    [songs],
  )
  const visibleSongs = useMemo(
    () => tags.size ? songs.filter((song) => song.tags?.some((tag) => tags.has(tag))) : songs,
    [songs, tags],
  )
  const sections = useMemo(
    () => makeLibrarySections(visibleSongs, sortKey, sortDir,
      (key) => key ? t('common:keyOf', { key }) : t('library.noKey')),
    [visibleSongs, sortKey, sortDir, t],
  )
  const displayed = useMemo<Section[]>(
    () => sections.map((section) => ({
      ...section,
      data: columns === 1 ? section.data : chunkRows(section.data, columns),
    })),
    [sections, columns],
  )
  const results = useMemo(() => findLibrarySongs(visibleSongs, query), [visibleSongs, query])
  const resultRows = useMemo<Row[]>(
    () => columns === 1 ? results : chunkRows(results, columns),
    [results, columns],
  )

  const metrics = useMemo(() => buildSectionListLayout(displayed, {
    header: (section) => section.title ? sectionHeaderHeight(fontScale) : 0,
    item: (row) => {
      const items = Array.isArray(row) ? row : [row]
      return listRowHeight({
        subtitle: Array.isArray(row) || items.some((item) => Boolean(item.artist)),
        key: items.some((item) => Boolean(item.default_key)),
        meta: items.some((item) => Boolean(item.time_signature)),
      }, fontScale)
    },
  }), [displayed, fontScale])
  const getItemLayout = useCallback(
    (_data: unknown, index: number) => cellLayoutAt(metrics, index),
    [metrics],
  )

  const azEnabled = !searching && (sortKey === 'title' || sortKey === 'artist')
  const letters = useMemo(() => new Set(azEnabled
    ? sections.map((section) => section.letter).filter((letter): letter is string => Boolean(letter))
    : []), [azEnabled, sections])
  const filtersActive = sortKey !== 'title' || sortDir !== 'asc' || tags.size > 0

  function openSong(song: Song) {
    router.push({
      pathname: '/viewer/[slug]',
      params: {
        slug: song.source === 'personal' ? song.personalId! : song.slug,
        title: song.title,
        songKey: song.default_key ?? '',
        ...(song.source === 'personal' ? { source: 'personal', personalId: song.personalId! } : {}),
      },
    })
  }

  function addSong() {
    const draftId = Crypto.randomUUID()
    upsertDraft({ id: draftId, form: { ...BLANK_SONG_FORM }, status: 'draft', updatedAt: '' })
    router.push({ pathname: '/editor/[draftId]', params: { draftId } })
  }

  function toggleTag(tag: string) {
    setTags((current) => {
      const next = new Set(current)
      if (next.has(tag)) next.delete(tag)
      else next.add(tag)
      return next
    })
  }

  function toggleSort(key: SortKey) {
    if (key === sortKey) setSortDir((current) => current === 'asc' ? 'desc' : 'asc')
    else { setSortKey(key); setSortDir('asc') }
  }

  function cancelSearch() {
    setQuery('')
    setSearching(false)
    input.current?.blur()
  }

  function jumpTo(letter: string) {
    const index = displayed.findIndex((section) => section.letter === letter)
    if (index >= 0) list.current?.scrollToLocation({
      sectionIndex: index, itemIndex: 0, animated: false, viewPosition: 0,
    })
  }

  function row({ item }: { item: Row }) {
    const entries = Array.isArray(item) ? item : [item]
    return (
      <View style={{ flexDirection: 'row' }}>
        {entries.map((song) => (
          <View key={song.id} style={{ flex: 1 }}>
            <ListRow
              title={song.title}
              subtitle={Array.isArray(item) ? song.artist || ' ' : song.artist}
              badge={songBadge(song.source, song.reviewStatus)}
              trailingTop={song.default_key ?? undefined}
              trailingBottom={song.time_signature ?? undefined}
              onPress={() => openSong(song)}
            />
          </View>
        ))}
        {Array.from({ length: columns - entries.length }, (_, index) =>
          <View key={`empty-${index}`} style={{ flex: 1 }} />)}
      </View>
    )
  }

  function message(text: string) {
    return <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: theme.spacing.xl }}>
      <Text style={{ color: theme.colors.sec, textAlign: 'center' }}>{text}</Text>
    </View>
  }

  function body() {
    if (loading) return <View style={{ flex: 1, justifyContent: 'center' }}>
      <ActivityIndicator color={theme.colors.accent} />
    </View>
    if (error) return <EmptyState icon="wifi.slash" title={t(error)} subtitle={t('errors:load.hint')}
      actionLabel={t('common:retry')} onAction={reload} />
    if (!songs.length) return message(t('library.empty'))

    if (searching) {
      if (!query.trim()) return <View style={{ flex: 1 }} />
      if (!results.length) return message(t('library.noMatchesForQuery', { query: query.trim() }))
      return <SectionList
        sections={[{ key: '__results', title: '', letter: null, data: resultRows }]}
        keyExtractor={(item) => Array.isArray(item) ? item[0].id : item.id}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ paddingBottom: insets.bottom + theme.spacing.xl }}
        renderSectionHeader={() => <View style={{ backgroundColor: theme.colors.bg, paddingHorizontal: theme.spacing.xl, paddingVertical: 6 }}>
          <Text style={{ ...theme.typography.overline, color: theme.colors.sec, textTransform: 'uppercase' }}>
            {t('library.results', { count: results.length })}
          </Text>
        </View>}
        renderItem={row}
      />
    }

    if (!sections.length) return message(t('library.noMatchesFilters'))
    return <View style={{ flex: 1 }}>
      <SectionList
        ref={list}
        sections={displayed}
        keyExtractor={(item) => Array.isArray(item) ? item[0].id : item.id}
        stickySectionHeadersEnabled
        renderSectionHeader={({ section }) => section.title ? <SectionHeader label={section.title} /> : null}
        renderItem={row}
        getItemLayout={getItemLayout}
        contentContainerStyle={{ paddingBottom: insets.bottom + theme.spacing.xl }}
      />
      {azEnabled && <AlphaScrubber present={letters} onSelect={jumpTo} />}
    </View>
  }

  return <Screen edges={['top', 'left', 'right']}>
    <View style={{ paddingHorizontal: theme.spacing.lg, paddingTop: theme.spacing.sm, paddingBottom: theme.spacing.sm }}>
      {!searching && <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
        <Text style={{ ...theme.typography.largeTitle, color: theme.colors.ink }}>{t('library.title')}</Text>
        <Pressable accessibilityRole="button" accessibilityLabel={t('library.addSong')} onPress={addSong}
          hitSlop={8} style={{ width: 44, height: 44, borderRadius: theme.radii.pill,
            backgroundColor: theme.colors.accent, alignItems: 'center', justifyContent: 'center' }}>
          <SymbolIcon name="plus" size={20} color={theme.colors.onAccent} weight="semibold" />
        </Pressable>
      </View>}
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
        <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8,
          height: 44, paddingHorizontal: 12, backgroundColor: theme.colors.surfaceAlt,
          borderRadius: theme.radii.sm }}>
          <SymbolIcon name="magnifyingglass" size={18} color={theme.colors.sec} />
          <TextInput ref={input} value={query} onChangeText={setQuery} onFocus={() => setSearching(true)}
            placeholder={t('library.searchPlaceholder')} placeholderTextColor={theme.colors.sec}
            autoCorrect={false} returnKeyType="search" style={{ flex: 1, fontSize: 16, color: theme.colors.ink, padding: 0 }} />
        </View>
        {searching
          ? <Pressable accessibilityRole="button" onPress={cancelSearch} hitSlop={8}>
              <Text style={{ color: theme.colors.textAccent, fontSize: 16 }}>{t('common:cancel')}</Text>
            </Pressable>
          : <Pressable accessibilityRole="button" accessibilityLabel={t('library.filterAndSort')}
              onPress={() => setFilterOpen(true)} style={{ width: 44, height: 44,
                borderRadius: theme.radii.sm, backgroundColor: theme.colors.surfaceAlt,
                alignItems: 'center', justifyContent: 'center' }}>
              <SymbolIcon name="line.3.horizontal.decrease" size={22} color={theme.colors.accent} />
              {filtersActive && <View style={{ position: 'absolute', top: 8, right: 8, width: 9, height: 9,
                borderRadius: theme.radii.pill, backgroundColor: theme.colors.accent }} />}
            </Pressable>}
      </View>
    </View>
    {body()}
    <FilterSortSheet visible={filterOpen} onClose={() => setFilterOpen(false)}
      sortKey={sortKey} sortDir={sortDir} onToggleSort={toggleSort} availableTags={allTags}
      selectedTags={tags} onToggleTag={toggleTag} resultCount={visibleSongs.length}
      onReset={() => { setSortKey('title'); setSortDir('asc'); setTags(new Set()) }} />
  </Screen>
}
