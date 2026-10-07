import { useMemo } from 'react'
import { DarkTheme, DefaultTheme, type Theme } from '@react-navigation/native'
import type { Tokens } from '@lavozmisionera/tokens/native'
import { useTheme } from './ThemeProvider'

type NavigationTokens = Pick<Tokens, 'mode' | 'colors'>

function navigationThemeFrom(tokens: NavigationTokens): Theme {
  const foundation = tokens.mode === 'dark' ? DarkTheme : DefaultTheme
  const { accent, bg, border, ink, surface } = tokens.colors

  return {
    ...foundation,
    colors: {
      ...foundation.colors,
      primary: accent,
      background: bg,
      card: surface,
      text: ink,
      border,
    },
  }
}

export function useNavigationTheme(): Theme {
  const tokens = useTheme()
  return useMemo(() => navigationThemeFrom(tokens), [tokens])
}
