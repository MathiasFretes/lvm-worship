import { describe, expect, it } from 'vitest'
import { canMovePerformer, clampPerformerIndex } from '../performerNavigation'

describe('performer navigation', () => {
  it('keeps the current appearance when earlier duplicate songs remain', () => {
    expect(clampPerformerIndex(2, 3)).toBe(2)
    expect(canMovePerformer(2, 1, 3)).toBe(true)
  })

  it('lands on the last remaining appearance after a setlist shrinks', () => {
    expect(clampPerformerIndex(3, 2)).toBe(1)
    expect(canMovePerformer(1, 2, 2)).toBe(false)
  })

  it('handles an empty or newly loaded set without an invalid position', () => {
    expect(clampPerformerIndex(4, 0)).toBe(0)
    expect(clampPerformerIndex(-1, 2)).toBe(0)
    expect(canMovePerformer(0, -1, 2)).toBe(false)
  })
})
