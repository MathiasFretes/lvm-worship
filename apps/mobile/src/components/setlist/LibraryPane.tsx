import { useState } from 'react'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useKeyboardHeight } from '../../lib/useKeyboardHeight'
import type { Song } from '../../lib/useSongList'
import SetlistSongPicker from './SetlistSongPicker'

export default function LibraryPane({
  songs,
  addedSongIds,
  onToggle,
  loading,
}: {
  songs: Song[]
  addedSongIds: Set<string>
  onToggle: (song: Song) => void
  loading: boolean
}) {
  const insets = useSafeAreaInsets()
  const keyboardHeight = useKeyboardHeight()
  const [query, setQuery] = useState('')

  return (
    <SetlistSongPicker
      songs={songs}
      selectedIds={addedSongIds}
      query={query}
      onChangeQuery={setQuery}
      onToggle={onToggle}
      loading={loading}
      bottomInset={Math.max(keyboardHeight, insets.bottom)}
      surface
    />
  )
}
