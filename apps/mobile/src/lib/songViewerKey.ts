import { stepsBetween, transposeSymPrefer } from '@lavozmisionera/core'

type KeyStateInput = {
  documentKey?: string | null
  songKey?: string | null
  routeKey?: string | null
  initialKey?: string | null
  delta: number
  preferFlat: boolean
}

/** One key calculation for loading, deep links and live transpose taps. */
export function resolveViewerKey(input: KeyStateInput) {
  const nativeKey = input.documentKey || input.songKey || input.routeKey || ''
  const seedSteps = input.initialKey ? stepsBetween(nativeKey, input.initialKey) : 0
  const steps = ((seedSteps + input.delta) % 12 + 12) % 12
  const effectiveKey = steps
    ? transposeSymPrefer(nativeKey, steps, input.preferFlat)
    : nativeKey
  return { nativeKey, seedSteps, steps, effectiveKey }
}
