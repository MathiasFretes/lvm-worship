// Canonical La Voz Misionera design tokens for React Native. This is the
// single source of truth for the native app's tokens —
// apps/mobile imports from here and never hardcodes color values.
// Brand values align with the V0-derived web shell; semantic roles retain
// platform-specific contrast and native surface treatment.

export type ThemeMode = 'light' | 'dark'

/**
 * A vertical linear gradient: `colors` paired with `locations` (0–1 stops).
 * React Native has no radial gradient, so the atmospheric hero is expressed as
 * a vertical linear gradient plus a separate soft highlight overlay (heroGlow).
 */
export type Gradient = {
  // Tuple types (≥2 stops) so these satisfy expo-linear-gradient's props directly.
  colors: readonly [string, string, ...string[]]
  locations: readonly [number, number, ...number[]]
}

export type ThemeColors = {
  /** Page background (the surface the list scrolls on). */
  bg: string
  /** Raised surfaces: cards, tab bar, sheets. */
  surface: string
  /** Recessed surfaces: search field, icon buttons. */
  surfaceAlt: string
  /** Primary text. */
  ink: string
  /** Secondary text (e.g. artist line). */
  sec: string
  /** Muted text (e.g. time signature, section letters). */
  muted: string
  /** Accessible gold used for primary native controls. */
  accent: string
  /** Soft accent fill (e.g. add-button background). */
  accentSoft: string
  /** Accent tuned for text/legibility on the page background. */
  textAccent: string
  /** Hairline borders / separators. */
  border: string
  /** Text/icon color on top of the accent. */
  onAccent: string
  /** Destructive actions (delete/remove) — text on surfaces and fills. */
  danger: string
  /** Text/icon color on top of the danger fill. */
  onDanger: string
  /** Favorite/star fill (gold). */
  star: string
  /**
   * Non-accent emphasis: marks a fixed point that is NOT a selection. Used for
   * the Key Reference dial's index, where the accent already means "chosen" and
   * a second meaning on the same hue would be unreadable. A muted violet —
   * outside the LVM navy/gold brand roles, and quiet enough not to compete
   * with it.
   */
  spotlight: string
  /** Soft spotlight fill, for a halo behind a marked element. */
  spotlightSoft: string
  /** Positive/confirmed state (e.g. tuner in-tune). */
  success: string
  /** Dimmed color for inactive scrubber letters. */
  off: string
  /**
   * The Material bottom-sheet drag handle (Android only). MD3 draws it in
   * `onSurfaceVariant` at 40% opacity; iOS renders UIKit's own grabber and
   * never reads this.
   */
  sheetHandle: string
  /**
   * The atmospheric hero gradient (Home) — the one sanctioned gradient, an
   * atmospheric header, never a UI-surface gradient.
   */
  heroGradient: Gradient
  /** Soft top-center highlight overlaid on the hero to hint the radial glow. */
  heroGlow: string
}

export const lightColors: ThemeColors = {
  bg: '#F6F7F9',
  surface: '#FFFFFF',
  surfaceAlt: '#EEF0F3',
  ink: '#1C2A39',
  sec: '#5C656F',
  muted: '#8A929B',
  accent: '#825C18',
  accentSoft: '#F3EAD8',
  textAccent: '#825C18',
  border: '#E4E7EC',
  onAccent: '#FFFFFF',
  danger: '#C43D38',
  onDanger: '#FFFFFF',
  star: '#C6A15B',
  spotlight: '#6A5AC4',
  spotlightSoft: '#E4E0F6',
  success: '#34C759',
  off: 'rgba(138,146,155,0.45)',
  sheetHandle: 'rgba(138,146,155,0.4)',
  heroGradient: {
    colors: ['#E2C58A', '#EBD9B9', '#F1EBDF', '#F6F7F9'],
    locations: [0, 0.34, 0.72, 1],
  },
  heroGlow: 'rgba(255,255,255,0.55)',
}

export const darkColors: ThemeColors = {
  bg: '#111C28',
  surface: '#1C2A39',
  surfaceAlt: '#26384B',
  ink: '#F6F7F9',
  sec: '#BAC6D1',
  muted: '#7C8D9C',
  accent: '#E2C58A',
  accentSoft: '#3A321F',
  textAccent: '#E2C58A',
  border: '#35475A',
  onAccent: '#1C2A39',
  danger: '#F0736A',
  onDanger: '#14171A',
  star: '#E2C58A',
  spotlight: '#A99BF0',
  spotlightSoft: '#2A2740',
  success: '#30D158',
  off: 'rgba(145,160,174,0.5)',
  sheetHandle: 'rgba(145,160,174,0.4)',
  heroGradient: {
    colors: ['#3A321F', '#26384B', '#1C2A39', '#111C28'],
    locations: [0, 0.38, 0.78, 1],
  },
  heroGlow: 'rgba(226,197,138,0.18)',
}

/**
 * Increase-Contrast overlays — merged over the palette ONLY when iOS "Increase
 * Contrast" is enabled (see the mobile ThemeProvider). They strengthen the few
 * tokens that sit near the WCAG contrast floor: secondary/muted text and the
 * hairline separators, plus a deeper accent-text tone. Every other token is
 * inherited unchanged, and on a device with the setting OFF these are never
 * applied — the app renders the exact base palette above.
 */
export const lightContrastBoost: Partial<ThemeColors> = {
  sec: '#454C54',
  muted: '#5A626B',
  textAccent: '#6E4D12',
  border: '#C4CCD3',
  off: 'rgba(90,98,107,0.7)',
}

export const darkContrastBoost: Partial<ThemeColors> = {
  sec: '#C7CED5',
  muted: '#AAB8C5',
  textAccent: '#F0D6A3',
  border: '#566A7D',
  off: 'rgba(154,162,170,0.75)',
}

export function getContrastBoost(mode: ThemeMode): Partial<ThemeColors> {
  return mode === 'dark' ? darkContrastBoost : lightContrastBoost
}

/** 4-pt spacing scale (shared across modes). */
export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
} as const

/**
 * Content-width caps applied at regular (tablet) width via the mobile app's
 * `ConstrainedContent` primitive. Compact (phone) layouts never read these —
 * the primitive passes through untouched there.
 */
export const layout = {
  maxWidth: {
    /** Focused single-column forms (e.g. the auth screen). */
    form: 440,
    /** General content columns (index lists). */
    content: 700,
    /** The Home dashboard's two-column grid region. */
    dashboard: 1000,
  },
  /** Entries shown in Home's Recent-songs card. */
  recentSongs: 6,
  /**
   * Flex weights for tablet list-detail splits (Setlist Builder's library
   * pane · builder column, Utilities' tool list · tool view): ~1/3 · 2/3.
   */
  split: {
    list: 1,
    detail: 2,
  },
  /**
   * Song Library grid columns at regular (tablet) width, by orientation.
   * Compact (phone) width always renders single-column.
   */
  libraryColumns: {
    portrait: 2,
    landscape: 3,
  },
} as const

/** Corner radii (shared across modes). */
export const radii = {
  sm: 10,
  md: 12,
  card: 14,
  sheet: 20,
  /**
   * Material 3 "Extra large" — the Android bottom-sheet corner. iOS sheets stay
   * on `sheet`; only the Android formSheet reads this. Deliberately NOT named
   * `xl`: generate-swift.mjs maps doc comments by identifier name with
   * first-occurrence-wins, so an `xl` here would retitle `spacing.xl` too.
   */
  sheetLarge: 28,
  pill: 999,
} as const

/**
 * Type ramp used by the app chrome and content. Sizes/weights come straight
 * from the reference rows and headers. Font family is the system font (SF Pro
 * on iOS) — RN uses the system font by default, so no family is set here.
 */
export const typography = {
  /** Large screen title, e.g. "Song Library". */
  largeTitle: { fontSize: 27, fontWeight: '700', letterSpacing: -0.4 },
  /** Section header letter / "Key of X". */
  sectionHeader: { fontSize: 13, fontWeight: '700', letterSpacing: 0.2 },
  /** Row title. */
  rowTitle: { fontSize: 16.5, fontWeight: '600', letterSpacing: -0.3 },
  /** Row subtitle (artist). */
  rowSubtitle: { fontSize: 13.5, fontWeight: '400' },
  /** Row key. */
  rowKey: { fontSize: 14, fontWeight: '600' },
  /** Row time signature / small meta. */
  rowMeta: { fontSize: 12.5, fontWeight: '400' },
  /** Body / control text. */
  body: { fontSize: 16, fontWeight: '400' },
  /** Uppercase group label (e.g. "SORT BY"). */
  overline: { fontSize: 12, fontWeight: '600', letterSpacing: 0.6 },
} as const

export type Tokens = {
  mode: ThemeMode
  colors: ThemeColors
  spacing: typeof spacing
  layout: typeof layout
  radii: typeof radii
  typography: typeof typography
}

export const lightTokens: Tokens = {
  mode: 'light',
  colors: lightColors,
  spacing,
  layout,
  radii,
  typography,
}

export const darkTokens: Tokens = {
  mode: 'dark',
  colors: darkColors,
  spacing,
  layout,
  radii,
  typography,
}

export function getTokens(mode: ThemeMode, increaseContrast = false): Tokens {
  const base = mode === 'dark' ? darkTokens : lightTokens
  // Default settings return the base object unchanged (stable reference). Only
  // when Increase Contrast is on do we build a boosted variant.
  if (!increaseContrast) return base
  return { ...base, colors: { ...base.colors, ...getContrastBoost(mode) } }
}
