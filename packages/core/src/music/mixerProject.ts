import { MIXER_FILE_BYTES, MIXER_TRACK_LIMIT, type MixerSnapshot, type MixerTrack } from './stemMixer'

export type MixerAsset = { size: number; arrayBuffer: () => Promise<ArrayBuffer> }
export type MixerMarker = { label: string; time: number; section?: number }
export const MIXER_CHART_LIMIT = 256 * 1024

export function mixerProjectKey(songId?: string | null) {
  return songId ? `song:${encodeURIComponent(songId)}` : 'draft'
}

export function putMixerMarker(markers: MixerMarker[], label: string, time: number, section?: number): MixerMarker[] {
  const name = label.trim()
  if (!name || name.length > 100 || !Number.isFinite(time) || time < 0) throw new Error('Invalid mixer marker')
  if (section !== undefined && (!Number.isSafeInteger(section) || section < 0)) throw new Error('Invalid chart section')
  const rounded = Math.round(time * 1000) / 1000
  const next = markers.filter(marker => marker.time !== rounded)
  if (next.length >= 100) throw new Error('Too many mixer markers')
  return [...next, { label: name, time: rounded, ...(section !== undefined ? { section } : {}) }].sort((a, b) => a.time - b.time)
}

export function currentMixerMarker(markers: MixerMarker[], time: number) {
  for (let index = markers.length - 1; index >= 0; index -= 1) {
    if (markers[index].section !== undefined && markers[index].time <= time) return markers[index]
  }
}

export function mixerChartSteps(value: unknown) {
  const steps = typeof value === 'string' ? Number(value) : 0
  return Number.isInteger(steps) && Math.abs(steps) <= 24 ? steps : 0
}

type TrackSettings = Pick<MixerTrack, 'name' | 'volume' | 'muted' | 'solo'>
export type MixerManifest = {
  version: 1
  tracks: (TrackSettings & { bytes: number })[]
  rate: number
  pitch: number
  time: number
  loop: MixerSnapshot['loop']
  markers: MixerMarker[]
  chart?: string
  chartKey?: { steps: number; preferFlat: boolean }
}

export function makeMixerProject<Asset extends MixerAsset>(state: MixerSnapshot, assets: Map<number, Asset>, markers: MixerMarker[] = [], chart?: string, chartKey?: MixerManifest['chartKey']) {
  const files: Asset[] = []
  const tracks = state.tracks.map(({ id, name, volume, muted, solo }) => {
    const file = assets.get(id)
    if (!file || file.size <= 0) throw new Error('Mixer track file missing')
    files.push(file)
    return { name, volume, muted, solo, bytes: file.size }
  })
  return {
    manifest: { version: 1, tracks, rate: state.rate, pitch: state.pitch, time: state.time, loop: state.loop, markers, chart, chartKey } satisfies MixerManifest,
    files,
  }
}

function object(value: unknown): Record<string, unknown> {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) throw new Error('Invalid mixer project')
  return value as Record<string, unknown>
}

function number(value: unknown, min: number, max = Number.MAX_SAFE_INTEGER) {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < min || value > max) throw new Error('Invalid mixer project number')
  return value
}

export function parseMixerManifest(input: unknown): MixerManifest {
  const value = object(input)
  if (value.version !== 1 || !Array.isArray(value.tracks) || value.tracks.length > MIXER_TRACK_LIMIT) {
    throw new Error('Unsupported mixer project')
  }
  const tracks = value.tracks.map(input => {
    const track = object(input)
    if (typeof track.name !== 'string' || !track.name || typeof track.muted !== 'boolean' || typeof track.solo !== 'boolean') {
      throw new Error('Invalid mixer track')
    }
    return { name: track.name, volume: number(track.volume, 0, 1), muted: track.muted, solo: track.solo, bytes: number(track.bytes, 1, MIXER_FILE_BYTES) }
  })
  let loop = null
  if (value.loop !== null) {
    const bounds = object(value.loop)
    const start = number(bounds.start, 0)
    const end = number(bounds.end, start)
    if (end - start < 0.25) throw new Error('Invalid mixer loop')
    loop = { start, end }
  }
  const pitch = value.pitch === undefined ? 0 : number(value.pitch, -12, 12)
  if (!Number.isInteger(pitch)) throw new Error('Invalid mixer pitch')
  const markers = value.markers === undefined ? [] : value.markers
  if (!Array.isArray(markers) || markers.length > 100) throw new Error('Invalid mixer markers')
  const ordered = markers.reduce<MixerMarker[]>((result, input) => {
    const marker = object(input)
    if (typeof marker.label !== 'string') throw new Error('Invalid mixer marker label')
    const section = marker.section === undefined ? undefined : number(marker.section, 0)
    return putMixerMarker(result, marker.label, number(marker.time, 0), section)
  }, [])
  const chart = value.chart
  if (chart !== undefined && (typeof chart !== 'string' || chart.length > MIXER_CHART_LIMIT)) throw new Error('Invalid mixer chart')
  let chartKey: MixerManifest['chartKey']
  if (value.chartKey !== undefined) {
    const key = object(value.chartKey)
    const steps = number(key.steps, -24, 24)
    if (!Number.isInteger(steps) || typeof key.preferFlat !== 'boolean') throw new Error('Invalid mixer chart key')
    chartKey = { steps, preferFlat: key.preferFlat }
  }
  return { version: 1, tracks, rate: number(value.rate, 0.5, 1.5), pitch, time: number(value.time, 0), loop, markers: ordered, chart, chartKey }
}

export async function restoreMixerProject<Asset extends MixerAsset>(
  input: unknown,
  files: Asset[],
  engine: {
    add: (name: string, bytes: ArrayBuffer) => Promise<number | null>
    update: (id: number, track: TrackSettings) => void
    setRate: (rate: number) => void
    setPitch: (pitch: number) => void
    setLoop: (start: number, end: number) => boolean
    seek: (time: number) => void
  },
) {
  const manifest = parseMixerManifest(input)
  if (files.length !== manifest.tracks.length || files.some((file, i) => file?.size !== manifest.tracks[i].bytes)) {
    throw new Error('Mixer project files missing')
  }
  const assets = new Map<number, Asset>()
  for (const [index, track] of manifest.tracks.entries()) {
    const file = files[index]
    const id = await engine.add(track.name, await file.arrayBuffer())
    if (id === null) throw new Error('Could not restore mixer track')
    assets.set(id, file)
    engine.update(id, track)
  }
  engine.setRate(manifest.rate)
  engine.setPitch(manifest.pitch)
  if (manifest.loop && !engine.setLoop(manifest.loop.start, manifest.loop.end)) throw new Error('Mixer loop exceeds audio length')
  engine.seek(manifest.time)
  return { manifest, assets }
}
