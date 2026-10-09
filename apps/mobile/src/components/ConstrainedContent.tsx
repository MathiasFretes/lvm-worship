import type { ReactNode } from 'react'
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native'
import { useTheme } from '../theme/ThemeProvider'
import { useIsTabletWidth } from '../lib/useIsTabletWidth'

// The content-width constraint primitive. On compact (phone) width it renders
// its children untouched — a literal pass-through, so phone layouts are
// byte-identical to a build without it. On regular (tablet) width it caps the
// content to the tier's max width (tokens `layout.maxWidth`) and centers it.
//
// `style` is applied only to the regular-width wrapper — use it when the
// constrained region must also flex (e.g. wrapping a screen-filling list).

export default function ConstrainedContent({
  tier,
  style,
  children,
}: {
  tier: 'form' | 'content' | 'dashboard'
  style?: StyleProp<ViewStyle>
  children: ReactNode
}) {
  const t = useTheme()
  const shouldConstrain = useIsTabletWidth()
  if (!shouldConstrain) return children

  const widthLimit = t.layout.maxWidth[tier]
  return (
    <View style={[styles.centered, { maxWidth: widthLimit }, style]}>
      {children}
    </View>
  )
}

const styles = StyleSheet.create({
  centered: {
    alignSelf: 'center',
    width: '100%',
  },
})
