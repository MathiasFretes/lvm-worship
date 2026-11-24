import { Text, View } from 'react-native'
import { Image } from 'expo-image'
import { brandIdentity } from '@lavozmisionera/tokens/native'
import { useTheme } from '../theme/ThemeProvider'

export default function BrandIdentity() {
  const t = useTheme()
  return <View style={{ flexDirection: 'row', alignItems: 'center', gap: brandIdentity.gap, flexShrink: 1 }}>
    <Image source={require('../../assets/mark.webp')} accessibilityLabel="Emblema de La Voz Misionera"
      style={{ width: brandIdentity.emblemSize, height: brandIdentity.emblemSize }} contentFit="contain" />
    <View style={{ flexShrink: 1 }}>
      <Text style={{ fontSize: brandIdentity.nameSize, fontWeight: '700', color: t.colors.ink }}>La Voz Misionera</Text>
      <Text style={{ fontSize: brandIdentity.productSize, color: t.colors.sec }}>Worship</Text>
    </View>
  </View>
}
