const key = (accountId, route) => `lvm.editor-draft.v1:${accountId}:${route}`

export function readEditorDraft(accountId, route) {
  if (!accountId) return null
  try {
    const entry = JSON.parse(localStorage.getItem(key(accountId, route)))
    if (entry?.version !== 1 || entry.accountId !== accountId || entry.route !== route) return null
    if (typeof entry.form?.title !== 'string' || typeof entry.form?.chordpro_content !== 'string'
      || !Array.isArray(entry.form?.tags) || entry.form.tags.some(tag => typeof tag !== 'string')) return null
    if (entry.operation && (typeof entry.operation.signature !== 'string' || !/^[a-f0-9-]{36}$/.test(entry.operation.id))) return null
    return entry
  } catch { return null }
}

export function writeEditorDraft(accountId, route, { form, baseUpdatedAt, operation }) {
  if (!accountId) return false
  try {
    localStorage.setItem(key(accountId, route), JSON.stringify({ version: 1, accountId, route, form, baseUpdatedAt, operation }))
    return true
  } catch { return false }
}

export function clearEditorDraft(accountId, route) {
  if (!accountId) return
  try { localStorage.removeItem(key(accountId, route)) } catch { /* Recovery storage can be unavailable. */ }
}
