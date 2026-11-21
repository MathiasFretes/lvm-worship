import { beforeEach, describe, expect, it, vi } from 'vitest'
import { exchangeRequest, listServiceDrafts, openServiceDraft, serviceScope, sameServicePlan } from '../serviceDrafts'
const church = '00000000-0000-4000-8000-000000000011'
const branch = '00000000-0000-4000-8000-000000000099'
beforeEach(() => localStorage.clear())
describe('connected Worship drafts', () => {
  it('compares the confirmed proposal by content even when PostgreSQL reorders JSON keys', () => {
    const local = { serviceId: 'a', songs: [{ title: 'Fiel', sections: [{ kind: 'verse', label: 'V' }] }] }
    expect(sameServicePlan(local, { songs: [{ sections: [{ label: 'V', kind: 'verse' }], title: 'Fiel' }], serviceId: 'a' })).toBe(true)
    expect(sameServicePlan(local, { ...local, songs: [] })).toBe(false)
    expect(sameServicePlan(local, null)).toBe(false)
  })
  it('keeps account/church/service branches separate from the personal draft', () => {
    const scope = serviceScope('account-a', church, 'service-a')
    localStorage.setItem('lvm.draft.v1', 'personal')
    const key = openServiceDraft(localStorage, scope, null, branch)
    localStorage.setItem(key, JSON.stringify({ name: 'Repertorio A', entries: [{ songId: 'private' }] }))
    expect(listServiceDrafts(localStorage, scope)).toHaveLength(1)
    expect(listServiceDrafts(localStorage, serviceScope('account-b', church, 'service-a'))).toEqual([])
    expect(listServiceDrafts(localStorage, serviceScope('account-a', church, 'service-b'))).toEqual([])
    expect(localStorage.getItem('lvm.draft.v1')).toBe('personal')
    expect(() => openServiceDraft(localStorage, scope, key, branch)).toThrow('exists')
  })
  it('copies a recoverable branch and its exact pending operation without deleting the original', () => {
    const scope = serviceScope('account-a', church, 'service-a')
    const key = openServiceDraft(localStorage, scope, null, branch)
    const draft = JSON.stringify({ name: 'Copia', entries: [{ songId: 'song-a', notes: 'Entrada' }] })
    const pending = JSON.stringify({ pending: { id: branch, input: { revision: 3, serviceRevision: 5 } } })
    localStorage.setItem(key, draft)
    localStorage.setItem(`${key}:exchange`, pending)
    const cloned = openServiceDraft(localStorage, scope, key, '00000000-0000-4000-8000-000000000098')
    expect(localStorage.getItem(cloned)).toBe(draft)
    expect(localStorage.getItem(`${cloned}:exchange`)).toBe(pending)
    expect(localStorage.getItem(key)).toBe(draft)
    expect(listServiceDrafts(localStorage, scope)).toHaveLength(2)
    expect(() => openServiceDraft(localStorage, serviceScope('account-b', church, 'service-a'), key, branch)).toThrow('another scope')
  })
  it('binds requests to account, church, service and operation, preserving API conflicts', async () => {
    const scope = serviceScope('account-a', church, 'culto/uno')
    const fetcher = vi.fn().mockResolvedValue({ ok: false, status: 409, json: async () => ({ message: 'El culto cambió' }) })
    await expect(exchangeRequest(scope, { method: 'PUT', input: { revision: 1 }, operationId: branch, fetcher })).rejects.toMatchObject({ status: 409, message: 'El culto cambió' })
    expect(fetcher).toHaveBeenCalledWith(`/api/churches/${church}/services/culto%2Funo/worship`, expect.objectContaining({ credentials: 'same-origin', cache: 'no-store', headers: { 'Content-Type': 'application/json', 'X-LVM-Account': 'account-a', 'X-LVM-Operation': branch } }))
  })
})
