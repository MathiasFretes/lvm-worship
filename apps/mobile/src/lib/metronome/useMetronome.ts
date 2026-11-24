import { useCallback, useEffect, useRef, useState } from 'react'
import { AudioContext, AudioManager } from 'react-native-audio-api'
import { clampBpm, type TimeSignatureId } from '@lavozmisionera/core/music/metronomePattern'
import { runMetronome, type MetronomeCountIn, type MetronomeDivision, type MetronomePulse, type MetronomeVoice } from '@lavozmisionera/core/music/metronomeClock'

const CLICK_DECAY_S = 0.045
type AudioSession = { ctx?: AudioContext; clear?: () => void }

const CLICKS: Record<MetronomeVoice, { frequency: number; peak: number }> = {
  primary: { frequency: 1760, peak: 0.9 },
  secondary: { frequency: 1320, peak: 0.62 },
  normal: { frequency: 1000, peak: 0.42 },
  countIn: { frequency: 2200, peak: 0.55 },
  subdivision: { frequency: 740, peak: 0.23 },
}

function scheduleClick(ctx: AudioContext, at: number, emphasis: MetronomeVoice) {
  const { frequency, peak } = CLICKS[emphasis]
  const osc = ctx.createOscillator()
  const gain = ctx.createGain()
  osc.type = 'sine'
  osc.frequency.setValueAtTime(frequency, at)
  gain.gain.setValueAtTime(0.0001, at)
  gain.gain.exponentialRampToValueAtTime(peak, at + 0.002)
  gain.gain.exponentialRampToValueAtTime(0.0001, at + CLICK_DECAY_S)
  osc.connect(gain)
  gain.connect(ctx.destination)
  osc.start(at)
  osc.stop(at + CLICK_DECAY_S + 0.02)
}

export interface Metronome {
  running: boolean
  start: () => Promise<void>
  stop: () => void
  bpm: number
  setBpm: (bpm: number) => void
  /** Nudge the tempo relative to its LIVE value — safe inside a hold-repeat
   * interval, where a `setBpm(bpm ± 1)` closure would go stale after one step. */
  stepBpm: (delta: number) => void
  signature: TimeSignatureId
  setSignature: (sig: TimeSignatureId) => void
  accentEnabled: boolean
  setAccentEnabled: (on: boolean) => void
  /** 0-based beat currently sounding within the measure; null when stopped. */
  currentBeat: number | null
  remaining: number
  division: MetronomeDivision
  setDivision: (division: MetronomeDivision) => void
  countIn: MetronomeCountIn
  setCountIn: (count: MetronomeCountIn) => void
  error: boolean
}

export function useMetronome(initialBpm = 100): Metronome {
  const [running, setRunning] = useState(false)
  const [bpm, setBpmState] = useState(() => clampBpm(initialBpm))
  const [signature, setSignatureState] = useState<TimeSignatureId>('4/4')
  const [accentEnabled, setAccentEnabledState] = useState(true)
  const [pulse, setPulse] = useState<MetronomePulse | null>(null)
  const [division, setDivision] = useState<MetronomeDivision>(1)
  const [countIn, setCountIn] = useState<MetronomeCountIn>(0)
  const [error, setError] = useState(false)
  const bpmRef = useRef(bpm)
  const settingsRef = useRef({ bpm, meter: signature, accent: accentEnabled, division, countIn })
  settingsRef.current = { bpm, meter: signature, accent: accentEnabled, division, countIn }
  const session = useRef<AudioSession | null>(null)
  const audioActivity = useRef(Promise.resolve<unknown>(undefined))

  const stop = useCallback(() => {
    const active = session.current
    session.current = null
    active?.clear?.()
    if (active?.ctx) void active.ctx.close().catch(() => {})
    if (active) audioActivity.current = audioActivity.current.then(() => AudioManager.setAudioSessionActivity(false)).catch(() => {})
    setRunning(false)
    setPulse(null)
  }, [])

  const start = useCallback(async () => {
    if (session.current) return
    const active: AudioSession = {}
    session.current = active
    setError(false)
    setRunning(true)
    try {
      AudioManager.setAudioSessionOptions({
        iosCategory: 'playback',
        iosMode: 'default',
        iosOptions: ['mixWithOthers'],
        iosAllowHaptics: true,
      })
      const activation = audioActivity.current.then(() => {
        if (session.current === active) return AudioManager.setAudioSessionActivity(true)
      })
      audioActivity.current = activation.catch(() => {})
      await activation
      if (session.current !== active) return
      const ctx = new AudioContext()
      active.ctx = ctx
      if (ctx.state === 'suspended') await ctx.resume()
      if (session.current !== active) return
      active.clear = runMetronome(() => ctx.currentTime, () => settingsRef.current,
        (at, emphasis) => scheduleClick(ctx, at, emphasis), setPulse)
    } catch {
      if (session.current !== active) return
      stop()
      setError(true)
    }
  }, [stop])

  useEffect(() => stop, [stop])

  const setBpm = useCallback((next: number) => {
    const clamped = clampBpm(next)
    bpmRef.current = clamped
    setBpmState(clamped)
  }, [])

  const stepBpm = useCallback(
    (delta: number) => setBpm(bpmRef.current + delta),
    [setBpm]
  )

  return {
    running,
    start,
    stop,
    bpm,
    setBpm,
    stepBpm,
    signature,
    setSignature: setSignatureState,
    accentEnabled,
    setAccentEnabled: setAccentEnabledState,
    currentBeat: pulse?.beat ?? null,
    remaining: pulse?.remaining ?? 0,
    division,
    setDivision,
    countIn,
    setCountIn,
    error,
  }
}
