import type { ReactNode } from 'react'
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native'
import { SafeAreaView, type Edge } from 'react-native-safe-area-context'
import { useTheme } from '../theme/ThemeProvider'

// The root surface every screen sits on: fills the viewport, paints the page
// background from the theme, and respects safe-area insets. Pass `edges` to
// control which insets are applied (a screen with its own bottom tab bar, say,
// usually wants just the top edge).

export default function Screen({
  children,
  edges = ['top', 'bottom', 'left', 'right'],
  style,
}: {
  children: ReactNode
  edges?: Edge[]
  style?: StyleProp<ViewStyle>
}) {
  const t = useTheme()
  return (
    <SafeAreaView
      edges={edges}
      style={[styles.viewport, { backgroundColor: t.colors.bg }, style]}
    >
      <View style={styles.content}>{children}</View>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  viewport: {
    flex: 1,
  },
  content: {
    flex: 1,
  },
})
