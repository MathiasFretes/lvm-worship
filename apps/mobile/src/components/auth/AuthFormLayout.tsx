import type { PropsWithChildren } from 'react'
import { useState } from 'react'
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Text,
  View,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import ConstrainedContent from '../ConstrainedContent'
import GlassSurface from '../GlassSurface'
import Screen from '../Screen'
import SymbolIcon from '../SymbolIcon'
import { useTheme } from '../../theme/ThemeProvider'

type Props = PropsWithChildren<{
  title: string
  subtitle?: string
  backLabel?: string
  onBack?: () => void
}>

export default function AuthFormLayout({
  title,
  subtitle,
  backLabel,
  onBack,
  children,
}: Props) {
  const theme = useTheme()
  const insets = useSafeAreaInsets()
  const [headerHeight, setHeaderHeight] = useState(0)
  const showsHeader = Boolean(backLabel && onBack)

  return (
    <Screen edges={['left', 'right']}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{
            paddingHorizontal: theme.spacing.lg,
            paddingTop: showsHeader
              ? headerHeight + theme.spacing.lg
              : insets.top + theme.spacing.xl,
            paddingBottom: insets.bottom + theme.spacing.xxl,
          }}
        >
          <ConstrainedContent tier="form">
            <View style={{ gap: theme.spacing.lg }}>
              <View style={{ gap: theme.spacing.sm }}>
                <Text
                  style={{
                    ...theme.typography.largeTitle,
                    color: theme.colors.ink,
                  }}
                >
                  {title}
                </Text>
                {subtitle ? (
                  <Text style={{ fontSize: 14.5, lineHeight: 21, color: theme.colors.sec }}>
                    {subtitle}
                  </Text>
                ) : null}
              </View>
              {children}
            </View>
          </ConstrainedContent>
        </ScrollView>
      </KeyboardAvoidingView>

      {showsHeader ? (
        <GlassSurface
          fallbackColor={theme.colors.bg}
          fallbackHairline
          onLayout={(event) => setHeaderHeight(event.nativeEvent.layout.height)}
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            zIndex: 10,
            paddingTop: insets.top,
            paddingHorizontal: theme.spacing.md,
            paddingBottom: theme.spacing.sm,
          }}
        >
          <Pressable
            onPress={onBack}
            accessibilityRole="button"
            accessibilityLabel={backLabel}
            hitSlop={8}
            style={{ flexDirection: 'row', alignItems: 'center', gap: 2 }}
          >
            <SymbolIcon name="chevron.left" size={22} color={theme.colors.accent} />
            <Text style={{ fontSize: 16, fontWeight: '500', color: theme.colors.textAccent }}>
              {backLabel}
            </Text>
          </Pressable>
        </GlassSurface>
      ) : null}
    </Screen>
  )
}
