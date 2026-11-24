// Pure tap-tempo math — RN-free so it unit-tests headless. A rolling window of
// recent tap intervals is averaged into a BPM; a gap longer than `staleGapMs`
// abandons the old run and starts a fresh one (whose first tap, like the very
// first tap overall, yields no BPM yet). The window can be set per tap so it can
// track the time signature (X most recent taps → X − 1 gaps averaged).

export interface TapTempoOptions {
  /** Fallback rolling window used when `tap` isn't given one (default 6). */
  windowSize?: number
  /** A gap longer than this abandons the run and starts over (default 2 s). */
  staleGapMs?: number
}

export interface TapTempo {
  /**
   * Register a tap at `nowMs`. Returns the running BPM, or null on a run's first
   * tap. `windowSize` (in gaps between taps) overrides the constructor default
   * for this tap — pass X − 1 to average the X most recent taps. A smaller
   * window than before immediately drops older gaps, so the BPM catches up at
   * once rather than one tap at a time.
   */
  tap(nowMs: number, windowSize?: number): number | null
  reset(): void
}

export function createTapTempo({ windowSize = 6, staleGapMs = 2000 }: TapTempoOptions = {}): TapTempo {
  const defaultWindow = Math.max(1, windowSize)
  let previousTap: number | undefined
  const intervals: number[] = []
  return {
    tap(nowMs: number, windowSize: number = defaultWindow): number | null {
      const effectiveWindow = Math.max(1, Math.floor(windowSize))
      if (previousTap !== undefined) {
        const gap = nowMs - previousTap
        // Non-increasing timestamps are treated like a stale gap: start over
        // rather than derive a nonsense (infinite/negative) BPM.
        if (gap > staleGapMs || gap <= 0) {
          intervals.length = 0
        } else {
          intervals.push(gap)
        }
      }
      previousTap = nowMs
      // Keep only the most recent `effectiveWindow` gaps. Using slice (not a
      // single shift) means a window that just shrank is honored on this tap.
      if (intervals.length > effectiveWindow) {
        intervals.splice(0, intervals.length - effectiveWindow)
      }
      if (intervals.length === 0) return null
      const avgMs = intervals.reduce((sum, v) => sum + v, 0) / intervals.length
      return 60000 / avgMs
    },
    reset() {
      previousTap = undefined
      intervals.length = 0
    },
  }
}
