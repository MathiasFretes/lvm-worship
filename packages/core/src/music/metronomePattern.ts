// Pure metronome beat/accent math — RN-free so it unit-tests headless. The
// audio scheduling glue (useMetronome) consumes these; nothing here touches
// react-native-audio-api.

export type TimeSignatureId = '4/4' | '2/4' | '3/4' | '6/8'

const SIGNATURE_BEATS: Record<TimeSignatureId, number> = {
  '4/4': 4,
  '2/4': 2,
  '3/4': 3,
  '6/8': 6,
}

export const TIME_SIGNATURES = (Object.entries(SIGNATURE_BEATS) as [TimeSignatureId, number][])
  .map(([id, beats]) => ({ id, beats }))

export function beatsInMeasure(sig: TimeSignatureId): number {
  return SIGNATURE_BEATS[sig]
}

export type BeatEmphasis = 'primary' | 'secondary' | 'normal'

/**
 * Emphasis of a (0-based) beat within a measure. With the downbeat accent on,
 * beat 1 is primary in every signature; 6/8 additionally gets a secondary
 * accent on beat 4 (index 3) — the two-dotted-quarter-pulse feel — rather than
 * six equal beats. Accent off → every beat is a plain click.
 */
export function beatEmphasis(
  sig: TimeSignatureId,
  beatIndex: number,
  accentEnabled: boolean
): BeatEmphasis {
  if (!accentEnabled) return 'normal'
  const length = beatsInMeasure(sig)
  const beat = ((beatIndex % length) + length) % length
  if (beat === 0) return 'primary'
  if (sig === '6/8' && beat === 3) return 'secondary'
  return 'normal'
}

export const MIN_BPM = 30
export const MAX_BPM = 260

export function clampBpm(bpm: number): number {
  const rounded = Number.isFinite(bpm) ? Math.round(bpm) : MIN_BPM
  return Math.max(MIN_BPM, Math.min(MAX_BPM, rounded))
}

/** Seconds between clicks at a given tempo (one click per beat). */
export function beatIntervalSec(bpm: number): number {
  return 60 / clampBpm(bpm)
}
