import { describe, expect, it, vi } from 'vitest'
import {
  CACHED_SPRITE_KEY,
  PENDING_SPRITE_KEY,
  clearCachedSprite,
  readCachedSprite,
  stashPendingSprite,
  writeCachedSprite,
  type KVStorage,
} from '../profile'

function memoryStorage(seed: Record<string, string> = {}) {
  const values = new Map(Object.entries(seed))
  const storage: KVStorage = {
    getItem: vi.fn(async (key) => values.get(key) ?? null),
    setItem: vi.fn(async (key, value) => {
      values.set(key, value)
    }),
    removeItem: vi.fn(async (key) => {
      values.delete(key)
    }),
  }
  return { storage, values }
}

describe('profile sprite storage keys', () => {
  it('writes only the LVM cache key', async () => {
    const { storage, values } = memoryStorage()

    await writeCachedSprite(storage, 'user-1', 'lamb')

    expect(values.get(CACHED_SPRITE_KEY)).toBe('user-1:lamb')
  })

  it('reads a matching LVM cache', async () => {
    const { storage } = memoryStorage({ [CACHED_SPRITE_KEY]: 'user-1:lion' })
    await expect(readCachedSprite(storage, 'user-1')).resolves.toBe('lion')
  })

  it('never exposes a cache owned by another account', async () => {
    const { storage } = memoryStorage({ [CACHED_SPRITE_KEY]: 'user-2:lion' })
    await expect(readCachedSprite(storage, 'user-1')).resolves.toBeNull()
  })

  it('clears the cache on sign-out', async () => {
    const { storage, values } = memoryStorage({ [CACHED_SPRITE_KEY]: 'user-1:lamb' })

    await clearCachedSprite(storage)

    expect(values.has(CACHED_SPRITE_KEY)).toBe(false)
  })

  it('stashes pending onboarding state under the LVM key', async () => {
    const { storage, values } = memoryStorage()

    await stashPendingSprite(storage, 'lamb')

    expect(values.get(PENDING_SPRITE_KEY)).toBe('lamb')
  })
})
