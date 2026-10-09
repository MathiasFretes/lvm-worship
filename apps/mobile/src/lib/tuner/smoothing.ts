// Cents smoothing for the tuner needle: median (kills single-frame octave/
// attack glitches) followed by an EMA (damps residual jitter). Pure and
// RN-free so the spike benchmark and unit tests can drive it headless.

export interface SmootherOptions {
  /** Median window length in readings. Odd; 5 ≈ 100 ms at a ~21 ms hop. */
  medianWindow?: number
  /** EMA coefficient in (0, 1]; higher tracks faster, lower is steadier. */
  emaAlpha?: number
}

export interface CentsSmoother {
  /** Feeds one raw cents reading; returns the smoothed value. */
  push(cents: number): number
  /** Call when detection drops out (new pluck, silence) to avoid smearing. */
  reset(): void
}

export function createCentsSmoother(options: SmootherOptions = {}): CentsSmoother {
  const medianWindow = Math.max(1, Math.floor(options.medianWindow ?? 5))
  const emaAlpha = Math.max(0, Math.min(1, options.emaAlpha ?? 0.35))
  const history: number[] = []
  let smoothed: number | undefined

  const reset = () => {
    history.splice(0)
    smoothed = undefined
  }

  return {
    push(cents: number): number {
      history.push(cents)
      if (history.length > medianWindow) history.splice(0, history.length - medianWindow)
      const sorted = [...history].sort((a, b) => a - b)
      const median = sorted[Math.floor(sorted.length / 2)]
      smoothed = smoothed === undefined
        ? median
        : smoothed * (1 - emaAlpha) + median * emaAlpha
      return smoothed
    },
    reset,
  }
}
