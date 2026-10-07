export async function downloadZip(files, opts = {}) {
  const JSZip = (await import('jszip')).default
  const zip = new JSZip()
  const seen = new Set()
  for (const f of files || []) {
    const path = normalizeArchivePath(f?.path)
    if (!path || seen.has(path)) continue
    seen.add(path)
    zip.file(path, f.content)
  }
  const blob = await zip.generateAsync({ type: 'blob' })
  const a = document.createElement('a')
  const objectUrl = URL.createObjectURL(blob)
  a.href = objectUrl
  a.download = opts.name || 'download.zip'
  a.rel = 'noopener'
  a.click()
  setTimeout(() => URL.revokeObjectURL(objectUrl), 0)
}

function normalizeArchivePath(path){
  const segments = String(path || '')
    .replace(/\\/g, '/')
    .split('/')
    .filter((segment) => segment && segment !== '.' && segment !== '..')
  return segments.join('/')
}
