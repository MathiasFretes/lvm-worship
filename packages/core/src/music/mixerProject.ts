import { MIXER_FILE_BYTES, MIXER_TRACK_LIMIT, type MixerSnapshot, type MixerTrack } from './stemMixer'

export type MixerAsset = { size: number; arrayBuffer: () => Promise<ArrayBuffer> }
type TrackSettings = Pick<MixerTrack, 'name' | 'volume' | 'muted' | 'solo'>
export type MixerManifest = {
  version: 1
  tracks: (TrackSettings & { bytes: number })[]
  rate: number
  pitch: number
  time: number
  loop: MixerSnapshot['loop']
}

export function makeMixerProject<Asset extends MixerAsset>(state: MixerSnapshot, assets: Map<number, Asset>) {
  const files: Asset[] = []
  const tracks = state.tracks.map(({ id, name, volume, muted, solo }) => {
    const file = assets.get(id)
    if (!file || file.size <= 0) throw new Error('Mixer track file missing')
    files.push(file)
    return { name, volume, muted, solo, bytes: file.size }
  })
  return {
    manifest: { version: 1, tracks, rate: state.rate, pitch: state.pitch, time: state.time, loop: state.loop } satisfies MixerManifest,
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
  return { version: 1, tracks, rate: number(value.rate, 0.5, 1.5), pitch, time: number(value.time, 0), loop }
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
