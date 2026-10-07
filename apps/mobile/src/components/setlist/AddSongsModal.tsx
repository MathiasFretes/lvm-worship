import { useEffect, useState } from 'react'
import { Modal, Pressable, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useTranslation } from 'react-i18next'
import { useTheme } from '../../theme/ThemeProvider'
import { useKeyboardHeight } from '../../lib/useKeyboardHeight'
import type { Song } from '../../lib/useSongList'
import SetlistSongPicker from './SetlistSongPicker'

export default function AddSongsModal({
  visible,
  onClose,
  songs,
  addedSongIds,
  onToggle,
}: {
  visible: boolean
  onClose: () => void
  songs: Song[]
  addedSongIds: Set<string>
  onToggle: (song: Song) => void
}) {
  const t = useTheme()
  const { t: tx } = useTranslation(['setlist', 'common'])
  const insets = useSafeAreaInsets()
  // Keyboard-aware bottom inset: while the keyboard is up the list gains
  // exactly its height of padding, so the rows behind it can scroll into
  // view; when it closes the padding collapses back to the safe area (no
  // dead gap). iOS's automaticallyAdjustKeyboardInsets can't be trusted
  // inside a Modal, hence the explicit hook.
  const keyboardHeight = useKeyboardHeight()
  const [query, setQuery] = useState('')

  useEffect(() => {
    if (!visible) setQuery('')
  }, [visible])

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: t.colors.bg, paddingTop: insets.top }}>
        {/* Header */}
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            paddingHorizontal: t.spacing.lg,
            paddingVertical: t.spacing.sm,
          }}
        >
          <Text style={{ fontSize: 18, fontWeight: '700', letterSpacing: -0.3, color: t.colors.ink }}>
            {tx('addSongs.title')}
          </Text>
          <Pressable onPress={onClose} accessibilityRole="button" accessibilityLabel={tx('addSongs.doneAdding')} hitSlop={8}>
            <Text style={{ fontSize: 16, fontWeight: '600', color: t.colors.textAccent }}>{tx('common:done')}</Text>
          </Pressable>
        </View>

        <SetlistSongPicker
          songs={songs}
          selectedIds={addedSongIds}
          query={query}
          onChangeQuery={setQuery}
          onToggle={onToggle}
          bottomInset={Math.max(keyboardHeight, insets.bottom)}
        />
      </View>
    </Modal>
  )
}
