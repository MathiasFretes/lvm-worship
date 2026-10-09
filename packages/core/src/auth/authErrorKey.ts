// Map a Supabase/GoTrue auth error to an auth-namespace i18n key.
//
// Nothing from a provider response may reach a user verbatim. Auth errors used
// to be passed through as `error.message`, which put GoTrue's own wording in
// front of whoever was holding the device — most visibly on sign-up, where the
// password policy surfaced as "Password should contain at least one character of
// each: abcdefghijklmnopqrstuvwxyz, ABCDEFGHIJKLMNOPQRSTUVWXYZ, 0123456789,
// !@#$%^&*()_+-=[]{};'\:"|<>?,./`~." (QA report Nº 6994, M-02).
//
// Always returns a key. There is no passthrough branch and no raw-message
// escape hatch — an unrecognised error becomes 'errors.generic', and the caller
// logs the real text rather than rendering it.
//
// Codes are matched first (GoTrue sets a stable `code` on modern versions);
// message matching is the fallback for responses that predate them.

/** Supabase auth errors are plain objects, not Error instances. */
type AuthErrorish =
  | { message?: unknown; status?: unknown; code?: unknown; error_code?: unknown }
  | null
  | undefined

function codeOf(error: AuthErrorish): string {
  if (!error || typeof error !== 'object') return ''
  return String(error.code ?? error.error_code ?? '').toLowerCase()
}

function messageOf(error: AuthErrorish): string {
  if (!error || typeof error !== 'object') return ''
  return String(error.message ?? '').toLowerCase()
}

function statusOf(error: AuthErrorish): number | null {
  if (!error || typeof error !== 'object') return null
  const status = Number(error.status)
  return Number.isFinite(status) ? status : null
}

const CODE_KEYS: Readonly<Record<string, string>> = {
  weak_password: 'errors.passwordNeedsMix',
  password_required_characters: 'errors.passwordNeedsMix',
  same_password: 'errors.passwordSameAsCurrent',
  invalid_credentials: 'errors.invalidCredentials',
  invalid_grant: 'errors.invalidCredentials',
  email_not_confirmed: 'errors.emailNotConfirmed',
  email_exists: 'errors.emailExists',
  user_already_exists: 'errors.emailExists',
  invalid_email: 'errors.invalidEmail',
  validation_failed: 'errors.invalidEmail',
  over_email_send_rate_limit: 'errors.rateLimited',
}

const MESSAGE_KEYS: ReadonlyArray<readonly [readonly string[], string]> = [
  [['network request failed', 'failed to fetch', 'network error'], 'errors.network'],
  [['invalid login', 'invalid credentials'], 'errors.invalidCredentials'],
  [['email not confirmed'], 'errors.emailNotConfirmed'],
  [['already registered', 'already been registered'], 'errors.emailExists'],
  [['password should', 'password must'], 'errors.passwordNeedsMix'],
  [['too many requests'], 'errors.rateLimited'],
]

function keyForMessage(message: string): string | null {
  for (const [phrases, key] of MESSAGE_KEYS) {
    if (phrases.some((phrase) => message.includes(phrase))) return key
  }
  return null
}

/**
 * @returns an `auth` namespace key, e.g. 'errors.invalidCredentials'. Never a
 * provider message, and never null.
 */
export function authErrorKey(error: AuthErrorish): string {
  if (!error) return 'errors.generic'

  const code = codeOf(error)
  const message = messageOf(error)
  const status = statusOf(error)
  const messageKey = keyForMessage(message)

  // Network failures win over provider metadata because the request did not
  // reliably reach the provider.
  if (messageKey === 'errors.network') return messageKey
  if (status === 429 || code.includes('rate_limit') || message.includes('rate limit')) {
    return 'errors.rateLimited'
  }
  return CODE_KEYS[code] ?? messageKey ?? 'errors.generic'
}
