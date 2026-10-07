import { useEffect, useRef } from 'react'
import { ActivityIndicator, Animated, StyleSheet, Text, View } from 'react-native'
import { useTranslation } from 'react-i18next'
import { useTheme } from '../theme/ThemeProvider'
import { useAccessibilityFlags } from '../lib/accessibilityFlags'

// The "Loading · spinner · skeleton" component from [DOC] Components &
// Foundations: a syncing label with a spinner over shimmering placeholder
// rows (title + subtitle bars and a trailing chip), used while list data
// loads. The reference's moving-gradient shimmer is translated to a subtle
// opacity pulse (HIG-friendly, no gradient/asset dependency).

// Title/subtitle bar widths per the reference's skeleton data.
const ROWS = [
  { title: '70%', sub: '45%' },
  { title: '58%', sub: '38%' },
  { title: '66%', sub: '42%' },
  { title: '52%', sub: '34%' },
  { title: '62%', sub: '40%' },
] as const

function SkeletonBar({
  width,
  height,
  color,
  opacity,
}: {
  width: `${number}%`
  height: number
  color: string
  opacity: Animated.Value
}) {
  return (
    <Animated.View
      style={[styles.bar, { width, height, backgroundColor: color, opacity }]}
    />
  )
}

export default function LoadingSkeleton({ label }: { label?: string }) {
  const t = useTheme()
  const { t: tx } = useTranslation('common')
  const displayLabel = label ?? tx('loading')
  const pulse = useRef(new Animated.Value(0.45)).current
  // Reduce Motion: hold the placeholders at a steady opacity instead of pulsing.
  const { reduceMotion } = useAccessibilityFlags()

  useEffect(() => {
    if (reduceMotion) {
      pulse.setValue(0.7)
      return
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 700, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0.45, duration: 700, useNativeDriver: true }),
      ]),
    )
    loop.start()
    return () => loop.stop()
  }, [pulse, reduceMotion])

  return (
    <View
      accessibilityLabel={displayLabel}
      accessibilityLiveRegion="polite"
      style={{ paddingHorizontal: t.spacing.xl, paddingTop: t.spacing.md }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: t.spacing.lg }}>
        <ActivityIndicator size="small" color={t.colors.accent} />
        <Text style={{ fontSize: 13, color: t.colors.sec }}>{displayLabel}</Text>
      </View>

      {ROWS.map((row, i) => (
        <View
          key={i}
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: 12,
            paddingVertical: 11,
            borderBottomWidth: 0.5,
            borderBottomColor: t.colors.border,
          }}
        >
          <View style={{ flex: 1, gap: 8 }}>
            <SkeletonBar width={row.title} height={13} color={t.colors.surfaceAlt} opacity={pulse} />
            <SkeletonBar width={row.sub} height={11} color={t.colors.surfaceAlt} opacity={pulse} />
          </View>
          <Animated.View
            style={{
              width: 24,
              height: 13,
              borderRadius: 4,
              backgroundColor: t.colors.surfaceAlt,
              opacity: pulse,
            }}
          />
        </View>
      ))}
    </View>
  )
}

const styles = StyleSheet.create({
  bar: {
    borderRadius: 4,
  },
})
