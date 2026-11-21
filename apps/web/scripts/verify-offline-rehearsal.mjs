import { chromium } from '@playwright/test'
import assert from 'node:assert/strict'
import { mkdir } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'

// Run against a production build served locally. All API responses are fixtures;
// the real service worker, assets, IndexedDB and offline navigation are exercised.
const origin = process.env.LVM_VERIFY_ORIGIN || 'http://127.0.0.1:5192'
assert.ok(['127.0.0.1', 'localhost'].includes(new URL(origin).hostname), 'Use a local production preview')
const output = process.env.LVM_VERIFY_OUTPUT || path.join(tmpdir(), 'lvm-offline-qa')
await mkdir(output, { recursive: true })
const browser = await chromium.launch({ headless: true })
const errors = []
let page
try {
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } })
  let offline = false
  let user = { id: 'offline-qa-owner', email: 'offline@example.com', role: 'user' }
  const song = {
    id: 'song-qa', slug: 'cantamos', title: 'Cantamos juntos', artist: 'LVM', default_key: 'D',
    tempo: 72, time_signature: '4/4', tags: [], is_deleted: false,
    chordpro_content: '{title: Cantamos juntos}\n{key: D}\n{start_of_verse}\n[D]Cantamos en comunidad\n{end_of_verse}',
  }
  const privateSong = {
    ...song, id: 'private-qa', slug: null, title: 'Cancion privada',
    chordpro_content: '{title: Cancion privada}\n{key: G}\n{start_of_verse}\n[G]Letra privada para ensayo\n{end_of_verse}',
  }
  const entries = [
    { id: 'row1', song_id: song.id, position: 0, key_override: 'E', notes: 'Entrada suave', songs: song },
    { id: 'row2', verse_ref: 'v:esv|John 3:16', position: 1, notes: 'Leer despacio' },
    { id: 'row3', song_id: song.id, position: 2, key_override: 'G', notes: 'Repetir con fuerza', songs: song },
    { id: 'row4', personal_song_id: privateSong.id, position: 3, key_override: 'G', notes: 'Solo equipo', personal_songs: privateSong },
  ]
  const metadata = { id: 'set-qa', name: 'Ensayo Domingo', service_date: null, updated_at: '2026-11-20T12:00:00Z', setlist_songs: entries }
  await context.route('**/api/**', async route => {
    if (offline) return route.abort('internetdisconnected')
    const url = new URL(route.request().url())
    let data = []
    if (url.pathname === '/api/auth/session') data = { session: user ? { user } : null }
    else if (url.pathname === '/api/data/users') data = user
    else if (url.pathname === '/api/data/songs') data = [song]
    else if (url.pathname === '/api/data/personal_songs') data = [privateSong]
    else if (url.pathname === '/api/data/setlists') data = url.searchParams.has('id') ? [metadata] : [{ ...metadata, setlist_songs: [{ count: 4 }] }]
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(data) })
  })
  await context.route('**/bible/**', route => route.fulfill({
    status: 200, contentType: 'application/json', body: JSON.stringify({ verses: { 16: 'Porque de tal manera amo Dios al mundo' } }),
  }))
  page = await context.newPage()
  page.on('pageerror', error => errors.push(error.message))
  await page.addInitScript(() => localStorage.setItem('lvm.uiLanguage', 'es'))
  await page.goto(`${origin}/setlists/set-qa`, { waitUntil: 'networkidle' })
  await page.getByRole('button', { name: 'Guardar ensayo', exact: true }).click()
  await page.getByText('Ensayo guardado en este dispositivo.', { exact: true }).waitFor({ timeout: 30000 })
  const saved = page.getByRole('region', { name: 'Guardado en este dispositivo' })
  await saved.getByRole('link', { name: /Ensayo Domingo/ }).waitFor()
  await page.screenshot({ path: path.join(output, 'downloads-desktop.png'), fullPage: true })
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true)
  await saved.getByRole('link', { name: /Ensayo Domingo/ }).click()
  await page.getByRole('heading', { name: 'Cantamos juntos', exact: true }).waitFor()
  assert.match(await page.getByText('Key:', { exact: false }).first().innerText(), /E/)
  await page.getByText('Entrada suave', { exact: true }).waitFor()
  offline = true
  await context.setOffline(true)
  await page.reload({ waitUntil: 'domcontentloaded' })
  await page.getByRole('heading', { name: 'Cantamos juntos', exact: true }).waitFor({ timeout: 15000 })
  await page.getByText('Cantamos en comunidad', { exact: true }).waitFor()
  await page.getByRole('button', { name: 'NEXT song', exact: true }).click()
  await page.getByText('Porque de tal manera amo Dios al mundo', { exact: true }).waitFor()
  await page.getByRole('button', { name: 'NEXT song', exact: true }).click()
  await page.getByText('Repetir con fuerza', { exact: true }).waitFor()
  assert.match(await page.getByText('Key:', { exact: false }).first().innerText(), /G/)
  await page.getByRole('button', { name: 'NEXT song', exact: true }).click()
  await page.getByRole('heading', { name: 'Cancion privada', exact: true }).waitFor()
  await page.getByText('Letra privada para ensayo', { exact: true }).waitFor()
  await page.setViewportSize({ width: 390, height: 844 })
  await page.screenshot({ path: path.join(output, 'rehearsal-mobile.png'), fullPage: true })
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true)
  const cacheKeys = await page.evaluate(async () => {
    const urls = []
    for (const name of await caches.keys()) for (const request of await (await caches.open(name)).keys()) urls.push(request.url)
    return urls
  })
  assert.equal(cacheKeys.some(url => new URL(url).pathname.startsWith('/api/')), false)
  offline = false
  user = { id: 'another-account', email: 'another@example.com', role: 'user' }
  await context.setOffline(false)
  await page.reload({ waitUntil: 'networkidle' })
  await page.getByRole('alert').filter({ hasText: 'No pudimos abrir el ensayo guardado.' }).waitFor()
  assert.equal(await page.getByText('Letra privada para ensayo', { exact: true }).count(), 0)
  assert.equal(await page.evaluate(() => localStorage.getItem('lvm.offline-access.v1')), null)
  assert.deepEqual(errors, [])
  console.log('PASS: production download UI; charts, reading, notes, repeated keys and private song after offline reload; mobile layout; no cached API; account switching revokes access.')
} catch (error) {
  await page?.screenshot({ path: path.join(output, 'failure.png'), fullPage: true }).catch(() => {})
  console.error('Browser errors:', errors)
  throw error
} finally { await browser.close() }
