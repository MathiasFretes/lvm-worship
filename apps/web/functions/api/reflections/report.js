// POST /api/reflections/report
//   Body: { reflection_id: uuid, reason?: string }
//   Headers: Authorization: Bearer <supabase access token>
//
// Records a report (service role). The report row is the source of truth and
// is readable in the dashboard.
//
// The reflections `reports` table also has an insert-own RLS policy, but a
// report is only recorded when it goes through THIS endpoint — 2B's report
// button calls it. No client UI ships in this phase (2A).

import {
  corsPreflight,
  json,
  jsonError,
  supabaseRest,
  UUID_RE,
  verifySupabaseJwt,
} from './_shared.js'

export async function onRequest(context) {
  const { request, env } = context

  if (request.method === 'OPTIONS') return corsPreflight(request)
  if (request.method !== 'POST') return jsonError('Method not allowed', 405)

  if (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) {
    return jsonError('Server not configured', 503)
  }

  const auth = await verifySupabaseJwt(request, env)
  if (auth.error) return jsonError(auth.error, auth.status)

  let payload
  try {
    payload = await request.json()
  } catch {
    return jsonError('Invalid JSON', 400)
  }

  const reflectionId = typeof payload?.reflection_id === 'string' ? payload.reflection_id : ''
  if (!UUID_RE.test(reflectionId)) return jsonError('reflection_id (uuid) required', 400)
  const reason =
    typeof payload?.reason === 'string' ? payload.reason.slice(0, 500).trim() || null : null

  // Kill switch, matching submit.js. Reporting only makes sense for public
  // reflections, and there are none: 20260805000000 turned the
  // public_reflections flag off and dropped the public_feed_read policy, and PR
  // 469 removed every client surface that could have shown a report button.
  //
  // Without this gate the endpoint stayed open to any signed-in account, and
  // because it never verifies that reflection_id refers to a real (or public)
  // row, an arbitrary UUID would still insert a `reports` row via the service
  // role. That is a spam vector, reachable by anyone who can sign up.
  // Cloudflare Pages routes by file, so this endpoint answers whether or not a
  // client calls it.
  const flagResp = await supabaseRest(
    env,
    'feature_flags?select=enabled&key=eq.public_reflections&limit=1',
  )
  if (!flagResp.ok) return jsonError(`Flag check failed: ${flagResp.status}`, 502)
  const flagRows = await flagResp.json().catch(() => [])
  if (!flagRows?.[0]?.enabled) return jsonError('public_reflections_disabled', 403)

  // Record the report (service role).
  const insertResp = await supabaseRest(env, 'reports', {
    method: 'POST',
    headers: { Prefer: 'return=representation' },
    body: JSON.stringify({
      reflection_id: reflectionId,
      reporter_id: auth.userId,
      reason,
    }),
  })
  if (!insertResp.ok) {
    const text = await insertResp.text().catch(() => '')
    return jsonError(`Report insert failed: ${insertResp.status} ${text}`.trim(), 502)
  }

  return json({ status: 'reported' }, { status: 202 })
}
