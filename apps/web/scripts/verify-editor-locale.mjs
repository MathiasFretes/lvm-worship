import assert from 'node:assert/strict'
import { mkdir, writeFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { chromium, expect } from '@playwright/test'

const origin = process.env.LVM_EDITOR_PREVIEW_URL || 'http://127.0.0.1:4173'
assert.ok(['127.0.0.1', 'localhost', 'srv2137598.hstgr.cloud'].includes(new URL(origin).hostname))
const output = new URL('../../../test-results/editor-locale/', import.meta.url)
await mkdir(output, { recursive: true })
const report = { origin, fixtureSession: true, apiWrites: 0, checks: [], errors: [] }
for (let attempt = 0; ; attempt++) {
  try {
    const response = await fetch(origin, { signal: AbortSignal.timeout(2000) })
    if (!response.ok) throw new Error(`Preview returned HTTP ${response.status}`)
    break
  } catch (error) {
    if (attempt >= 39) throw error
    await new Promise(resolve => setTimeout(resolve, 250))
  }
}
const browser = await chromium.launch({ headless: true })
try {
  for (const role of ['editor', 'user']) {
    const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, locale: 'es-ES' })
    await context.addInitScript(() => localStorage.setItem('lvm.uiLanguage', 'es'))
    const page = await context.newPage()
    page.on('pageerror', error => report.errors.push(error.message))
    // Only the served frontend is under test: no credentials or writes reach the API.
    await page.route('**/api/**', async route => {
      if (!['GET', 'HEAD', 'OPTIONS'].includes(route.request().method())) {
        report.apiWrites++
        return route.abort()
      }
      const path = new URL(route.request().url()).pathname
      const json = path.endsWith('/auth/session') ? { session: { user: { id: 'editor-locale-fixture' } } }
        : path.endsWith('/data/users') ? { id: 'editor-locale-fixture', role, display_name: 'QA de idioma' } : []
      await route.fulfill({ json })
    })
    await page.goto(`${origin}/portal/editor`)
    await expect(page.getByRole('heading', { name: 'Nueva canción' })).toBeVisible({ timeout: 30000 })
    await page.getByLabel('Título *', { exact: true }).fill('Ensayo visual de LVM')
    const content = '{start_of_verse: Estrofa de prueba}\n[G]Cantamos juntos [D]con esperanza.\n{end_of_verse}'
    await page.getByLabel('Letra con acordes en ChordPro').fill(content)
    await page.getByRole('button', { name: 'Guía de ChordPro', exact: true }).click()
    await expect(page.getByRole('heading', { name: 'Acordes sobre la letra' })).toBeVisible()
    await page.getByRole('button', { name: 'Cerrar guía' }).click()
    await expect.poll(() => page.locator('.lvm-guide-drawer').evaluate(element => element.getBoundingClientRect().left >= innerWidth - 1)).toBe(true)
    await page.getByRole('button', { name: 'Vista previa', exact: true }).click()
    const preview = page.getByRole('dialog', { name: 'Vista previa de la canción' })
    await expect(preview).toBeVisible()
    const columns = preview.locator('.lvm-preview-modal__chord-col')
    assert.deepEqual(await columns.locator('.lvm-preview-modal__chord').allTextContents(), ['G', 'D'])
    assert.deepEqual(await columns.locator('.lvm-preview-modal__lyric').allTextContents(), ['Cantamos juntos ', 'con esperanza.'])
    await page.evaluate(() => document.fonts.ready)
    await page.screenshot({ path: fileURLToPath(new URL(`${role}-preview.png`, output)), fullPage: true })
    await page.getByRole('button', { name: 'Cerrar vista previa' }).click()
    await expect(page.getByLabel('Letra con acordes en ChordPro')).toHaveValue(content)
    const action = role === 'editor' ? 'Guardar canción' : 'Enviar a revisión'
    await expect(page.getByRole('button', { name: action, exact: true })).toBeVisible()
    for (const theme of ['light', 'dark']) {
      await page.evaluate(value => document.documentElement.setAttribute('data-theme', value), theme)
      for (const width of [1440, 390]) {
        await page.setViewportSize({ width, height: 1000 })
        assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'No horizontal page overflow')
        await expect(page.getByRole('button', { name: action, exact: true })).toBeVisible()
        await page.screenshot({ path: fileURLToPath(new URL(`${role}-${theme}-${width}.png`, output)), fullPage: true })
        report.checks.push(`${role}: Spanish editor, ${theme}, ${width}px`)
      }
    }
    report.checks.push(`${role}: Spanish guide, chord alignment, unchanged ChordPro and role-specific action`)
    await context.close()
  }
  assert.equal(report.apiWrites, 0)
  assert.deepEqual(report.errors, [])
} finally {
  await browser.close()
  await writeFile(new URL('report.json', output), JSON.stringify(report, null, 2) + '\n')
}
console.log(JSON.stringify(report, null, 2))
