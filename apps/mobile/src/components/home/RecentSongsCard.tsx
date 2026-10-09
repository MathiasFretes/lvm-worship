import { useCallback } from 'react'
import { Pressable, Text, View } from 'react-native'
import { useTranslation } from 'react-i18next'
import { useRouter } from 'expo-router'
import { cardStyle } from './cardStyle'
import { useTheme } from '../../theme/ThemeProvider'
import { getRecentlyOpened, type RecentSong } from '../../lib/recents'
import { formatKeyPair } from '../../lib/keyDisplay'

type RecentSongRowProps = {
  song: RecentSong
  divided: boolean
  onOpen: (song: RecentSong) => void
  tx: (key: string, options?: Record<string, unknown>) => string
}

function RecentSongRow({ song, divided, onOpen, tx }: RecentSongRowProps) {
  const theme = useTheme()
  const keyDisplay = formatKeyPair(song.default_key, song.lastKey, tx)

  return (
    <Pressable
      onPress={() => onOpen(song)}
      accessibilityRole="button"
      accessibilityLabel={tx('common:openSong', { title: song.title })}
      style={({ pressed }) => ({
        flexDirection: 'row',
        alignItems: 'center',
        gap: theme.spacing.md,
        paddingVertical: 10,
        borderTopWidth: divided ? 0.5 : 0,
        borderTopColor: theme.colors.border,
        opacity: pressed ? 0.6 : 1,
      })}
    >
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text
          numberOfLines={1}
          style={{
            fontSize: theme.typography.rowTitle.fontSize,
            fontWeight: theme.typography.rowTitle.fontWeight,
            letterSpacing: theme.typography.rowTitle.letterSpacing,
            color: theme.colors.ink,
          }}
        >
          {song.title}
        </Text>
        {song.artist ? (
          <Text
            numberOfLines={1}
            style={{ marginTop: 1, fontSize: theme.typography.rowSubtitle.fontSize, color: theme.colors.sec }}
          >
            {song.artist}
          </Text>
        ) : null}
      </View>
      {keyDisplay ? (
        <Text
          accessibilityLabel={keyDisplay.a11yLabel}
          style={{
            fontSize: theme.typography.rowKey.fontSize,
            fontWeight: theme.typography.rowKey.fontWeight,
            color: theme.colors.textAccent,
          }}
        >
          {keyDisplay.text}
        </Text>
      ) : null}
    </Pressable>
  )
}

export default function RecentSongsCard() {
  const t = useTheme()
  const { t: tx } = useTranslation(['home', 'common'])
  const router = useRouter()
  const recents = getRecentlyOpened().slice(0, t.layout.recentSongs)

  const openSong = useCallback(
    (song: RecentSong) => {
      router.push({
        pathname: '/viewer/[slug]',
        params: {
          slug: song.slug,
          title: song.title,
          songKey: song.default_key ?? '',
          ...(song.lastKey ? { initialKey: song.lastKey } : {}),
        },
      })
    },
    [router],
  )

  return (
    <View style={cardStyle(t)}>
      <Text
        style={{
          fontSize: 11,
          fontWeight: '700',
          letterSpacing: 0.7,
          textTransform: 'uppercase',
          color: t.colors.textAccent,
        }}
      >
        {tx('recentSongsCard.label')}
      </Text>

      {recents.length === 0 ? (
        <Text style={{ marginTop: t.spacing.md, fontSize: t.typography.rowSubtitle.fontSize, color: t.colors.sec }}>
          {tx('recentSongsCard.empty')}
        </Text>
      ) : (
        <View style={{ marginTop: t.spacing.xs }}>
          {recents.map((song, index) => (
            <RecentSongRow
              key={song.slug}
              song={song}
              divided={index > 0}
              onOpen={openSong}
              tx={tx}
            />
          ))}
        </View>
      )}
    </View>
  )
}
