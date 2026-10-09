import { afterEach, describe, expect, it, vi } from 'vitest'

vi.mock('../translations', () => ({
  getDefaultBibleTranslationId: () => 'esv',
  normalizeBibleTranslationId: (value: string) => value,
  listBibleTranslations: async () => ({
    translations: [{ id: 'esv', dataRoot: 'bible/en/esv' }],
    defaultTranslationId: 'esv',
  }),
}))

import { fetchBibleChapter } from '../chapters'

afterEach(() => vi.unstubAllGlobals())

describe('Bible chapter response', () => {
  it('rejects the Vite HTML fallback without parsing it as a chapter', async () => {
    const json = vi.fn()
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      headers: new Headers({ 'content-type': 'text/html' }),
      json,
    }))

    await expect(fetchBibleChapter({ book: '1', chapter: 1 })).rejects.toThrow('not JSON')
    expect(json).not.toHaveBeenCalled()
  })
})
