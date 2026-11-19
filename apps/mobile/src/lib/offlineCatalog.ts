import AsyncStorage from '@react-native-async-storage/async-storage'
import { Directory, File, Paths } from 'expo-file-system'
import { CATALOG_CACHE_BYTES, createOfflineCatalog } from '@lavozmisionera/core/songs/offlineCatalog'
import { uuidv4 } from './uuid'

const pointerKey = 'lvm.worship.catalog.v1'
const validId = /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/
const directory = () => new Directory(Paths.document, 'lvm-public-catalog')
const fileFor = (id: string) => new File(directory(), `${id}.json`)

function discard(file: File) {
  try { if (file.exists) file.delete() } catch { /* An unreferenced snapshot can be reclaimed later. */ }
}

export const offlineCatalog = createOfflineCatalog({
  async read() {
    const id = await AsyncStorage.getItem(pointerKey)
    if (!id || !validId.test(id)) return null
    const file = fileFor(id)
    if (!file.exists || file.size > CATALOG_CACHE_BYTES) return null
    return file.text()
  },
  async write(raw) {
    const previous = await AsyncStorage.getItem(pointerKey)
    const id = uuidv4()
    const file = fileFor(id)
    directory().create({ intermediates: true, idempotent: true })
    try {
      file.write(raw)
      if (file.size > CATALOG_CACHE_BYTES) throw new Error('Catalog exceeds offline budget')
      // Publish only a complete file; a failed write keeps the preceding pointer valid.
      await AsyncStorage.setItem(pointerKey, id)
    } catch (error) { discard(file); throw error }
    if (previous && validId.test(previous)) discard(fileFor(previous))
  },
})

export async function findOfflineSong(slug: string) {
  return (await offlineCatalog.read()).find(song => song.slug === slug) ?? null
}
