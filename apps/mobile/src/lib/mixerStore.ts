import AsyncStorage from '@react-native-async-storage/async-storage'
import { Directory, File, Paths } from 'expo-file-system'
import { mixerProjectKey, parseMixerManifest, type MixerManifest } from '@lavozmisionera/core/music/mixerProject'
import { uuidv4 } from './uuid'

function storageKey(songId?: string) {
  return songId ? `lvm.worship.mixer.v1.${mixerProjectKey(songId)}` : 'lvm.worship.mixer.v1'
}
const validId = /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/
let pending: Promise<unknown> = Promise.resolve()

function fileFor(id: string) {
  return new File(Paths.document, 'lvm-mixer', `${id}.audio`)
}

async function readRecord(key: string) {
  const raw = await AsyncStorage.getItem(key)
  if (!raw) return null
  const record = JSON.parse(raw)
  const manifest = parseMixerManifest(record.manifest)
  if (!Array.isArray(record.ids) || record.ids.length !== manifest.tracks.length ||
      !record.ids.every((id: unknown) => typeof id === 'string' && validId.test(id))) throw new Error('Invalid mixer asset references')
  return { manifest, ids: record.ids as string[] }
}

function removeFile(file: File) {
  try { if (file.exists) file.delete() } catch { /* The saved manifest remains authoritative. */ }
}

export async function readMixerProject(songId?: string) {
  await pending
  const record = await readRecord(storageKey(songId))
  return record ? { manifest: record.manifest, files: record.ids.map(fileFor) } : null
}

export function writeMixerProject(project: { manifest: MixerManifest; files: File[] }, songId?: string) {
  const key = storageKey(songId)
  const operation = pending.then(async () => {
    const previous = await readRecord(key).catch(() => null)
    if (!project.files.length) {
      await AsyncStorage.removeItem(key)
      previous?.ids.forEach(id => removeFile(fileFor(id)))
      return []
    }
    const directory = new Directory(Paths.document, 'lvm-mixer')
    directory.create({ idempotent: true, intermediates: true })
    const created: File[] = []
    let ids: string[]
    try {
      ids = project.files.map((file, index) => {
        if (file.size !== project.manifest.tracks[index].bytes) throw new Error('Mixer source file missing')
        const existing = previous?.ids.find(id => fileFor(id).uri === file.uri)
        if (existing) return existing
        const id = uuidv4()
        const target = fileFor(id)
        if (target.exists) throw new Error('Mixer asset already exists')
        created.push(target)
        file.copy(target)
        if (target.size !== file.size) throw new Error('Incomplete mixer asset')
        return id
      })
      await AsyncStorage.setItem(key, JSON.stringify({ manifest: project.manifest, ids }))
    } catch (error) {
      created.forEach(removeFile)
      throw error
    }
    previous?.ids.filter(id => !ids.includes(id)).forEach(id => removeFile(fileFor(id)))
    return ids.map(fileFor)
  })
  pending = operation.catch(() => undefined)
  return operation
}
