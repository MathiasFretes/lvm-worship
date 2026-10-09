import { createLvmSupabase } from '@lavozmisionera/core/supabase/client'
import { cookieStorage } from './cookieStorage'

// Persist the auth session in a cookie scoped to `.lavozmisionera.com` so the login
// is shared across lavozmisionera.com and tracks.lavozmisionera.com (single sign-on).
// storageKey is left at the supabase default — derived from the shared project
// ref — so both apps read the same cookie.
export const supabase = createLvmSupabase({
  url: import.meta.env.VITE_SUPABASE_URL,
  anonKey: import.meta.env.VITE_SUPABASE_ANON_KEY,
  storage: cookieStorage,
})
