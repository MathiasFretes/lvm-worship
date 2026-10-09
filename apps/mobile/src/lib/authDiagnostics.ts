// A small, in-memory record of the last few NATIVE sign-in failures, so that
// whoever is holding the device can read back the provider's own error code
// instead of only the friendly copy.
//
// Why this exists: QA report Nº 7327 reported Google sign-in failing with the
// mapped string "Google sign-in isn't set up correctly for this app." The
// underlying Android DEVELOPER_ERROR (status code 10) — which names the cause
// exactly, a package + signing-SHA-1 pair not registered against an Android
// OAuth client — was discarded by the mapper and never reached anyone who
// could act on it. A tester could report the sentence but not the number.
//
// Deliberately NOT telemetry. Nothing leaves the device, nothing is written to
// disk, and the buffer is dropped when the app is killed. This app has no
// analytics sink BY DESIGN (see reviewService.ts) and this does not add one.
//
// Scope: the native Google/Apple id-token flows only. The email/password and
// change-password paths are excluded on purpose — ChangePasswordScreen.tsx
// forbids logging anything at all from that flow.

/** The parts of a provider error worth keeping: never the credential, never the user. */
export type AuthErrorInfo = {
  /** Provider error code as a string — Android status codes arrive as "10", "12501", … */
  code: string | null
  /** HTTP-ish status when the provider supplies one; native SDK errors rarely do. */
  status: number | null
  message: string
}

export type AuthDiagnostic = AuthErrorInfo & {
  at: string
  /** The flow that failed, e.g. 'googleSignIn'. */
  scope: string
}

const MAX_ENTRIES = 20

const diagnostics = {
  newestFirst: [] as AuthDiagnostic[],
  add(entry: AuthDiagnostic) {
    this.newestFirst.unshift(entry)
    if (this.newestFirst.length > MAX_ENTRIES) this.newestFirst.length = MAX_ENTRIES
  },
  clear() {
    this.newestFirst.length = 0
  },
}

/**
 * Pull the diagnosable parts out of whatever the native module threw.
 *
 * Provider errors are not a single shape: google-signin rejects with an Error
 * carrying a string `code`, Supabase rejects with a plain object, and a bare
 * string is possible too. Read defensively and never throw from here — this
 * runs on a path that is already failing.
 */
export function describeAuthError(e: unknown): AuthErrorInfo {
  const err =
    e && typeof e === 'object'
      ? (e as { code?: unknown; status?: unknown; message?: unknown })
      : null
  return {
    code: err?.code == null ? null : String(err.code),
    status: typeof err?.status === 'number' ? err.status : null,
    message: err ? (err.message == null ? '' : String(err.message)) : String(e),
  }
}

/**
 * Record a native sign-in failure and log it.
 *
 * The console line mirrors reportFailure's shape (errors.ts) so an auth failure
 * reads like every other logged failure in a Metro / logcat session. It must
 * not collide with the console.error filter installed by
 * silenceInvalidRefreshTokenLogs (authSession.ts) — that one matches on GoTrue's
 * "Invalid Refresh Token" wording, which this never emits.
 */
export function recordAuthFailure(scope: string, info: AuthErrorInfo): void {
  diagnostics.add({ ...info, scope, at: new Date().toISOString() })
  console.error(
    `[${scope}] failed: code=${info.code ?? '—'} status=${info.status ?? '—'} ${info.message}`,
  )
}

/** Newest first. Empty until something has actually failed this launch. */
export function getAuthDiagnostics(): AuthDiagnostic[] {
  return diagnostics.newestFirst.slice()
}

/** A plain-text block a tester can copy into a bug report. */
export function formatAuthDiagnostics(): string {
  return diagnostics.newestFirst
    .map(
      (e) =>
        `${e.at}  ${e.scope}\n  code=${e.code ?? '—'}  status=${e.status ?? '—'}\n  ${e.message}`,
    )
    .join('\n\n')
}

/** Test-only reset so each test starts from a clean module state. */
export function __resetAuthDiagnosticsForTest(): void {
  diagnostics.clear()
}
