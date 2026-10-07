import { StyleSheet, Text, View } from 'react-native'
import { useTheme } from '../theme/ThemeProvider'
import { LINE_HEIGHTS } from '../lib/listRowMetrics'

// Sticky list section header — the A–Z letter, or "Key of G" when grouped by
// key. Painted with the page background so it stays opaque while pinned over the
// scrolling list.
//
// The line height and paddings are load-bearing: `sectionHeaderHeight` in
// listRowMetrics.ts mirrors them so the Song Library's `getItemLayout` can place
// sections it has never rendered. Change them in both places.

export default function SectionHeader({ label }: { label: string }) {
  const t = useTheme()
  return (
    <View
      accessibilityRole="header"
      style={[
        styles.container,
        { backgroundColor: t.colors.bg, paddingHorizontal: t.spacing.xl },
      ]}
    >
      <Text
        style={[
          styles.label,
          {
            fontSize: t.typography.sectionHeader.fontSize,
            fontWeight: t.typography.sectionHeader.fontWeight,
            letterSpacing: t.typography.sectionHeader.letterSpacing,
            color: t.colors.sec,
          },
        ]}
      >
        {label}
      </Text>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    paddingTop: 7,
    paddingBottom: 4,
  },
  label: {
    lineHeight: LINE_HEIGHTS.sectionHeader,
  },
})
