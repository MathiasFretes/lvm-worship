// In-tune hold: the needle should only read "in tune" after the pitch has
// *stayed* within the threshold for a hold period — a settling low E must not
// flash green on its way through zero. Pure and clock-injected so it
// unit-tests headless.

export type HoldState = 'off' | 'settling' | 'inTune'

export interface InTuneHoldOptions {
  /** |cents| that counts as in tune. Spike-recommended: 4. */
  thresholdCents?: number
  /** How long the pitch must stay inside the threshold before locking. */
  holdMs?: number
  /**
   * Once locked, allow this much extra drift before dropping the lock, so a
   * reading hovering right at the threshold doesn't flicker.
   */
  exitSlackCents?: number
}

export interface InTuneHold {
  /** Feeds one smoothed cents reading with its timestamp. */
  push(cents: number, nowMs: number): HoldState
  reset(): void
}

export function createInTuneHold(options: InTuneHoldOptions = {}): InTuneHold {
  const { thresholdCents = 4, holdMs = 500, exitSlackCents = 2 } = options
  let enteredAt: number | undefined
  let state: HoldState = 'off'

  const reset = () => {
    enteredAt = undefined
    state = 'off'
  }

  return {
    push(cents: number, nowMs: number): HoldState {
      const limit = thresholdCents + (state === 'inTune' ? exitSlackCents : 0)
      if (Math.abs(cents) > limit) {
        reset()
        return state
      }
      enteredAt ??= nowMs
      state = nowMs - enteredAt >= holdMs ? 'inTune' : 'settling'
      return state
    },
    reset,
  }
}
