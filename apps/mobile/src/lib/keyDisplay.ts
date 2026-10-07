type Translator = (key: string, options?: Record<string, unknown>) => string

export type KeyDisplay = {
  text: string
  a11yLabel: string
}

type OptionalKey = string | null | undefined

function normalizeKey(value: OptionalKey): string | undefined {
  if (typeof value !== 'string') return undefined
  const normalized = value.trim()
  return normalized.length > 0 ? normalized : undefined
}

function singleKeyDisplay(key: string, tx: Translator): KeyDisplay {
  return {
    text: key,
    a11yLabel: tx('common:keyOf', { key }),
  }
}

export function formatKeyPair(
  original: OptionalKey,
  working: OptionalKey,
  tx: Translator,
): KeyDisplay | null {
  const from = normalizeKey(original)
  const to = normalizeKey(working)

  if (!from && !to) return null

  if (!from) return singleKeyDisplay(to!, tx)
  if (!to || to === from) return singleKeyDisplay(from, tx)

  const interpolation = { from, to }
  return {
    text: tx('common:keyTransposed', interpolation),
    a11yLabel: tx('common:keyTransposedA11y', interpolation),
  }
}
