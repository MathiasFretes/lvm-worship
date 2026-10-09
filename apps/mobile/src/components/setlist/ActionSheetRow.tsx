import { Pressable, Text, View } from 'react-native'
import SymbolIcon, { type SymbolIconProps } from '../SymbolIcon'
import { useTheme } from '../../theme/ThemeProvider'

export default function ActionSheetRow({
  icon,
  label,
  onPress,
  destructive = false,
}: {
  icon: SymbolIconProps['name']
  label: string
  onPress: () => void
  destructive?: boolean
}) {
  const t = useTheme()
  const color = destructive ? t.colors.danger : t.colors.ink
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={({ pressed }) => ({
        flexDirection: 'row',
        alignItems: 'center',
        minHeight: 52,
        gap: t.spacing.md,
        paddingHorizontal: t.spacing.md,
        borderRadius: t.radii.md,
        backgroundColor: pressed ? t.colors.border : t.colors.surfaceAlt,
      })}
    >
      <View style={{
        width: 32,
        height: 32,
        borderRadius: t.radii.pill,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: destructive ? t.colors.surface : t.colors.accentSoft,
      }}>
        <SymbolIcon name={icon} size={17} color={destructive ? t.colors.danger : t.colors.accent} />
      </View>
      <Text style={{ flex: 1, fontSize: 15.5, fontWeight: '600', color }}>{label}</Text>
      {!destructive && <SymbolIcon name="chevron.right" size={13} color={t.colors.sec} />}
    </Pressable>
  )
}
