import { execFileSync } from 'node:child_process'
import { pathToFileURL } from 'node:url'

export async function checkWorshipRelease({ url, candidate = 'HEAD', cwd = process.cwd(), fetchImpl = fetch }) {
  const response = await fetchImpl(new URL('/deployment.json', url), { cache: 'no-store', signal: AbortSignal.timeout(15000) })
  if (!response.ok) throw new Error(`Deployment manifest returned HTTP ${response.status}`)
  const manifest = await response.json()
  if (manifest.component !== 'worship-web' || !/^[a-f0-9]{40}$/.test(manifest.commit || '')) {
    throw new Error('Invalid Worship deployment manifest; reconcile it before publishing')
  }
  const git = args => execFileSync('git', args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim()
  const deployed = git(['rev-parse', '--verify', '--end-of-options', `${manifest.commit}^{commit}`])
  const target = git(['rev-parse', '--verify', '--end-of-options', `${candidate}^{commit}`])
  try {
    git(['merge-base', '--is-ancestor', deployed, target])
  } catch (error) {
    if (error.status === 1) throw new Error(`Refusing regression: ${target} does not include deployed Worship ${deployed}`)
    throw error
  }
  return { deployed, candidate: target }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  checkWorshipRelease({ url: process.argv[2] || 'https://srv2137598.hstgr.cloud', candidate: process.argv[3] || 'HEAD' })
    .then(result => console.log(JSON.stringify(result)))
    .catch(error => { console.error(error.message); process.exitCode = 1 })
}
