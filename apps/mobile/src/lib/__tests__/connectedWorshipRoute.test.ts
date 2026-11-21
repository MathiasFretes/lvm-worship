import { expect, it } from 'vitest'
import { connectedWorshipRoute } from '../connectedWorshipRoute'
import { deepLinkStackRouteKey, resolveDeepLinkPath } from '../deepLinks'

const churchId = '00000000-0000-4000-8000-000000000011'

it('preserves the existing file route and binds connected routes to the authenticated actor', () => {
  expect(connectedWorshipRoute('musician', {})).toBeNull()
  const params = { churchId, serviceId: 'culto/uno' }
  const first = connectedWorshipRoute('musician', params)!
  expect(first).toMatchObject({ userId: 'musician', churchId, serviceId: 'culto/uno' })
  expect(connectedWorshipRoute('musician', params)).toEqual(first)
  expect(connectedWorshipRoute('other', params)?.userId).toBe('other')
  expect(() => connectedWorshipRoute('musician', { churchId: 'legacy', serviceId: 'culto' })).toThrow()
  expect(() => connectedWorshipRoute('musician', { churchId: [churchId, churchId], serviceId: 'culto' })).toThrow()
  expect(() => connectedWorshipRoute('musician', { churchId, serviceId: '' })).toThrow()
  expect(() => connectedWorshipRoute('musician', { churchId })).toThrow()
})

it('opens a connected preparation link without treating service as a shared song slug', () => {
  const query = `churchId=${churchId}&serviceId=culto%2Funo`
  for (const prefix of ['', 'lavozmisionera:/', 'https://srv2137598.hstgr.cloud']) {
    expect(resolveDeepLinkPath(`${prefix}/setlist/service?${query}`)).toBe(`/setlist/service?${query}`)
  }
  expect(deepLinkStackRouteKey(`/setlist/service?${query}`)).toBe('setlist/service')
  expect(resolveDeepLinkPath('/setlist/service')).toBe('/setlist/service')
  expect(resolveDeepLinkPath(`https://srv2137598.hstgr.cloud/setlist?${query}`)).toBe(`/setlist/service?${query}`)
  expect(resolveDeepLinkPath('/setlist?churchId=legacy')).toBe('/setlist/service?churchId=legacy')
  expect(resolveDeepLinkPath('/setlist/song-slug')).toBe('/setlist/import?ids=song-slug')
})
