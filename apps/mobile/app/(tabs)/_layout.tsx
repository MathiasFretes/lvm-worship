import { ThemeProvider as NavigationThemeProvider } from '@react-navigation/native'
import { NativeTabs } from 'expo-router/unstable-native-tabs'
import { useTranslation } from 'react-i18next'
import { Platform } from 'react-native'
import { useNavigationTheme } from '../../src/theme/navigationTheme'
import { useTheme } from '../../src/theme/ThemeProvider'

const modernIos = Platform.OS === 'ios' && Number.parseInt(String(Platform.Version), 10) >= 26

/** Keep the OS tab bar; LVM owns the destinations, labels and brand tint. */
export default function WorshipTabs() {
  const theme = useTheme()
  const navigationTheme = useNavigationTheme()
  const { t } = useTranslation('nav')

  return (
    <NavigationThemeProvider value={navigationTheme}>
      <NativeTabs
        tintColor={theme.colors.accent}
        labelVisibilityMode="labeled"
        labelStyle={Platform.OS === 'android' ? { fontSize: 13 } : undefined}
        disableTransparentOnScrollEdge={Platform.OS === 'ios' && !modernIos}
      >
        <NativeTabs.Trigger name="index">
          <NativeTabs.Trigger.Icon sf={{ default: 'house', selected: 'house.fill' }} md="home" />
          <NativeTabs.Trigger.Label>{t('home')}</NativeTabs.Trigger.Label>
        </NativeTabs.Trigger>
        <NativeTabs.Trigger name="songs">
          <NativeTabs.Trigger.Icon
            sf={modernIos
              ? { default: 'music.pages', selected: 'music.pages.fill' }
              : { default: 'music.note.list', selected: 'music.note.list' }}
            md="queue_music"
          />
          <NativeTabs.Trigger.Label>{t('songs')}</NativeTabs.Trigger.Label>
        </NativeTabs.Trigger>
        <NativeTabs.Trigger name="setlists">
          <NativeTabs.Trigger.Icon
            sf={modernIos
              ? { default: 'music.note.square.stack', selected: 'music.note.square.stack.fill' }
              : { default: 'list.bullet.rectangle.portrait', selected: 'list.bullet.rectangle.portrait.fill' }}
            md="list"
          />
          <NativeTabs.Trigger.Label>{t('setlists')}</NativeTabs.Trigger.Label>
        </NativeTabs.Trigger>
        <NativeTabs.Trigger name="daily">
          <NativeTabs.Trigger.Icon sf={{ default: 'book', selected: 'book.fill' }} md="menu_book" />
          <NativeTabs.Trigger.Label>{t('dailyWord')}</NativeTabs.Trigger.Label>
        </NativeTabs.Trigger>
        <NativeTabs.Trigger name="utilities">
          <NativeTabs.Trigger.Icon
            sf={{ default: 'wrench.and.screwdriver', selected: 'wrench.and.screwdriver.fill' }}
            md="handyman"
          />
          <NativeTabs.Trigger.Label>{t('utilities')}</NativeTabs.Trigger.Label>
        </NativeTabs.Trigger>
      </NativeTabs>
    </NavigationThemeProvider>
  )
}
