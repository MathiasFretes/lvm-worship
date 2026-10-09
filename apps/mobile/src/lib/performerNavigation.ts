/** Keep the current appearance in range when a setlist changes during a session. */
export function clampPerformerIndex(index: number, count: number): number {
  if (count <= 0) return 0
  return Math.max(0, Math.min(index, count - 1))
}

export function canMovePerformer(index: number, next: number, count: number): boolean {
  return next >= 0 && next < count && next !== index
}
