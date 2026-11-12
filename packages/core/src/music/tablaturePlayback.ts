import { getTabSystems } from './tablature'

const pitchClasses: Record<string, number> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 }
const guitarOctaves: Record<number, number[]> = {
  4: [2, 2, 1, 1],
  5: [2, 2, 1, 1, 0],
  6: [4, 3, 3, 3, 2, 2],
  7: [4, 3, 3, 3, 2, 2, 1],
  8: [4, 3, 3, 3, 2, 2, 1, 1],
}
const ukuleleOctaves = [4, 4, 4, 4]

function openPitch(tuning: string, octave: number) {
  const [, letter, accidental, explicit] = tuning.match(/^([A-Ga-g])([#b♯♭]?)([0-9]?)$/)!
  const offset = accidental === '#' || accidental === '♯' ? 1 : accidental ? -1 : 0
  return 12 * ((explicit ? Number(explicit) : octave) + 1) + pitchClasses[letter.toUpperCase()] + offset
}

export type TabPlaybackMeasure = {
  system: number
  measure: number
  columns: number
  notes: { column: number; midi: number; length?: number }[]
  quarterBeats?: number
  clicks?: number
}

export type TabPlaybackPosition = {
  system: number
  measure: number
  column: number
  index: number
}

export function buildTabPlayback(source: string): TabPlaybackMeasure[] {
  return getTabSystems(source).flatMap((strings, system) => {
    const octaves = strings.length === 4 && strings.map(row => row.tuning[0].toUpperCase()).join('') === 'AECG'
      ? ukuleleOctaves : guitarOctaves[strings.length]
    const open = strings.map(({ tuning }, row) => openPitch(tuning, octaves[row]))
    const count = Math.max(...strings.map(row => row.measures.length))
    return Array.from({ length: count }, (_, measure) => {
      const parts = strings.map(row => row.measures[measure] ?? '')
      const columns = Math.max(...parts.map(part => part.length))
      const notes = parts.flatMap((part, row) => Array.from(part.matchAll(/\d+/g), match => ({
        column: match.index ?? 0, midi: open[row] + Number(match[0]), fret: Number(match[0]),
      })).filter(note => note.fret <= 36).map(({ column, midi }) => ({ column, midi })))
      return { system, measure, columns, notes: notes.sort((a, b) => a.column - b.column) }
    }).filter(measure => measure.columns > 0)
  })
}

export function tabPlaybackSettings(bpm: string, speed: string, transpose: string) {
  function between(raw: string, fallback: number, min: number, max: number) {
    const value = raw.trim() ? Number(raw) : fallback
    return Number.isFinite(value) ? Math.min(max, Math.max(min, Math.round(value))) : fallback
  }
  return {
    bpm: between(bpm, 96, 30, 300),
    speed: between(speed, 100, 25, 150),
    transpose: between(transpose, 0, -12, 12),
  }
}

export function tabLoopMeasures(measures: TabPlaybackMeasure[], first: string, last: string) {
  const from = Number(first)
  const to = Number(last || measures.length)
  if (!Number.isInteger(from) || !Number.isInteger(to) || from < 1 || to < from || to > measures.length) return []
  return measures.slice(from - 1, to)
}

type ScheduledNote = (at: number, midi: number, decay: number, click: boolean, sustain?: boolean) => () => void

export function createTabTransport({
  measures, secondsPerMeasure, transpose, loop, metronome = false, clock, note, onPosition, onEnd, onError,
}: {
  measures: TabPlaybackMeasure[]
  secondsPerMeasure: number
  transpose: number
  loop: boolean
  metronome?: boolean
  clock: () => number
  note: ScheduledNote
  onPosition: (position: TabPlaybackPosition) => void
  onEnd: () => void
  onError: () => void
}) {
  const duration = secondsPerMeasure * measures.length
  const events = measures.map(measure => {
    const notes = measure.notes.map(note => ({ ...note, midi: note.midi + transpose, click: false }))
    if (metronome) {
      const clicks = measure.clicks ?? 4
      for (let beat = 0; beat < clicks; beat++) {
        notes.push({ column: beat * measure.columns / clicks, midi: beat === 0 ? 93 : 81, click: true })
      }
      notes.sort((a, b) => a.column - b.column)
    }
    return notes
  })
  let offset = 0
  let origin = 0
  let startsAt = 0
  let cursor = 0
  let noteIndex = 0
  let lastPosition = ''
  let interval: ReturnType<typeof setInterval> | null = null
  const sounding = new Map<() => void, number>()

  function clear() {
    if (interval !== null) clearInterval(interval)
    interval = null
    for (const cancel of sounding.keys()) cancel()
    sounding.clear()
  }

  function tick() {
    try {
      const now = clock()
      for (const [cancel, endsAt] of sounding) if (endsAt <= now) sounding.delete(cancel)
      const elapsed = Math.max(0, now - origin)
      if (!loop && elapsed >= duration) {
        clear()
        onEnd()
        return
      }
      const index = Math.floor(elapsed / secondsPerMeasure)
      const measure = measures[index % measures.length]
      const column = Math.min(measure.columns - 1, Math.floor((elapsed % secondsPerMeasure) * measure.columns / secondsPerMeasure))
      const key = `${index}:${column}`
      if (now >= startsAt && key !== lastPosition) {
        lastPosition = key
        onPosition({ system: measure.system, measure: measure.measure, column, index: index % measures.length })
      }
      const horizon = now + 0.12
      // Jump directly to the current measure if the app's JS thread was stalled.
      if (cursor < index) {
        cursor = index
        noteIndex = 0
      }
      while ((loop || cursor < measures.length) && origin + cursor * secondsPerMeasure < horizon) {
        const current = cursor % measures.length
        const entry = measures[current]
        const start = origin + cursor * secondsPerMeasure
        while (noteIndex < events[current].length) {
          const next = events[current][noteIndex]
          const at = start + next.column / entry.columns * secondsPerMeasure
          if (at > horizon) return
          noteIndex++
          if (next.length !== undefined) {
            const end = at + next.length / entry.columns * secondsPerMeasure
            const startAt = Math.max(now, startsAt, at)
            if (startAt < end) sounding.set(note(startAt, next.midi, end - startAt, false, true), end)
            continue
          }
          if (at < startsAt - 0.000001 || at < now - 0.02) continue
          const decay = next.click ? 0.04 : Math.min(0.35, Math.max(0.055, 2 * secondsPerMeasure / entry.columns))
          sounding.set(note(Math.max(now, at), next.midi, decay, next.click), Math.max(now, at) + decay)
        }
        cursor++
        noteIndex = 0
      }
    } catch {
      clear()
      onError()
    }
  }

  return {
    play() {
      if (interval !== null || duration <= 0) return
      startsAt = clock() + 0.06
      origin = startsAt - offset
      cursor = Math.floor(offset / secondsPerMeasure)
      noteIndex = 0
      interval = setInterval(tick, 25)
      tick()
    },
    pause() {
      if (interval === null) return
      if (clock() >= startsAt) offset = (clock() - origin) % duration
      clear()
    },
    stop() {
      clear()
      offset = 0
    },
  }
}

export type TabAudio = { clock: () => number; note: ScheduledNote; close: () => void }
export type TabSession = ReturnType<typeof createTabSession>

export function createTabSession({
  open, onPosition, onStatus,
}: {
  open: () => Promise<TabAudio>
  onPosition: (position: TabPlaybackPosition | null) => void
  onStatus: (status: 'idle' | 'opening' | 'playing' | 'paused' | 'error') => void
}) {
  let audio: TabAudio | null = null
  let transport: ReturnType<typeof createTabTransport> | null = null
  let generation = 0
  let status: Parameters<typeof onStatus>[0] = 'idle'

  function report(value: typeof status) {
    status = value
    onStatus(value)
  }

  function reset() {
    generation++
    transport?.stop()
    transport = null
    audio?.close()
    audio = null
  }

  function finish(value: 'idle' | 'error') {
    reset()
    onPosition(null)
    report(value)
  }

  return {
    async play(measures: TabPlaybackMeasure[], bpm: number, speed: number, transpose: number, loop: boolean, metronome = false) {
      if (status === 'opening' || status === 'playing' || !measures.length) return
      if (status === 'paused' && transport) {
        report('playing')
        transport.play()
        return
      }
      report('opening')
      const request = ++generation
      try {
        const driver = await open()
        if (request !== generation) {
          driver.close()
          return
        }
        audio = driver
        transport = createTabTransport({
          measures, secondsPerMeasure: 6000 * (measures[0].quarterBeats ?? 4) / (bpm * speed), transpose, loop, metronome,
          clock: driver.clock, note: driver.note, onPosition,
          onEnd: () => finish('idle'), onError: () => finish('error'),
        })
        report('playing')
        transport.play()
      } catch {
        if (request === generation) finish('error')
      }
    },
    pause() {
      if (status !== 'playing') return
      transport?.pause()
      report('paused')
    },
    stop() { finish('idle') },
    dispose() {
      reset()
      status = 'idle'
    },
  }
}

export const tabMidiFrequency = (midi: number) => 440 * 2 ** ((midi - 69) / 12)
