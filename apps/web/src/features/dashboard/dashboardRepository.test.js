import { loadDashboardSongs } from './dashboardRepository'

const database = vi.hoisted(() => ({ result: null, table: vi.fn(), columns: vi.fn() }))
vi.mock('../../lib/supabase', () => ({
  supabase: {
    from: (...args) => {
      database.table(...args)
      const query = {
        select: (...columns) => { database.columns(...columns); return query },
        eq: () => query,
        order: () => query,
        limit: async () => database.result,
      }
      return query
    },
  },
}))

describe('dashboard catalog read model', () => {
  beforeEach(() => {
    database.table.mockClear()
    database.columns.mockClear()
  })

  test('uses an exact count while limiting the preview rows', async () => {
    database.result = {
      count: 42,
      error: null,
      data: [{ slug: 'santo', title: 'Santo', artist: 'LVM', default_key: 'G' }],
    }
    await expect(loadDashboardSongs()).resolves.toEqual({
      total: 42,
      songs: [{ id: 'santo', title: 'Santo', artist: 'LVM', key: 'G' }],
    })
    expect(database.table).toHaveBeenCalledWith('songs')
    expect(database.columns).toHaveBeenCalledWith('slug, title, artist, default_key', { count: 'exact' })
  })

  test('propagates a failed read so the dashboard can show an error', async () => {
    database.result = { data: null, count: null, error: new Error('not available') }
    await expect(loadDashboardSongs()).rejects.toThrow('not available')
  })
})
