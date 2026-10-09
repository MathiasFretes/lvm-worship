import { StyleSheet, Text, View } from 'react-native'
import { useTheme } from '../theme/ThemeProvider'

// Tiny inline pills for the library / viewer: "Personal" (any owned draft) and
// "Pending" (submitted, awaiting review). Tokens only so both read correctly in
// light and dark.

function SongStatusBadge({ kind }: { kind: 'personal' | 'pending' }) {
  const t = useTheme()
  const pending = kind === 'pending'
  return (
    <View
      style={[
        styles.badge,
        {
          borderRadius: t.radii.pill,
          backgroundColor: pending ? t.colors.surfaceAlt : t.colors.accentSoft,
          borderColor: pending ? t.colors.border : 'transparent',
          borderWidth: pending ? 1 : 0,
        },
      ]}
    >
      <Text style={[styles.label, { color: pending ? t.colors.sec : t.colors.textAccent }]}>
        {pending ? 'Pending' : 'Personal'}
      </Text>
    </View>
  )
}

export function PersonalChip() {
  return <SongStatusBadge kind="personal" />
}

export function PendingBadge() {
  return <SongStatusBadge kind="pending" />
}

/** Pick the right chip for a personal song's status (null for catalog songs). */
export function songBadge(source: string | undefined, reviewStatus: string | undefined) {
  if (source !== 'personal') return null
  if (reviewStatus === 'submitted') return <PendingBadge />
  return <PersonalChip />
}

const styles = StyleSheet.create({
  badge: {
    paddingHorizontal: 7,
    paddingVertical: 2,
  },
  label: {
    fontSize: 11,
    fontWeight: '700',
  },
})
