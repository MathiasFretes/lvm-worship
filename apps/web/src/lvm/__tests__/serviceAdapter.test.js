import { describe, expect, it } from 'vitest'
import fixture from '../../../../../fixtures/sunday-service.json'
import { mockDataSource } from '../../mock/data'
import { buildService } from '../serviceAdapter'

describe('LVM service contract', () => {
  it('exports the canonical service without GraceChords fields', async () => {
    const plan = await mockDataSource.getServicePlan()
    const songs = await mockDataSource.listSongs()
    expect(buildService(plan, songs)).toEqual(fixture)
  })

  it('refuses an incomplete repertory', async () => {
    const plan = await mockDataSource.getServicePlan()
    expect(() => buildService(plan, [])).toThrow('Missing song song-1')
  })
})
