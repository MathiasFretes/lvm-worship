import { describe, expect, it } from 'vitest'
import { resolveViewerKey } from '../songViewerKey'

describe('resolveViewerKey', () => {
  it('keeps a setlist key selected while the song document loads', () => {
    const loading = resolveViewerKey({ routeKey: 'G', initialKey: 'A', delta: 0, preferFlat: false })
    const loaded = resolveViewerKey({ documentKey: 'G', initialKey: 'A', delta: 0, preferFlat: false })
    expect(loading.effectiveKey).toBe('A')
    expect(loaded.effectiveKey).toBe('A')
  })

  it('wraps negative semitone steps without changing the native key', () => {
    const result = resolveViewerKey({ songKey: 'C', delta: -1, preferFlat: false })
    expect(result.nativeKey).toBe('C')
    expect(result.steps).toBe(11)
    expect(result.effectiveKey).toBe('B')
  })
})
