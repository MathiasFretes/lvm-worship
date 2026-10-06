import { useState } from 'react'
import { useAuth } from '../../hooks/useAuth'
import { useRole } from '../../hooks/useRole'
import { publicUrl } from '../../utils/network/publicUrl'

const workerUrl = import.meta.env.VITE_PPTX_WORKER_URL || ''
const maxBytes = 20 * 1024 * 1024

export function PptxAttachment({ value, slug, title, onChange, onSaved, disabled }) {
  const { session } = useAuth()
  const { can, isAtLeast } = useRole()
  const [file, setFile] = useState(null)
  const [replacing, setReplacing] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const canWrite = isAtLeast('editor')
  const canDelete = can('deletePptx')

  function selectFile(event) {
    const selected = event.target.files?.[0]
    setFile(null)
    setError('')
    if (!selected) return
    if (!selected.name.toLowerCase().endsWith('.pptx')) { setError('Choose a PPTX file'); return }
    if (selected.size > maxBytes) { setError('The file must be smaller than 20 MB'); return }
    setFile(selected)
  }

  async function request(path, options) {
    const response = await fetch(`${workerUrl}${path}`, {
      ...options,
      headers: { Authorization: `Bearer ${session?.access_token || ''}`, ...(options.headers || {}) },
    })
    const data = await response.json()
    if (!response.ok) throw new Error(data.error || 'PPTX request failed')
    return data
  }

  async function upload() {
    if (!file || !slug || !workerUrl) return
    setBusy(true)
    setError('')
    try {
      const body = new FormData()
      body.append('file', file)
      body.append('slug', slug)
      const data = await request('/upload', { method: 'POST', body })
      if (!data.url) throw new Error('PPTX upload returned no URL')
      await onSaved(data.url)
      onChange(data.url)
      setFile(null)
      setReplacing(false)
    } catch (cause) {
      setError(cause.message || 'PPTX upload failed')
    } finally {
      setBusy(false)
    }
  }

  async function remove() {
    if (!canDelete || !value || !slug || !workerUrl) return
    if (!window.confirm(`Delete the PPTX for “${title}”?`)) return
    setBusy(true)
    setError('')
    try {
      await request('/delete', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ slug }) })
      await onSaved('')
      onChange('')
      setFile(null)
    } catch (cause) {
      setError(cause.message || 'PPTX deletion failed')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="lvm-song-editor__pptx">
      {value && !replacing ? (
        <div className="lvm-song-editor__tools">
          <a href={value.startsWith('http') ? value : publicUrl(value)} target="_blank" rel="noopener noreferrer">Download PPTX</a>
          {canWrite ? <button type="button" onClick={() => setReplacing(true)} disabled={disabled || busy}>Replace</button> : null}
          {canDelete ? <button type="button" onClick={remove} disabled={disabled || busy || !workerUrl}>Delete</button> : null}
        </div>
      ) : canWrite ? (
        <div className="lvm-song-editor__tools">
          <input type="file" aria-label="PPTX file" accept=".pptx" onChange={selectFile} disabled={disabled || busy || !workerUrl} />
          <button type="button" onClick={upload} disabled={disabled || busy || !file || !workerUrl}>{busy ? 'Uploading…' : 'Upload PPTX'}</button>
          {replacing ? <button type="button" onClick={() => { setReplacing(false); setFile(null); setError('') }}>Cancel replacement</button> : null}
        </div>
      ) : null}
      {!workerUrl && canWrite ? <p>PPTX upload is not configured in this environment.</p> : null}
      {error ? <p role="alert">{error}</p> : null}
    </div>
  )
}
