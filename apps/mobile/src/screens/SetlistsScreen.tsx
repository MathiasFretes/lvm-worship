import { useCallback, useState } from 'react'
import { Alert, FlatList, Pressable, RefreshControl, ScrollView, Text, View } from 'react-native'
import { useFocusEffect, useRouter } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useTranslation } from 'react-i18next'
import { duplicateSetlist, nextCopyName, timeAgo } from '@lavozmisionera/core'
import ConstrainedContent from '../components/ConstrainedContent'
import EmptyState from '../components/EmptyState'
import ListRow from '../components/ListRow'
import LoadingSkeleton from '../components/LoadingSkeleton'
import Screen from '../components/Screen'
import SwipeToDelete from '../components/SwipeToDelete'
import SymbolIcon from '../components/SymbolIcon'
import PruneSetlistsModal from '../components/setlist/PruneSetlistsModal'
import { actionFailureMessage, errMessage } from '../lib/errors'
import { defaultSetlistName } from '../lib/setlistName'
import { supabase } from '../lib/supabase'
import { useSetlists, type SetlistRow } from '../lib/useSetlists'
import { uuidv4 } from '../lib/uuid'
import { useTheme } from '../theme/ThemeProvider'

/** LVM's setlist home: retain the existing data contract while owning the flow. */
export default function SetlistsScreen() {
  const theme = useTheme()
  const insets = useSafeAreaInsets()
  const router = useRouter()
  const { t, i18n } = useTranslation(['setlist', 'common', 'errors'])
  const { setlists, loading, error, refresh, create, remove, removeMany, limit, atLimit } = useSetlists()
  const [refreshing, setRefreshing] = useState(false)
  const [creating, setCreating] = useState(false)
  const [pruneOpen, setPruneOpen] = useState(false)
  const [duplicatingId, setDuplicatingId] = useState<string | null>(null)

  useFocusEffect(useCallback(() => { void refresh() }, [refresh]))

  async function onRefresh() {
    setRefreshing(true)
    const started = Date.now()
    try {
      await refresh()
      const remaining = 500 - (Date.now() - started)
      if (remaining > 0) await new Promise((resolve) => setTimeout(resolve, remaining))
    } finally { setRefreshing(false) }
  }

  async function onCreate() {
    if (creating) return
    if (atLimit) { setPruneOpen(true); return }
    setCreating(true)
    const id = uuidv4()
    const name = defaultSetlistName(
      (key, options) => t(key, options),
      i18n.language,
      setlists.map(({ name: existing }) => existing),
    )
    router.push(`/setlist/${id}`)
    try {
      await create({ id, name })
    } catch (failure) {
      router.back()
      if (errMessage(failure).includes('PERSONAL_SETLIST_LIMIT_REACHED')) {
        await refresh()
        setPruneOpen(true)
      } else {
        Alert.alert(t('alerts.couldNotCreate'), actionFailureMessage('Setlists.create', failure, t))
      }
    } finally { setCreating(false) }
  }

  async function onDuplicate(item: SetlistRow) {
    if (duplicatingId) return
    if (atLimit) { setPruneOpen(true); return }
    setDuplicatingId(item.id)
    try {
      const name = nextCopyName(item.name, setlists.map((row) => row.name))
      await duplicateSetlist(supabase, item.id, name)
      await refresh()
    } catch (failure) {
      if (errMessage(failure).includes('PERSONAL_SETLIST_LIMIT_REACHED')) {
        await refresh()
        setPruneOpen(true)
      } else {
        Alert.alert(t('alerts.couldNotDuplicate'), actionFailureMessage('Setlists.duplicate', failure, t))
        await refresh()
      }
    } finally { setDuplicatingId(null) }
  }

  async function onDelete(item: SetlistRow) {
    try { await remove(item.id) } catch (failure) {
      Alert.alert(t('alerts.couldNotDelete'), actionFailureMessage('Setlists.delete', failure, t))
      await refresh()
    }
  }

  function details(item: SetlistRow) {
    const edited = timeAgo(item.updated_at, (key, options) => t(`common:${key}`, options), i18n.language)
    return [t('common:songCount', { count: item.songCount }), edited && t('editedAgo', { time: edited })]
      .filter(Boolean).join(' · ')
  }

  const refreshControl = <RefreshControl refreshing={refreshing} onRefresh={() => void onRefresh()} tintColor={theme.colors.muted} />
  const contentPadding = { paddingBottom: insets.bottom + theme.spacing.xl }

  function content() {
    if (loading) return <LoadingSkeleton label={t('syncing')} />
    if (error || setlists.length === 0) {
      return (
        <ScrollView contentContainerStyle={{ flexGrow: 1, ...contentPadding }} refreshControl={refreshControl}>
          <EmptyState
            icon={error ? 'wifi.slash' : 'list.bullet'}
            title={error ? t(error) : t('empty')}
            subtitle={error ? t('errors:load.hint') : undefined}
            actionLabel={error ? t('common:retry') : t('newSet')}
            onAction={error ? () => void refresh() : () => void onCreate()}
          />
        </ScrollView>
      )
    }
    return (
      <FlatList
        data={setlists}
        keyExtractor={(item) => item.id}
        refreshControl={refreshControl}
        contentContainerStyle={contentPadding}
        renderItem={({ item }) => (
          <SwipeToDelete
            onDelete={() => void onDelete(item)}
            confirm={{ title: t('deleteConfirm.title', { name: item.name }), message: t('deleteConfirm.message') }}
            secondary={{ label: t('rowActions.duplicate'), icon: 'plus.square.on.square', onPress: () => void onDuplicate(item) }}
          >
            <ListRow title={item.name} subtitle={details(item)} onPress={() => router.push(`/setlist/${item.id}`)} />
          </SwipeToDelete>
        )}
      />
    )
  }

  return (
    <Screen edges={['top', 'left', 'right']}>
      <ConstrainedContent tier="content" style={{ flex: 1 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: theme.spacing.lg, paddingVertical: theme.spacing.sm }}>
          <Text style={{ ...theme.typography.largeTitle, color: theme.colors.ink }}>{t('title')}</Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t('newSet')}
            disabled={creating}
            onPress={() => void onCreate()}
            hitSlop={8}
            style={{ width: 44, height: 44, borderRadius: theme.radii.pill, backgroundColor: theme.colors.accent, alignItems: 'center', justifyContent: 'center', opacity: creating ? 0.5 : 1 }}
          >
            <SymbolIcon name="plus" size={20} color={theme.colors.onAccent} weight="semibold" />
          </Pressable>
        </View>
        {content()}
      </ConstrainedContent>
      <PruneSetlistsModal
        visible={pruneOpen}
        onClose={() => setPruneOpen(false)}
        setlists={setlists}
        limit={limit}
        onConfirmDelete={async (ids) => { await removeMany(ids); await refresh() }}
      />
    </Screen>
  )
}
