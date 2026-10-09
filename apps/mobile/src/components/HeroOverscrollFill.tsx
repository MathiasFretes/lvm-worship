import { StyleSheet, View } from 'react-native'
import { useTheme } from '../theme/ThemeProvider'

// Fills the top overscroll region of a ScrollView whose first child is the hero
// gradient. Without it, a downward bounce past the top reveals the dark page
// background as a black void; this extends the gradient's top color upward so
// the bounce reads as more hero. The negative margin cancels the height, so it
// occupies the strip above content y=0 (only ever seen while overscrolling) and
// adds no layout. Render it as the FIRST child of the ScrollView content.

export default function HeroOverscrollFill() {
  const t = useTheme()
  return (
    <View
      pointerEvents="none"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[styles.overscroll, { backgroundColor: t.colors.heroGradient.colors[0] }]}
    />
  )
}

const OVERSCROLL_DEPTH = 600

const styles = StyleSheet.create({
  overscroll: {
    height: OVERSCROLL_DEPTH,
    marginTop: -OVERSCROLL_DEPTH,
  },
})
