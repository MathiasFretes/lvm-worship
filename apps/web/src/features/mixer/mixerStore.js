let pending = Promise.resolve()

function openStore() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('lvm-worship-mixer', 1)
    request.onupgradeneeded = () => request.result.createObjectStore('projects')
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}

async function transaction(mode, operation) {
  const db = await openStore()
  try {
    return await new Promise((resolve, reject) => {
      const tx = db.transaction('projects', mode)
      const request = operation(tx.objectStore('projects'))
      tx.oncomplete = () => resolve(request.result)
      tx.onabort = () => reject(tx.error ?? request.error ?? new Error('Mixer storage aborted'))
    })
  } finally {
    db.close()
  }
}

export async function readMixerProject() {
  await pending
  return transaction('readonly', store => store.get('draft'))
}

export function writeMixerProject(project) {
  const write = pending.then(() => transaction('readwrite', store => project.files.length ? store.put(project, 'draft') : store.delete('draft')))
  pending = write.catch(() => undefined)
  return write
}
