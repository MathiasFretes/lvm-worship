import { createClient } from '@supabase/supabase-js'

const SESSION_DEFAULTS = Object.freeze({
  persistSession: true,
  autoRefreshToken: true,
  detectSessionInUrl: true,
})

/** Build the shared LVM data client without reading platform globals. */
export function createLvmSupabase(options = {}) {
  const { url, anonKey, storage, auth = {}, global: globalOptions } = options
  const clientOptions = {
    auth: { ...SESSION_DEFAULTS, storage, ...auth },
  }
  if (globalOptions) clientOptions.global = globalOptions
  return createClient(url, anonKey, clientOptions)
}
