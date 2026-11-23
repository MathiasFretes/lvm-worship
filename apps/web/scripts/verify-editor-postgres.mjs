import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { randomUUID } from 'node:crypto'
import { mkdir, writeFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { chromium, expect } from '@playwright/test'

// Fixed isolated API/database. Never accept a production API/database override.
const api = 'http://127.0.0.1:54320/api'
const origin = 'https://srv2137598.hstgr.cloud'
const frontend = process.env.LVM_EDITOR_FRONTEND_URL || origin
const serviceFrontend = process.env.LVM_REVIEW_FRONTEND_URL
assert.ok(serviceFrontend && ['127.0.0.1', 'localhost'].includes(new URL(serviceFrontend).hostname), 'Start the isolated Service review preview')
assert.ok(['127.0.0.1', 'localhost', 'srv2137598.hstgr.cloud'].includes(new URL(frontend).hostname))
const database = 'lvm_planning_qa_20261121'
const run = randomUUID()
const prefix = `QA Editor ${run}`
const output = new URL('../../../test-results/editor-postgres/', import.meta.url)
await mkdir(output, { recursive: true })
const git = args => execFileSync('git', args, { encoding: 'utf8' }).trim()
assert.equal(git(['status', '--porcelain']), '', 'Commit the exact client under test before running the final gate')
const serviceRepo = fileURLToPath(new URL('../../../../LVM Service/', import.meta.url))
assert.equal(execFileSync('git', ['-C', serviceRepo, 'status', '--porcelain'], { encoding: 'utf8' }).trim(), '', 'Commit the Service UI before the gate')
const serviceFrontendCommit = execFileSync('git', ['-C', serviceRepo, 'rev-parse', 'HEAD'], { encoding: 'utf8' }).trim()
const report = { run, database, frontend, serviceFrontend, serviceFrontendCommit, clientCommit: git(['rev-parse', 'HEAD']), apiCommit: '602a7781eac83a1e612d0ac37a9bfce089f9a05b', checks: [], errors: [], cleaned: false }
const accounts = []
const auditFault = 'qa_editor_fault_' + run.replaceAll('-', '')
let faultInstalled = false
function fault(actor) {
 sql(`CREATE FUNCTION private.${auditFault}() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.actor_id='${actor.id}' THEN RAISE EXCEPTION 'Injected QA audit failure'; END IF; RETURN NEW; END $$; CREATE TRIGGER ${auditFault} BEFORE INSERT ON public.editor_audit_log FOR EACH ROW EXECUTE FUNCTION private.${auditFault}();`)
 faultInstalled = true
}
function clearFault() {
 if (faultInstalled) sql(`DROP TRIGGER IF EXISTS ${auditFault} ON public.editor_audit_log; DROP FUNCTION IF EXISTS private.${auditFault}();`)
 faultInstalled = false
}
const literal = value => `'${String(value).replaceAll("'", "''")}'`
const sql = statement => execFileSync('ssh', ['-o', 'BatchMode=yes', 'hostinger-vps', `cd /srv/apps/la-voz-misionera && docker compose exec -T postgres psql -U lvm_owner -d ${database} -v ON_ERROR_STOP=1 -At`], { input: statement, encoding: 'utf8' }).trim()
assert.equal(sql('SELECT current_database();'), database)
assert.equal((await fetch(`${api}/health`)).status, 200)
report.apiImage = execFileSync('ssh', ['-o', 'BatchMode=yes', 'hostinger-vps', "docker inspect -f '{{.Image}}' lvm-editor-qa-api-602a778"], { encoding: 'utf8' }).trim()
report.schemaSha256 = execFileSync('ssh', ['-o', 'BatchMode=yes', 'hostinger-vps', 'sha256sum /srv/apps/la-voz-misionera/editor-gate-20261123-602a778/source/schema/012_editor_transactions.sql'], { encoding: 'utf8' }).trim().split(' ')[0]
const baseline = () => JSON.parse(sql("SELECT json_build_object('users',(SELECT count(*) FROM public.users),'songs',(SELECT count(*) FROM public.songs),'drafts',(SELECT count(*) FROM public.personal_songs),'operations',(SELECT count(*) FROM private.editor_operations),'existingUsersFingerprint',(SELECT md5(coalesce(json_agg(u ORDER BY id)::text,'')) FROM public.users u),'existingSongsFingerprint',(SELECT md5(coalesce(json_agg(s ORDER BY id)::text,'')) FROM public.songs s));"))
report.before = baseline()
const rows = (table, where) => JSON.parse(sql(`SELECT coalesce(json_agg(t),'[]'::json) FROM (SELECT * FROM public.${table} WHERE ${where}) t;`))
const record = name => { report.checks.push(name); console.log(`PASS ${name}`) }
async function request(actor, path, method = 'GET', body) {
 const response = await fetch(`${api}/${path}`, { method, headers: { Origin: origin, 'Content-Type': 'application/json', Prefer: 'return=representation', ...(actor ? { Cookie: actor.cookie } : {}) }, body: body === undefined ? undefined : JSON.stringify(body) })
 const text = await response.text()
 return { status: response.status, data: text ? JSON.parse(text) : null, cookie: response.headers.get('set-cookie')?.split(';')[0] }
}
async function account(label) {
 const actor = { email: `editor-${label}-${run}@example.invalid`, password: randomUUID() }
 const result = await request(null, 'auth/signup', 'POST', actor)
 assert.equal(result.status, 201)
 Object.assign(actor, { id: result.data.user.id, cookie: result.cookie })
 assert.match(actor.id, /^[a-f0-9-]{36}$/)
 accounts.push(actor)
 return actor
}
const browser = await chromium.launch({ headless: true })
let lastPage
async function ui(actor, login = false, spoofRole = false) {
 const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, locale: 'es-ES' })
 await context.addInitScript(() => localStorage.setItem('lvm.uiLanguage', 'es'))
 let jar = login ? '' : actor.cookie
 let loseAck = ''
 await context.route('**/*', async route => {
  const url = new URL(route.request().url())
  if (!url.pathname.startsWith('/api/')) {
   if (!['GET', 'HEAD', 'OPTIONS'].includes(route.request().method())) return route.abort()
   return route.continue()
  }
  const original = await route.request().allHeaders()
  const headers = { Origin: origin }
  for (const name of ['cookie', 'content-type', 'accept', 'prefer', 'range', 'x-lvm-account', 'x-lvm-operation']) if (original[name]) headers[name] = original[name]
  if (jar) headers.cookie = jar
  const method = route.request().method()
  const response = await fetch(`http://127.0.0.1:54320${url.pathname}${url.search}`, { method, headers, body: ['GET', 'HEAD'].includes(method) ? undefined : route.request().postDataBuffer() })
  if (loseAck && url.pathname.endsWith('/rpc/' + loseAck)) { loseAck = ''; return route.abort('connectionreset') }
  const setCookie = response.headers.get('set-cookie')
  if (setCookie) jar = setCookie.split(';')[0]
  const forwarded = Object.fromEntries(response.headers)
  delete forwarded['content-length']; delete forwarded['content-encoding']
  let buffer = Buffer.from(await response.arrayBuffer())
  if (spoofRole && url.pathname === '/api/data/users' && response.ok) {
    const data = JSON.parse(buffer.toString())
    buffer = Buffer.from(JSON.stringify(Array.isArray(data) ? data.map(row => ({ ...row, role: 'editor' })) : { ...data, role: 'editor' }))
  }
  await route.fulfill({ status: response.status, headers: forwarded, body: buffer })
 })
 if (!login) {
  const [name, ...parts] = actor.cookie.split('=')
  await context.addCookies([{ name, value: parts.join('='), url: origin, secure: true, httpOnly: true, sameSite: 'Lax' }])
 }
 const page = await context.newPage(); lastPage = page
 page.on('pageerror', error => report.errors.push(error.message))
 if (login) {
  await page.goto(`${frontend}/login?redirect=/portal/editor`)
  await page.getByLabel('Correo electrónico', { exact: true }).fill(actor.email)
  await page.getByLabel('Contraseña', { exact: true }).fill(actor.password)
  await page.getByRole('button', { name: 'Iniciar sesión', exact: true }).click()
 } else await page.goto(`${frontend}/portal/editor`)
 await expect(page.getByRole('heading', { name: 'Nueva canción' })).toBeVisible({ timeout: 30000 })
 return { context, page, loseNextAck: (name = 'mutate_editor_song') => { loseAck = name } }
}
async function form(page, title, body) {
 await page.getByLabel('Título *', { exact: true }).fill(title)
 await page.getByRole('combobox', { name: /^Tono/ }).selectOption('G')
 await page.getByLabel('Etiquetas *', { exact: true }).fill('Prueba QA, Adoración')
 await page.getByLabel('Artista / autor', { exact: true }).fill('Equipo de QA — original')
 await page.getByLabel('Tempo (BPM)', { exact: true }).fill('96')
 await page.getByRole('combobox', { name: /^Compás/ }).selectOption('4/4')
 await page.getByLabel('País', { exact: true }).fill('Paraguay')
 await page.getByLabel('Idioma', { exact: true }).fill('es')
 await page.getByLabel('Letra con acordes en ChordPro').fill(body)
}
try {
 const a = await account('a'); const b = await account('b'); const editor = await account('reviewer')
 sql(`UPDATE public.users SET role='editor' WHERE id=${literal(editor.id)};`)
 const user = await ui(a, true)
 record('real UI login against isolated API/PostgreSQL')
 const body = '{start_of_verse: Estrofa}\n[G]Cantamos juntos [D]con esperanza.\n{end_of_verse}'
 const additionTitle = `${prefix} propuesta`
 await form(user.page, additionTitle, body)
 user.loseNextAck()
 await user.page.getByRole('button', { name: 'Enviar a revisión', exact: true }).click()
 await expect(user.page.getByRole('alert')).toBeVisible()
 await user.page.reload()
 await expect(user.page.getByLabel('Letra con acordes en ChordPro')).toHaveValue(body)
 await user.page.getByRole('button', { name: 'Enviar a revisión', exact: true }).click()
 await expect(user.page.getByRole('status')).toHaveText('Propuesta enviada a revisión')
 assert.equal(rows('song_suggestions', `suggested_by=${literal(a.id)} AND type='addition'`).length, 1)
 record('lost submission acknowledgement replays the same operation without duplicate proposals')
 const auditAttempt = await fetch(`${api}/data/editor_audit_log`, { method: 'POST', headers: { Origin: origin, Cookie: a.cookie, 'Content-Type': 'application/json', Prefer: 'return=minimal' }, body: JSON.stringify({ actor_id: a.id, action: 'forged' }) })
 assert.ok(auditAttempt.status >= 400)
 const forgedRole = await request(a, 'data/rpc/mutate_editor_song', 'POST', { p_operation_id: randomUUID(), p_action: 'save_published', p_song_id: null, p_personal_song_id: null, p_payload: { title: 'forged', default_key: 'G', tags: ['QA'] } })
 assert.ok(forgedRole.status >= 400)
 record('ordinary user cannot insert even minimal audit rows or forge a publication action')
 const addition = rows('song_suggestions', `suggested_by=${literal(a.id)} AND type='addition'`)[0]
 assert.equal(addition.payload.chordpro_content, body)
 assert.equal(rows('songs', `title=${literal(additionTitle)}`).length, 0)
 record('ordinary user submits real pending addition without publishing')
 const forbidden = await request(a, 'data/songs', 'POST', { title: `${prefix} forbidden`, slug: `forbidden_${run}` })
 assert.ok(forbidden.status >= 400)
 assert.ok((await request(a, 'data/rpc/review_song_suggestion', 'POST', { p_suggestion_id: addition.id, p_action: 'approve' })).status >= 400)
 const reviewer = await ui(editor)
 const servicePage = await reviewer.context.newPage()
 servicePage.on('pageerror', error => report.errors.push(error.message))
 await servicePage.goto(`${serviceFrontend}/service/song-review`)
 await servicePage.getByRole('button', { name: `Revisar ${additionTitle}`, exact: true }).click()
 await expect(servicePage.getByRole('region', { name: 'Detalle de la propuesta' })).toContainText(body)
 await servicePage.getByRole('button', { name: 'Aprobar propuesta', exact: true }).click()
 fault(editor)
 await servicePage.getByRole('button', { name: 'Confirmar aprobación', exact: true }).click()
 await expect(servicePage.getByRole('alert')).toBeVisible()
 assert.equal(rows('songs', `title=${literal(additionTitle)}`).length, 0)
 clearFault()
 reviewer.loseNextAck('review_song_suggestion')
 await servicePage.getByRole('button', { name: 'Confirmar aprobación', exact: true }).click()
 await expect(servicePage.getByRole('alert')).toBeVisible()
 await servicePage.getByRole('button', { name: 'Confirmar aprobación', exact: true }).click()
 await expect(servicePage.getByRole('status').filter({ hasText: 'Propuesta aprobada y guardada.' })).toBeVisible()
 const publishedSuggestion = rows('song_suggestions', `id=${literal(addition.id)}`)[0]
 const approved = { status: 200, data: { song_id: publishedSuggestion.song_id } }
 record('Service editor finds and approves the new song through the real UI, with audit rollback and lost-acknowledgement replay')
 await servicePage.screenshot({ path: fileURLToPath(new URL('service-review-desktop.png', output)), fullPage: true })
 const approveAgain = await request(editor, 'data/rpc/review_song_suggestion', 'POST', { p_suggestion_id: addition.id, p_action: 'approve' })
 assert.equal(approveAgain.status, 200)
 assert.equal(approveAgain.data.song_id, approved.data.song_id)
 assert.equal(rows('songs', `title=${literal(additionTitle)}`).length, 1)
 record('replayed approval returns the same published song without a duplicate')
 const published = rows('songs', `id=${literal(approved.data.song_id)}`)[0]
 assert.equal(published.chordpro_content, body)
 assert.equal(published.title, additionTitle)
 assert.equal(published.artist, 'Equipo de QA — original')
 assert.equal(published.default_key, 'G')
 assert.deepEqual(published.tags, ['Prueba QA', 'Adoración'])
 assert.equal(published.tempo, 96)
 assert.equal(published.time_signature, '4/4')
 assert.equal(published.language, 'es')
 assert.equal(published.country, 'Paraguay')
 record('PostgreSQL denies ordinary direct publication/review; editor approval preserves ChordPro')
 const impersonated = await ui(a, false, true)
 await form(impersonated.page, `${prefix} rol manipulado`, body)
 await impersonated.page.getByRole('button', { name: 'Guardar canción', exact: true }).click()
 await expect(impersonated.page.getByRole('alert')).toBeVisible()
 await expect(impersonated.page.getByLabel('Letra con acordes en ChordPro')).toHaveValue(body)
 assert.equal(rows('songs', `title=${literal(prefix + ' rol manipulado')}`).length, 0)
 assert.equal(rows('users', `id=${literal(a.id)}`)[0].role, 'user')
 await impersonated.context.close()
 record('a forged editor role in the frontend still cannot publish through the real API/PostgreSQL')
 await form(reviewer.page, `${prefix} directa`, body)
 fault(editor)
 await reviewer.page.getByRole('button', { name: 'Guardar canción', exact: true }).click()
 await expect(reviewer.page.getByRole('alert')).toBeVisible()
 assert.equal(rows('songs', `title=${literal(prefix + ' directa')}`).length, 0)
 await expect(reviewer.page.getByLabel('Letra con acordes en ChordPro')).toHaveValue(body)
 clearFault()
 reviewer.loseNextAck()
 await reviewer.page.getByRole('button', { name: 'Guardar canción', exact: true }).click()
 await expect(reviewer.page.getByRole('alert')).toBeVisible()
 await reviewer.page.reload()
 await expect(reviewer.page.getByLabel('Letra con acordes en ChordPro')).toHaveValue(body)
 await reviewer.page.getByRole('button', { name: 'Guardar canción', exact: true }).click()
 await expect(reviewer.page.getByRole('heading', { name: 'Editar canción' })).toBeVisible()
 assert.equal(rows('songs', `title=${literal(prefix + ' directa')}`).length, 1)
 record('audit SQL failure rolls back publication; lost acknowledgement retries publish once and keep local edits')
 const direct = rows('songs', `title=${literal(prefix + ' directa')}`)[0]
 await reviewer.page.getByRole('button', { name: 'Volver a la biblioteca', exact: true }).click()
 await expect(reviewer.page.getByText(direct.title, { exact: true }).first()).toBeVisible()
 record('saved song appears immediately in the library without reloading')
 await reviewer.page.goto(`${frontend}/portal/editor/${direct.slug}`)
 await reviewer.page.reload()
 await expect(reviewer.page.getByLabel('Letra con acordes en ChordPro')).toHaveValue(body)
 record('editor creates via UI and reloads persisted PostgreSQL content')
 await user.page.goto(`${frontend}/portal/editor/${direct.slug}`)
 await expect(user.page.getByRole('heading', { name: 'Editar canción' })).toBeVisible()
 const editBody = body + '\n[C]Una segunda voz.'
 await user.page.getByLabel('Letra con acordes en ChordPro').fill(editBody)
 await user.page.getByRole('button', { name: 'Enviar a revisión', exact: true }).click()
 await expect(user.page.getByRole('status')).toHaveText('Propuesta enviada a revisión')
 assert.equal(rows('songs', `id=${literal(direct.id)}`)[0].chordpro_content, body)
 await reviewer.page.reload()
 fault(editor)
 const failedReview = reviewer.page.waitForResponse(response => response.url().endsWith('/rpc/review_song_suggestion'))
 await reviewer.page.getByRole('button', { name: 'Aprobar', exact: true }).click()
 assert.ok((await failedReview).status() >= 400)
 assert.equal(rows('songs', `id=${literal(direct.id)}`)[0].chordpro_content, body)
 assert.equal(rows('song_suggestions', `song_id=${literal(direct.id)} AND status='pending'`).length, 1)
 clearFault()
 record('audit failure during approval preserves pending proposal and previous published content')
 reviewer.loseNextAck('review_song_suggestion')
 await reviewer.page.getByRole('button', { name: 'Aprobar', exact: true }).click()
 await expect(reviewer.page.getByRole('button', { name: 'Aprobar', exact: true })).toBeEnabled()
 await reviewer.page.getByRole('button', { name: 'Aprobar', exact: true }).click()
 await expect(reviewer.page.getByText('No hay propuestas para revisar')).toBeVisible()
 assert.equal(rows('songs', `id=${literal(direct.id)}`)[0].chordpro_content, editBody)
 await expect(reviewer.page.getByLabel('Letra con acordes en ChordPro')).toHaveValue(editBody)
 record('user edit remains pending; reviewer UI approval persists exactly')

 await user.page.goto(`${frontend}/portal/editor/${direct.slug}`)
 await expect(user.page.getByRole('heading', { name: 'Editar canción' })).toBeVisible()
 await user.page.getByLabel('Letra con acordes en ChordPro').fill('[Am]Propuesta para rechazar')
 await user.page.getByRole('button', { name: 'Enviar a revisión', exact: true }).click()
 await expect(user.page.getByRole('status')).toHaveText('Propuesta enviada a revisión')
 await reviewer.page.reload()
 await reviewer.page.getByRole('button', { name: 'Rechazar', exact: true }).click()
 await reviewer.page.getByPlaceholder('Motivo del rechazo (opcional)…').fill('Revisar el arreglo')
 await reviewer.page.getByRole('button', { name: 'Confirmar rechazo', exact: true }).click()
 await expect(reviewer.page.getByText('No hay propuestas para revisar')).toBeVisible()
 const rejected = rows('song_suggestions', `song_id=${literal(direct.id)} AND status='rejected'`)[0]
 assert.equal(rejected.rejection_reason, 'Revisar el arreglo')
 assert.equal(rows('songs', `id=${literal(direct.id)}`)[0].chordpro_content, editBody)
 assert.equal((await request(editor, 'data/rpc/review_song_suggestion', 'POST', { p_suggestion_id: rejected.id, p_action: 'reject', p_reason: 'Revisar el arreglo' })).status, 200)
 assert.equal((await request(editor, 'data/rpc/review_song_suggestion', 'POST', { p_suggestion_id: rejected.id, p_action: 'approve' })).status, 409)
 record('reviewer UI rejection preserves published content; repeated decision is idempotent and conflicting decision is 409')
 const draftResult = await request(a, 'data/personal_songs', 'POST', { owner_id: a.id, title: `${prefix} borrador`, default_key: 'G', tags: ['QA'], chordpro_content: body })
 assert.equal(draftResult.status, 201)
 const draft = draftResult.data[0]
 await user.page.goto(`${frontend}/portal/editor?p=${draft.id}`)
 await expect(user.page.getByRole('button', { name: 'Guardar borrador' })).toBeVisible()
 await user.page.getByLabel('Letra con acordes en ChordPro').fill(editBody)
 await user.page.getByRole('button', { name: 'Guardar borrador' }).click()
 await expect(user.page.getByRole('status')).toHaveText('Borrador guardado')
 await user.page.reload()
 await expect(user.page.getByLabel('Letra con acordes en ChordPro')).toHaveValue(editBody)
 assert.deepEqual((await request(b, `data/personal_songs?id=eq.${draft.id}`)).data, [])
 assert.deepEqual((await request(b, `data/personal_songs?id=eq.${draft.id}`, 'PATCH', { title: 'intrusion' })).data, [])
 assert.equal(rows('personal_songs', `id=${literal(draft.id)}`)[0].title, draft.title)
 record('private draft UI save/reload and cross-account read/write isolation')
 fault(a)
 await user.page.getByRole('button', { name: 'Enviar borrador', exact: true }).click()
 await expect(user.page.getByRole('alert')).toBeVisible()
 assert.equal(rows('personal_songs', `id=${literal(draft.id)}`)[0].status, 'draft')
 assert.equal(rows('song_suggestions', `personal_song_id=${literal(draft.id)}`).length, 0)
 clearFault()
 user.loseNextAck()
 await user.page.getByRole('button', { name: 'Enviar borrador', exact: true }).click()
 await expect(user.page.getByRole('alert')).toBeVisible()
 await user.page.getByRole('button', { name: 'Enviar borrador', exact: true }).click()
 await expect(user.page).toHaveURL(/\/songs$/)
 assert.equal(rows('song_suggestions', `personal_song_id=${literal(draft.id)}`).length, 1)
 record('failed draft submission rolls back status/proposal; lost acknowledgement retry creates one proposal')
 let draftSuggestion = rows('song_suggestions', `personal_song_id=${literal(draft.id)} AND status='pending'`)[0]
 assert.equal(rows('personal_songs', `id=${literal(draft.id)}`)[0].status, 'submitted')
 assert.equal((await request(editor, 'data/rpc/review_song_suggestion', 'POST', { p_suggestion_id: draftSuggestion.id, p_action: 'reject', p_reason: 'Preparar segunda versión' })).status, 200)
 assert.equal(rows('personal_songs', `id=${literal(draft.id)}`)[0].status, 'draft')
 await user.page.goto(`${frontend}/portal/editor?p=${draft.id}`)
 await expect(user.page.getByRole('button', { name: 'Enviar borrador', exact: true })).toBeVisible()
 await expect(user.page.getByLabel('Letra con acordes en ChordPro')).toHaveValue(editBody)
 await user.page.getByRole('button', { name: 'Enviar borrador', exact: true }).click()
 await expect(user.page).toHaveURL(/\/songs$/)
 draftSuggestion = rows('song_suggestions', `personal_song_id=${literal(draft.id)} AND status='pending'`)[0]
 assert.equal((await request(editor, 'data/rpc/review_song_suggestion', 'POST', { p_suggestion_id: draftSuggestion.id, p_action: 'approve' })).status, 200)
 const linked = rows('personal_songs', `id=${literal(draft.id)}`)[0]
 assert.equal(linked.status, 'published')
 assert.equal(rows('songs', `id=${literal(linked.published_song_id)}`)[0].chordpro_content, editBody)
 record('draft UI submission and atomic approval link it to published song')
 await servicePage.goto(`${serviceFrontend}/service/song-review`)
 const stale = await request(editor, 'data/rpc/mutate_editor_song', 'POST', { p_operation_id: randomUUID(), p_action: 'save_published', p_song_id: direct.id, p_personal_song_id: null, p_payload: { title: direct.title, default_key: 'G', tags: ['QA'], chordpro_content: 'stale overwrite' }, p_expected_updated_at: direct.updated_at })
 assert.equal(stale.status, 409)
 assert.equal(rows('songs', `id=${literal(direct.id)}`)[0].chordpro_content, editBody)
 const command = { p_operation_id: randomUUID(), p_action: 'suggest', p_song_id: null, p_personal_song_id: null, p_payload: { title: `${prefix} concurrente`, default_key: 'G', tags: ['QA'], chordpro_content: '[G]Prueba concurrente' } }
 const concurrent = await Promise.all([request(a, 'data/rpc/mutate_editor_song', 'POST', command), request(a, 'data/rpc/mutate_editor_song', 'POST', command)])
 assert.deepEqual(concurrent.map(result => result.status), [200, 200])
 assert.equal(concurrent[0].data.suggestionId, concurrent[1].data.suggestionId)
 assert.equal(rows('song_suggestions', `suggested_by=${literal(a.id)} AND payload->>'title'=${literal(prefix + ' concurrente')}`).length, 1)
 const changedCommand = { ...command, p_payload: { ...command.p_payload, title: 'different payload' } }
 assert.equal((await request(a, 'data/rpc/mutate_editor_song', 'POST', changedCommand)).status, 409)
 record('concurrent identical operations create one proposal; reused IDs and stale song revisions return 409 without overwrites')
 await servicePage.reload()
 await servicePage.setViewportSize({ width: 390, height: 844 })
 await servicePage.getByRole('button', { name: `Revisar ${prefix} concurrente`, exact: true }).click()
 await expect(servicePage.getByRole('region', { name: 'Detalle de la propuesta' })).toBeFocused()
 assert.ok(await servicePage.evaluate(() => document.documentElement.scrollWidth <= innerWidth))
 await servicePage.screenshot({ path: fileURLToPath(new URL('service-review-mobile.png', output)), fullPage: true })
 record('Service review works at 390px, focuses the selected detail and has no horizontal overflow')
 sql(`UPDATE public.users SET role='user' WHERE id=${literal(editor.id)};`)
 const revoked = await request(editor, `data/songs?id=eq.${direct.id}`, 'PATCH', { title: 'revoked write' })
 assert.ok(revoked.status >= 400 || Array.isArray(revoked.data) && revoked.data.length === 0)
 assert.equal(rows('songs', `id=${literal(direct.id)}`)[0].title, direct.title)
 assert.ok((await request(editor, 'data/rpc/mutate_editor_song', 'POST', { p_operation_id: randomUUID(), p_action: 'save_published', p_song_id: direct.id, p_personal_song_id: null, p_payload: { title: 'revoked', default_key: 'G', tags: ['QA'] } })).status >= 400)
 record('role revocation rejects subsequent writes with the existing session')
 assert.deepEqual(report.errors, [])
 await reviewer.page.screenshot({ path: fileURLToPath(new URL('reviewer.png', output)), fullPage: true })
} catch (error) {
 report.failure = error.message
 if (lastPage && !lastPage.isClosed()) await lastPage.screenshot({ path: fileURLToPath(new URL('failure.png', output)), fullPage: true }).catch(() => {})
 throw error
} finally {
 await browser.close()
 clearFault()
 if (accounts.length) {
  const ids = accounts.map(actor => literal(actor.id)).join(',')
  sql(`BEGIN; DELETE FROM public.editor_audit_log WHERE actor_id IN (${ids}); DELETE FROM public.song_suggestions WHERE suggested_by IN (${ids}); DELETE FROM public.personal_songs WHERE owner_id IN (${ids}); DELETE FROM public.songs WHERE title LIKE ${literal(prefix + '%')}; DELETE FROM public.users WHERE id IN (${ids}); COMMIT;`)
  assert.equal(sql(`SELECT count(*) FROM public.users WHERE id IN (${ids});`), '0')
  assert.equal(sql(`SELECT count(*) FROM public.songs WHERE title LIKE ${literal(prefix + '%')};`), '0')
 }
 report.after = baseline()
 assert.deepEqual(report.after, report.before)
 report.cleaned = true
 await writeFile(new URL('report.json', output), JSON.stringify(report, null, 2) + '\n')
}
console.log(JSON.stringify(report, null, 2))
