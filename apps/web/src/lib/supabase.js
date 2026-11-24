import { createLvmBackend } from '@lavozmisionera/core/backend/client'

// Compatibility export for existing repositories. All web requests use our own API.
export const supabase = createLvmBackend({
  url: import.meta.env.VITE_API_URL || `${globalThis.location?.origin || 'http://localhost:5173'}/api`,
})
