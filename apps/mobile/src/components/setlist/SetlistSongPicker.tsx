import { useMemo } from 'react'
import { ActivityIndicator, FlatList, Pressable, Text, TextInput, View } from 'react-native'
import { useTranslation } from 'react-i18next'
import ListRow from '../ListRow'
import SymbolIcon from '../SymbolIcon'
import { buildSongPickerRows } from '../../lib/setlistSongPicker'
import type { Song } from '../../lib/useSongList'
import { useTheme } from '../../theme/ThemeProvider'

type Props = {
  songs: Song[]
  selectedIds: ReadonlySet<string>
  query: string
  onChangeQuery: (query: string) => void
  onToggle: (song: Song) => void
  loading?: boolean
  bottomInset?: number
  surface?: boolean
}

export default function SetlistSongPicker({
  songs,
  selectedIds,
  query,
  onChangeQuery,
  onToggle,
  loading = false,
  bottomInset = 0,
  surface = false,
}: Props) {
  const theme = useTheme()
  const { t, i18n } = useTranslation(['setlist', 'common'])
  const rows = useMemo(
    () => buildSongPickerRows(songs, selectedIds, query, i18n.language),
    [songs, selectedIds, query, i18n.language],
  )
  const hasQuery = query.trim().length > 0

  return (
    <View style={{ flex: 1, backgroundColor: surface ? theme.colors.surface : theme.colors.bg }}>
      <View style={{ paddingHorizontal: theme.spacing.lg, paddingBottom: theme.spacing.sm }}>
        <View style={{
          height: 44,
          paddingHorizontal: 12,
          borderRadius: theme.radii.sm,
          backgroundColor: theme.colors.surfaceAlt,
          flexDirection: 'row',
          alignItems: 'center',
          gap: 8,
        }}>
          <SymbolIcon name="magnifyingglass" size={18} color={theme.colors.sec} />
          <TextInput
            value={query}
            onChangeText={onChangeQuery}
            placeholder={t('addSongs.searchPlaceholder')}
            placeholderTextColor={theme.colors.sec}
            accessibilityLabel={t('libraryPane.searchLibrary')}
            returnKeyType="search"
            autoCorrect={false}
            style={{ flex: 1, padding: 0, fontSize: 16, color: theme.colors.ink }}
          />
          {query.length > 0 && (
            <Pressable
              onPress={() => onChangeQuery('')}
              accessibilityRole="button"
              accessibilityLabel={t('addSongs.clearSearch')}
              hitSlop={8}
            >
              <SymbolIcon name="xmark.circle.fill" size={17} color={theme.colors.sec} />
            </Pressable>
          )}
        </View>
      </View>

      {loading && songs.length === 0 ? (
        <ActivityIndicator color={theme.colors.accent} style={{ marginTop: theme.spacing.xl }} />
      ) : (
        <FlatList
          data={rows}
          keyExtractor={(row) => row.song.id}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="interactive"
          contentContainerStyle={{ paddingBottom: bottomInset + theme.spacing.lg, flexGrow: 1 }}
          ListEmptyComponent={
            <View style={{ alignItems: 'center', padding: theme.spacing.xl }}>
              <Text style={{ color: theme.colors.sec, textAlign: 'center' }}>
                {hasQuery
                  ? t('addSongs.noMatches', { query: query.trim() })
                  : t('addSongs.emptyLibrary')}
              </Text>
            </View>
          }
          renderItem={({ item: row }) => (
            <ListRow
              title={row.song.title}
              subtitle={row.song.artist}
              trailingTop={row.song.default_key}
              accessibilityLabel={row.selected
                ? t('addSongs.remove', { title: row.song.title })
                : t('addSongs.add', { title: row.song.title })}
              onPress={() => onToggle(row.song)}
              trailing={
                <View style={{
                  width: 30,
                  height: 30,
                  borderRadius: theme.radii.pill,
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: row.selected ? theme.colors.accent : theme.colors.accentSoft,
                }}>
                  <SymbolIcon
                    name={row.selected ? 'checkmark' : 'plus'}
                    size={15}
                    weight="semibold"
                    color={row.selected ? theme.colors.onAccent : theme.colors.textAccent}
                  />
                </View>
              }
            />
          )}
        />
      )}
    </View>
  )
}
