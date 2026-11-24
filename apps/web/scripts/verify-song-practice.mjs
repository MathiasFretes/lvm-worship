import assert from 'node:assert/strict'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { chromium, expect } from '@playwright/test'

const origin = process.env.LVM_PRACTICE_PREVIEW_URL || 'http://127.0.0.1:5173'
assert.ok(['127.0.0.1', 'localhost'].includes(new URL(origin).hostname), 'Use an isolated local preview')
const directory = fileURLToPath(new URL('../../../test-results/song-practice/', import.meta.url))
await mkdir(directory, { recursive: true })
const response = await fetch(`${origin}/api/data/songs?select=id,slug,title,chordpro_content`)
assert.ok(response.ok)
const rows = await response.json()
const fixture = rows.find(row => /QA/.test(row.title))
assert.ok(fixture, 'The isolated preview must contain a QA song; never create production fixtures')
const report = { origin, fixture: fixture.slug, checks: [], errors: [], complete: false }
const record = name => { report.checks.push(name); console.log(`PASS: ${name}`) }
const browser = await chromium.launch({ headless: true, args: ['--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream'] })
try {
  const context = await browser.newContext({ viewport: { width: 1897, height: 1000 }, locale: 'es-ES' })
  await context.addInitScript(() => {
    localStorage.setItem('lvm.uiLanguage', 'es')
    window.practiceAudioContexts = []
    window.practiceOscillators = []
    window.practiceStreams = []
    const getUserMedia = navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices)
    navigator.mediaDevices.getUserMedia = async options => { const stream = await getUserMedia(options); window.practiceStreams.push(stream); return stream }
    const Audio = window.AudioContext
    window.AudioContext = class extends Audio {
      constructor(...args) { super(...args); window.practiceAudioContexts.push(this) }
      createOscillator() { const oscillator = super.createOscillator(); window.practiceOscillators.push(oscillator); return oscillator }
    }
    Object.defineProperty(navigator, 'share', { configurable: true, value: undefined })
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: async value => { window.practiceSharedUrl = value } } })
  })
  const page = await context.newPage()
  page.on('pageerror', error => report.errors.push(error.message))
  // A long, original fixture exercises wrapping/scroll/tabs without changing SQL.
  await page.route('**/api/data/songs?**', async route => {
    const result = await route.fetch()
    const data = await result.json()
    if (!Array.isArray(data)) return route.fulfill({ response: result })
    await route.fulfill({ response: result, json: data.map(row => row.id !== fixture.id ? row : {
      ...row,
      chordpro_content: `{title:${fixture.title}}\n{key:D}\n{start_of_verse}\n[D]Luz del alba [A]sobre el hogar.\ne|--0--2--3--|\nB|--3--3--3--|\nRasgueo: D DU UDU\n${Array.from({ length: 45 }, (_, index) => `[D]Ensayo ${index + 1}: [G]cantamos en [A]unidad.`).join('\n')}\n{end_of_verse}`,
    }) })
  })
  await page.goto(`${origin}/song/${fixture.slug}`)
  await page.getByRole('heading', { name: fixture.title, exact: true }).waitFor()
  await page.evaluate(() => document.fonts.ready)
  await page.waitForFunction(() => getComputedStyle(document.body).backgroundColor === 'rgb(23, 32, 51)')
  const css = await page.locator('.song-practice__main .lyrics').first().evaluate(element => {
    const style = getComputedStyle(element)
    return { font: style.fontFamily, size: style.fontSize, lineHeight: style.lineHeight, color: style.color }
  })
  assert.equal(css.size, '14px')
  assert.equal(css.lineHeight, '22.4px')
  assert.equal(css.color, 'rgb(232, 236, 240)')
  assert.match(css.font, /LVM Practice Mono/)
  assert.equal(await page.locator('.chord-layer').first().evaluate(element => getComputedStyle(element).color), 'rgb(198, 161, 91)')
  report.css = css
  record('LVM navy/gold palette, local Roboto Mono, font size and line height')

  const tool = name => page.locator('.song-practice__tool').filter({ has: page.locator('summary').filter({ hasText: name }) })
  const open = async name => { const element = tool(name); if (!(await element.evaluate(node => node.open))) await element.locator('summary').click(); return element }
  const sounding = page.locator('.song-practice__sounding')
  await page.getByRole('button', { name: 'Tocar acorde D', exact: true }).first().click()
  await expect.poll(() => page.evaluate(() => window.practiceOscillators.length)).toBeGreaterThan(0)
  const original = await page.evaluate(() => window.practiceOscillators.map(node => node.frequency.value))
  assert.equal(await page.evaluate(() => window.practiceAudioContexts[0].state), 'running')
  record('user-triggered Web Audio chord playback')

  await (await open(/^Capo/)).getByRole('combobox').selectOption('2')
  await expect(sounding).toContainText('Tono real: E')
  await (await open(/^Afinación/)).getByRole('combobox').selectOption('-1')
  await expect(sounding).toContainText('Tono real: D#')
  await page.getByRole('button', { name: 'Tocar acorde D', exact: true }).first().click()
  const shifted = await page.evaluate(count => window.practiceOscillators.slice(count).map(node => node.frequency.value), original.length)
  assert.equal(shifted.length, original.length)
  shifted.forEach((frequency, index) => assert.ok(Math.abs(frequency / original[index] - 2 ** (1 / 12)) < 0.00001))
  record('capo/tuning preserve chord shapes and change actual audio pitch')

  await page.getByRole('button', { name: 'Restablecer ajustes', exact: true }).click()
  await open(/^Tono/)
  await page.getByRole('button', { name: 'Subir un semitono', exact: true }).click()
  await expect(sounding).toContainText('forma de D#')
  await expect(page.getByRole('button', { name: 'Tocar acorde D#', exact: true }).first()).toBeVisible()
  record('transposition updates both lyrics and diagrams')
  await page.getByRole('button', { name: 'Restablecer ajustes', exact: true }).click()

  await (await open(/^Cifrado/)).getByRole('combobox').selectOption('solfege')
  await expect(page.getByRole('button', { name: 'Tocar acorde Re', exact: true }).first()).toBeVisible()
  await expect(page.locator('.chord-layer').first()).toContainText('Re')
  await (await open(/^Texto/)).getByRole('slider').fill('140')
  await expect.poll(() => page.locator('.lyrics').first().evaluate(element => parseFloat(getComputedStyle(element).fontSize))).toBeCloseTo(19.6, 1)
  record('solfege and text scaling apply to musical content')
  await page.reload()
  await page.getByRole('heading', { name: fixture.title }).waitFor()
  await expect.poll(() => page.locator('.lyrics').first().evaluate(element => parseFloat(getComputedStyle(element).fontSize))).toBeCloseTo(19.6, 1)
  record('reading preferences survive reload')

  await page.getByRole('button', { name: 'Restablecer ajustes', exact: true }).click()
  const columns = await open(/^Dividir/)
  await columns.getByRole('button', { name: 'Dos columnas', exact: true }).click()
  assert.equal(await page.locator('.songpage__sheet').evaluate(element => getComputedStyle(element).columnCount), '2')
  await columns.getByRole('slider', { name: 'Altura de columnas', exact: true }).fill('60')
  await expect(page.getByRole('button', { name: 'Columnas siguientes', exact: true })).toBeEnabled()
  await page.getByRole('button', { name: 'Columnas siguientes', exact: true }).click()
  await expect.poll(() => page.locator('.songpage__sheet').evaluate(element => element.scrollLeft)).toBeGreaterThan(0)
  await page.getByRole('button', { name: 'Columnas anteriores', exact: true }).click()
  await expect.poll(() => page.locator('.songpage__sheet').evaluate(element => element.scrollLeft)).toBe(0)
  await columns.getByRole('button', { name: 'Pantalla completa', exact: true }).click()
  await expect.poll(() => page.evaluate(() => document.fullscreenElement?.className)).toBe('lvm-song-practice')
  await columns.getByRole('button', { name: 'Salir de pantalla completa', exact: true }).click()
  await expect.poll(() => page.evaluate(() => document.fullscreenElement)).toBeNull()
  record('column dimensions, real horizontal pagination and full-screen enter/exit')
  const tabs = await open(/^Tablaturas/)
  await expect(page.getByText('e|--0--2--3--|', { exact: true })).toBeVisible()
  await tabs.getByRole('checkbox').uncheck()
  await expect(page.getByText('e|--0--2--3--|', { exact: true })).toHaveCount(0)
  const strumming = await open(/^Rasgueos/)
  await strumming.getByRole('checkbox').uncheck()
  await expect(page.getByText('Rasgueo: D DU UDU', { exact: true })).toHaveCount(0)
  record('columns, embedded tablature and written strumming controls')

  await (await open(/^Diagramas/)).getByRole('combobox').selectOption('keyboard')
  await expect(page.locator('.song-practice__diagram--keyboard').first()).toBeVisible()
  record('instrument selection renders keyboard voicings')

  await page.getByRole('button', { name: 'Restablecer ajustes', exact: true }).click()
  const diagramTools = await open(/^Diagramas/)
  const diagramWidth = await page.locator('.song-practice__chord').first().evaluate(element => element.getBoundingClientRect().width)
  await diagramTools.getByRole('slider').fill('120')
  await expect.poll(() => page.locator('.song-practice__chord').first().evaluate(element => element.getBoundingClientRect().width)).toBeGreaterThan(diagramWidth)
  await diagramTools.getByRole('checkbox', { name: 'Diagramas en la letra', exact: true }).check()
  const inlineChord = page.locator('.chord-layer button').first()
  await inlineChord.click()
  await expect(page.getByRole('dialog', { name: 'Diagramas', exact: true })).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(inlineChord).toBeFocused()
  await diagramTools.getByRole('checkbox', { name: 'Fijar diagramas arriba', exact: true }).check()
  await page.evaluate(() => window.scrollTo(0, 800))
  await expect.poll(() => page.locator('.song-practice__diagrams-top').evaluate(element => Math.round(element.getBoundingClientRect().top))).toBe(64)
  await page.evaluate(() => window.scrollTo(0, 0))
  record('diagram resizing, inline positions with focus recovery and pinned scrolling')

  await page.getByRole('button', { name: 'Restablecer ajustes', exact: true }).click()
  await (await open(/^Desplazar/)).getByRole('button', { name: 'Iniciar desplazamiento', exact: true }).click()
  const before = await page.evaluate(() => window.scrollY)
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(before + 10)
  await page.locator('.song-practice__scroll-player').getByRole('button', { name: 'Pausar desplazamiento', exact: true }).click()
  const stopped = await page.evaluate(() => window.scrollY)
  await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))))
  assert.equal(await page.evaluate(() => window.scrollY), stopped)
  record('auto-scroll advances and stops on explicit pause')

  await page.getByRole('button', { name: 'Compartir canción', exact: true }).click()
  const shared = await page.evaluate(() => window.practiceSharedUrl)
  assert.equal(new URL(shared).searchParams.get('key'), 'D')
  await page.getByRole('button', { name: 'Descargar', exact: true }).click()
  await expect(page.getByRole('dialog', { name: 'Descargar', exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: 'PDF', exact: true })).toBeVisible()
  const pdfEvent = page.waitForEvent('download')
  await page.getByRole('button', { name: 'PDF', exact: true }).click()
  const pdf = await pdfEvent
  await pdf.saveAs(`${directory}/practice.pdf`)
  assert.equal((await readFile(`${directory}/practice.pdf`)).subarray(0, 5).toString(), '%PDF-')
  await page.getByRole('button', { name: 'Descargar', exact: true }).click()
  const sourceEvent = page.waitForEvent('download')
  await page.getByRole('button', { name: 'ChordPro', exact: true }).click()
  await (await sourceEvent).saveAs(`${directory}/practice.pro`)
  assert.match(await readFile(`${directory}/practice.pro`, 'utf8'), /Luz del alba/)
  record('share includes musical context and downloads retain existing exports')

  await page.evaluate(() => window.scrollTo(0, 0))
  await page.screenshot({ path: `${directory}/desktop.png`, fullPage: true })
  await page.setViewportSize({ width: 390, height: 844 })
  assert.equal(await page.locator('.songpage__sheet').evaluate(element => getComputedStyle(element).columnCount), '1')
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false)
  await page.getByRole('button', { name: 'Herramientas de la canción', exact: true }).click()
  await expect(page.getByRole('dialog', { name: 'Herramientas de la canción', exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Cerrar herramientas', exact: true }).last()).toBeFocused()
  await page.screenshot({ path: `${directory}/mobile-tools.png` })
  await page.keyboard.press('Escape')
  await expect(page.getByRole('button', { name: 'Herramientas de la canción', exact: true })).toBeFocused()
  await page.screenshot({ path: `${directory}/mobile.png`, fullPage: true })
  record('mobile single column, no horizontal overflow, modal focus and Escape recovery')

  await page.emulateMedia({ media: 'print' })
  await expect(page.locator('.song-practice__aside')).toBeHidden()
  assert.equal(await page.locator('.lyrics').first().evaluate(element => getComputedStyle(element).color), 'rgb(23, 23, 23)')
  record('print hides tools and uses readable dark ink')

  await page.emulateMedia({ media: 'screen' })
  await page.setViewportSize({ width: 1897, height: 1000 })
  await page.unroute('**/api/data/songs?**')
  await page.goto(`${origin}/song/${fixture.slug}`)
  await page.getByRole('heading', { name: fixture.title }).waitFor()
  await page.getByRole('button', { name: 'Descargar', exact: true }).click()
  const jpgEvent = page.waitForEvent('download')
  await page.getByRole('button', { name: 'JPG', exact: true }).click()
  await (await jpgEvent).saveAs(`${directory}/practice.jpg`)
  assert.equal((await readFile(`${directory}/practice.jpg`)).readUInt16BE(0), 0xffd8)
  record('short-song JPG export produces a real image')

  await page.getByRole('searchbox', { name: 'Buscar canciones', exact: true }).fill('Alba')
  await page.getByRole('searchbox', { name: 'Buscar canciones', exact: true }).press('Enter')
  await expect(page).toHaveURL(/\/songs\?q=Alba$/)
  await expect(page.locator('#search')).toHaveValue('Alba')
  assert.equal(await page.evaluate(() => document.body.classList.contains('lvm-song-practice-active')), false)
  record('header search reaches the real catalog and leaving the reader restores the surrounding theme')

  await page.goto(`${origin}/practice`)
  await page.getByRole('button', { name: 'Iniciar', exact: true }).click()
  await expect(page.getByRole('status').filter({ hasText: 'Metrónomo en marcha' })).toBeVisible()
  await page.getByRole('button', { name: 'Detener', exact: true }).click()
  await expect(page.getByRole('status').filter({ hasText: 'Metrónomo detenido' })).toBeVisible()
  await page.getByRole('button', { name: 'Activar micrófono', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Apagar micrófono', exact: true })).toBeVisible()
  await expect.poll(() => page.evaluate(() => window.practiceStreams.length)).toBe(1)
  await page.getByRole('button', { name: 'Apagar micrófono', exact: true }).click()
  assert.equal(await page.evaluate(() => window.practiceStreams[0].getTracks().every(track => track.readyState === 'ended')), true)
  report.microphoneSource = 'Chromium synthetic media device; no real microphone captured'
  record('metronome starts/stops and tuner releases its synthetic microphone tracks')
  assert.deepEqual(report.errors, [])
  report.complete = true
} finally {
  await writeFile(`${directory}/report.json`, JSON.stringify(report, null, 2) + '\n')
  await browser.close()
}
