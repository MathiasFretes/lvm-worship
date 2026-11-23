import { beforeEach, expect, it } from 'vitest'
import { clearEditorDraft, readEditorDraft, writeEditorDraft } from './editorDraftJournal'

const form = { title: 'QA', tags: ['QA'], chordpro_content: '[G]Original' }
const operation = { id: '00000000-0000-4000-9000-000000000001', signature: 'save:QA' }
beforeEach(() => {
  for (const key of Object.keys(localStorage)) if (key.startsWith('lvm.editor-draft.v1:')) localStorage.removeItem(key)
})

it('recovers content, original revision and operation only for its account and song', () => {
  expect(writeEditorDraft('account-a', 'new', { form, baseUpdatedAt: '2026-11-23', operation })).toBe(true)
  expect(readEditorDraft('account-a', 'new')).toMatchObject({ form, baseUpdatedAt: '2026-11-23', operation })
  expect(readEditorDraft('account-b', 'new')).toBeNull()
  expect(readEditorDraft('account-a', 'song:other')).toBeNull()
  clearEditorDraft('account-b', 'new')
  expect(readEditorDraft('account-a', 'new')).not.toBeNull()
  clearEditorDraft('account-a', 'new')
  expect(readEditorDraft('account-a', 'new')).toBeNull()
})

it('ignores anonymous, malformed and mismatched cached drafts', () => {
  expect(writeEditorDraft(null, 'new', { form })).toBe(false)
  localStorage.setItem('lvm.editor-draft.v1:account-a:new', '{invalid')
  expect(readEditorDraft('account-a', 'new')).toBeNull()
  localStorage.setItem('lvm.editor-draft.v1:account-a:new', JSON.stringify({ version: 1, accountId: 'account-b', route: 'new', form }))
  expect(readEditorDraft('account-a', 'new')).toBeNull()
})
