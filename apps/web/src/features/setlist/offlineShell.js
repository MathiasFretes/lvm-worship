export async function prepareOfflineShell() {
  if (!import.meta.env.PROD) return
  if (!('serviceWorker' in navigator)) throw new Error('Offline rehearsal is unavailable in this browser')
  let readyTimeout
  try {
    await Promise.race([
      navigator.serviceWorker.ready,
      new Promise((_, reject) => { readyTimeout = setTimeout(() => reject(new Error('Offline worker unavailable')), 15000) }),
    ])
  } finally { clearTimeout(readyTimeout) }
  if (!navigator.serviceWorker.controller) {
    await new Promise((resolve, reject) => {
      const changed = () => { clearTimeout(timeout); resolve() }
      const timeout = setTimeout(() => {
        navigator.serviceWorker.removeEventListener('controllerchange', changed)
        reject(new Error('Reload to enable offline rehearsal'))
      }, 10000)
      navigator.serviceWorker.addEventListener('controllerchange', changed, { once: true })
    })
  }
  const assets = [...new Set(performance.getEntriesByType('resource').map(entry => entry.name)
    .filter(value => { const url = new URL(value); return url.origin === location.origin && url.pathname.startsWith('/assets/') }))]
  await new Promise((resolve, reject) => {
    const channel = new MessageChannel()
    const timeout = setTimeout(() => { channel.port1.close(); reject(new Error('Offline preparation timed out')) }, 60000)
    channel.port1.onmessage = ({ data }) => {
      clearTimeout(timeout)
      channel.port1.close()
      if (data?.ok) resolve()
      else reject(new Error('Could not prepare the offline screen'))
    }
    navigator.serviceWorker.controller.postMessage({ type: 'PREPARE_REHEARSAL_SHELL', assets }, [channel.port2])
  })
}
