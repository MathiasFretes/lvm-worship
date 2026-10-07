import { useRef } from 'react'
import { PanResponder, Text, View } from 'react-native'
import * as Haptics from 'expo-haptics'
import { useTheme } from '../theme/ThemeProvider'

export const ALPHABET = [
  '#', 'A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M',
  'N', 'O', 'P', 'Q', 'R', 'S', 'T', 'U', 'V', 'W', 'X', 'Y', 'Z',
]

function nearestPresentLetter(y: number, height: number, present: ReadonlySet<string>) {
  if (height <= 0) return null
  const boundedY = Math.max(0, Math.min(height - Number.EPSILON, y))
  const touchedIndex = Math.min(
    ALPHABET.length - 1,
    Math.floor((boundedY / height) * ALPHABET.length),
  )

  for (let distance = 0; distance < ALPHABET.length; distance += 1) {
    const after = touchedIndex + distance
    const before = touchedIndex - distance
    if (after < ALPHABET.length && present.has(ALPHABET[after])) return ALPHABET[after]
    if (before >= 0 && present.has(ALPHABET[before])) return ALPHABET[before]
  }
  return null
}

// The right-edge A–Z index. Letters present in the list are drawn in the accent;
// absent ones are dimmed. A pan/drag maps the finger's Y-position within the
// strip to the matching section and asks the screen to scroll there
// continuously; a tap jumps to the section under the touch. Each time the
// resolved section changes, a light haptic tick fires. The inner letters are
// pointer-transparent so every touch lands on the responder strip (keeping
// locationY relative to it).
export default function AlphaScrubber({
  present,
  onSelect,
}: {
  present: Set<string>
  onSelect: (letter: string) => void
}) {
  const t = useTheme()

  // Refs so the once-created PanResponder always sees the latest props/measure.
  const heightRef = useRef(0)
  const presentRef = useRef(present)
  presentRef.current = present
  const onSelectRef = useRef(onSelect)
  onSelectRef.current = onSelect
  const lastLetter = useRef<string | null>(null)

  const handle = (y: number) => {
    const letter = nearestPresentLetter(y, heightRef.current, presentRef.current)
    if (letter && letter !== lastLetter.current) {
      lastLetter.current = letter
      Haptics.selectionAsync().catch(() => {})
      onSelectRef.current(letter)
    }
  }

  const responder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: (e) => {
        lastLetter.current = null
        handle(e.nativeEvent.locationY)
      },
      onPanResponderMove: (e) => handle(e.nativeEvent.locationY),
      onPanResponderRelease: () => {
        lastLetter.current = null
      },
      onPanResponderTerminate: () => {
        lastLetter.current = null
      },
    }),
  ).current

  return (
    <View
      pointerEvents="box-none"
      style={{
        position: 'absolute',
        right: 2,
        top: 0,
        bottom: 0,
        justifyContent: 'center',
        alignItems: 'center',
      }}
    >
      <View
        {...responder.panHandlers}
        onLayout={(e) => {
          heightRef.current = e.nativeEvent.layout.height
        }}
        hitSlop={{ top: 6, bottom: 6, left: 14, right: 8 }}
        style={{ paddingHorizontal: 3 }}
      >
        <View
          pointerEvents="none"
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
        >
          {ALPHABET.map((letter) => {
            const active = present.has(letter)
            return (
              <Text
                key={letter}
                style={{
                  fontSize: 11,
                  fontWeight: '600',
                  lineHeight: 15,
                  textAlign: 'center',
                  color: active ? t.colors.textAccent : t.colors.off,
                }}
              >
                {letter}
              </Text>
            )
          })}
        </View>
      </View>
    </View>
  )
}
