import type { ReactNode } from 'react'
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native'
import { useTheme } from '../theme/ThemeProvider'

// A raised surface container with the theme's card radius and a hairline
// border. Used for grouped content (e.g. the placeholder screens' cards and the
// sheet's sort-option group).

export default function Card({
  children,
  style,
}: {
  children: ReactNode
  style?: StyleProp<ViewStyle>
}) {
  const t = useTheme()
  const themedSurface = {
    backgroundColor: t.colors.surface,
    borderRadius: t.radii.card,
    borderColor: t.colors.border,
  }
  return (
    <View style={[styles.frame, themedSurface, style]}>
      {children}
    </View>
  )
}

const styles = StyleSheet.create({
  frame: {
    borderWidth: 1,
    overflow: 'hidden',
  },
})
