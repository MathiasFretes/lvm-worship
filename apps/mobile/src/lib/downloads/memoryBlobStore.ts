import type { BlobStore } from './types'

// In-memory BlobStore for the headless test harness (and any pure logic run).
// Files are a flat Map keyed by relative path; "directories" are path prefixes.
// Mirrors the atomicity/size semantics the expo impl gives on device.

export type MemoryBlobStore = BlobStore & {
  /** Direct view of the backing map (test assertions). */
  files: Map<string, string>
  /** Relative paths currently present, for convenience in tests. */
  keys(): string[]
}

function norm(relPath: string): string {
  return String(relPath || '')
    .split('/')
    .filter((p) => p && p !== '.')
    .join('/')
}

function dirPrefix(relPath: string): string {
  const n = norm(relPath)
  return n ? `${n}/` : ''
}

export function createMemoryBlobStore(): MemoryBlobStore {
  const files = new Map<string, string>()

  const store: MemoryBlobStore = {
    files,
    keys: () => Array.from(files.keys()),

    async exists(relPath) {
      const n = norm(relPath)
      if (files.has(n)) return true
      const prefix = dirPrefix(relPath)
      return Array.from(files.keys()).some((key) => key.startsWith(prefix))
    },

    async readText(relPath) {
      const n = norm(relPath)
      const v = files.get(n)
      if (v == null) throw new Error(`ENOENT: ${n}`)
      return v
    },

    async writeText(relPath, text) {
      files.set(norm(relPath), text)
    },

    async deleteDir(relPath) {
      const prefix = dirPrefix(relPath)
      const n = norm(relPath)
      for (const k of Array.from(files.keys())) {
        if (k === n || k.startsWith(prefix)) files.delete(k)
      }
    },

    async moveDir(fromRel, toRel) {
      const fromPrefix = dirPrefix(fromRel)
      const toPrefix = dirPrefix(toRel)
      // Replace any existing destination tree first (atomic finalize semantics).
      await store.deleteDir(toRel)
      const moved = Array.from(files.entries()).filter(([key]) => key.startsWith(fromPrefix))
      for (const [key] of moved) files.delete(key)
      for (const [key, value] of moved) {
        files.set(toPrefix + key.slice(fromPrefix.length), value)
      }
    },

    async dirSizeBytes(relPath) {
      const prefix = dirPrefix(relPath)
      let total = 0
      for (const [k, v] of files.entries()) {
        if (k.startsWith(prefix)) total += byteLength(v)
      }
      return total
    },
  }

  return store
}

function byteLength(s: string): number {
  // UTF-8 byte length without relying on Buffer/TextEncoder availability.
  let bytes = 0
  for (const character of s) {
    const code = character.codePointAt(0) ?? 0
    if (code <= 0x7f) bytes += 1
    else if (code <= 0x7ff) bytes += 2
    else if (code <= 0xffff) bytes += 3
    else bytes += 4
  }
  return bytes
}
