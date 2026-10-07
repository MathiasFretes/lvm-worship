import { StyleSheet, Text, View } from 'react-native'
import { useTranslation } from 'react-i18next'
import { useTheme } from '../../theme/ThemeProvider'

// Shown on the ~37 days no devotional is matched to (see
// analysis/out/open-days.md). It must read as a deliberate state, not a failed
// load — nothing is retrying, nothing is missing, there simply is no devotional
// for these readings yet.
//
// Deliberately quieter than a card: no surface, no border, no shadow, not
// pressable. Those days will be filled with authored content later, so this is
// built to be deleted rather than to be lived with — nothing else depends on its
// shape or its presence.
//
// NOTE: this renders only when the day is genuinely open. A day whose content
// simply has not downloaded yet renders NOTHING at all, which is why the caller
// distinguishes `state === 'open'` from a null day. Showing "no devotional today"
// over content that exists but is still in flight would be a lie.

export default function DevotionalPlaceholder() {
  const theme = useTheme()
  const { t: tx } = useTranslation('devotional')
  const styles = StyleSheet.create({
    container: { paddingVertical: theme.spacing.sm },
    message: {
      fontSize: 14,
      lineHeight: 20,
      color: theme.colors.muted,
    },
  })

  return (
    <View style={styles.container} accessibilityRole="summary">
      <Text style={styles.message}>{tx('placeholder.none')}</Text>
    </View>
  )
}
