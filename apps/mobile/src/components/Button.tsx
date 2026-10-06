import { Platform, Pressable, Text, type StyleProp, type ViewStyle } from 'react-native'
import { useTheme } from '../theme/ThemeProvider'



export type ButtonProps = {
  title: string
  onPress?: () => void
  variant?: 'primary' | 'secondary'
  disabled?: boolean
  fullWidth?: boolean
  style?: StyleProp<ViewStyle>
}

export default function Button({
  title,
  onPress,
  variant = 'primary',
  disabled = false,
  fullWidth = true,
  style,
}: ButtonProps) {
  const t = useTheme()
  const isPrimary = variant === 'primary'
  const isAndroid = Platform.OS === 'android'
  const bg = isPrimary ? t.colors.accent : t.colors.surfaceAlt
  const fg = isPrimary ? t.colors.onAccent : t.colors.ink
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      // foreground:true draws the ripple ABOVE the fill, so it stays visible on
      // the filled accent variant. iOS ignores this prop entirely.
      android_ripple={disabled ? undefined : { borderless: false, foreground: true }}
      style={({ pressed }) => [
        {
          height: 48,
          borderRadius: isAndroid ? t.radii.pill : t.radii.md,
          backgroundColor: bg,
          alignItems: 'center',
          justifyContent: 'center',
          paddingHorizontal: t.spacing.lg,
          // Android shows the ripple instead of dimming; dimming as well would
          // read as two overlapping press effects.
          opacity: disabled ? 0.5 : isAndroid ? 1 : pressed ? 0.85 : 1,
          alignSelf: fullWidth ? 'stretch' : 'flex-start',
          overflow: isAndroid ? 'hidden' : 'visible',
        },
        style,
      ]}
    >
      <Text style={{ color: fg, fontSize: 16, fontWeight: '600', letterSpacing: -0.2 }}>
        {title}
      </Text>
    </Pressable>
  )
}
