import { Pressable, Text, View } from 'react-native'
import Card from './Card'
import { useTheme } from '../theme/ThemeProvider'

// A standalone destructive action card (Log out / Delete account), styled as a
// full-width centered row inside its own Card. Lives on the Account screen.
//
// React Native exposes no "destructive" accessibility trait, so the red text is
// invisible to a screen reader. `hint` carries that meaning instead — pass
// localized copy saying what the action does.

type DangerCardProps = {
  label: string
  onPress: () => void
  accessibilityLabel?: string
  hint?: string
}

export default function DangerCard({
  label,
  onPress,
  accessibilityLabel,
  hint,
}: DangerCardProps) {
  const theme = useTheme()
  return (
    <Card style={{ marginTop: theme.spacing.lg }}>
      <Pressable
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel ?? label}
        accessibilityHint={hint}
        style={({ pressed }) => ({
          minHeight: 48,
          justifyContent: 'center',
          opacity: pressed ? 0.72 : 1,
        })}
      >
        <View style={{ alignItems: 'center', paddingHorizontal: theme.spacing.md }}>
          <Text
            style={{
              fontSize: theme.typography.body.fontSize,
              fontWeight: '600',
              color: theme.colors.danger,
              textAlign: 'center',
            }}
          >
            {label}
          </Text>
        </View>
      </Pressable>
    </Card>
  )
}
