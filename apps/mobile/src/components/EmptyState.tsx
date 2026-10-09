import { StyleSheet, Text, View } from 'react-native'
import Button from './Button'
import SymbolIcon, { type SymbolIconProps } from './SymbolIcon'
import { useTheme } from '../theme/ThemeProvider'

// The "Empty · first run" component from [DOC] Components & Foundations: a
// centered icon tile (accent-soft, 72pt), a title, an optional subtitle, and
// an optional primary action. Icon is an SF Symbol so each surface can pick
// its own (e.g. list.bullet for setlists, music.note for songs).
export default function EmptyState({
  icon,
  title,
  subtitle,
  actionLabel,
  onAction,
}: {
  icon: SymbolIconProps['name']
  title: string
  subtitle?: string
  actionLabel?: string
  onAction?: () => void
}) {
  const t = useTheme()
  return (
    <View
      accessibilityRole="summary"
      style={[styles.container, { paddingHorizontal: t.spacing.xxl, gap: t.spacing.lg }]}
    >
      <View
        accessible={false}
        style={[styles.iconTile, { backgroundColor: t.colors.accentSoft }]}
      >
        <SymbolIcon name={icon} size={34} color={t.colors.accent} />
      </View>
      <View style={styles.copy}>
        <Text style={[styles.title, { color: t.colors.ink }]}>
          {title}
        </Text>
        {subtitle ? (
          <Text style={[styles.subtitle, { color: t.colors.sec }]}>
            {subtitle}
          </Text>
        ) : null}
      </View>
      {actionLabel && onAction ? (
        <Button title={actionLabel} onPress={onAction} fullWidth={false} style={{ alignSelf: 'center' }} />
      ) : null}
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconTile: {
    width: 72,
    height: 72,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  copy: {
    alignItems: 'center',
    gap: 7,
  },
  title: {
    fontSize: 19,
    fontWeight: '700',
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 14,
    lineHeight: 21,
    textAlign: 'center',
  },
})
