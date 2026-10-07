// Single canonical read of the current user's role from public.users. Both apps
// should use this instead of inlining `from('users').select('role')`, so the
// column name (`role`) lives in exactly one place. Errors throw.

/**
 * @param {import('@supabase/supabase-js').SupabaseClient} client
 * @returns {Promise<string>} the user's role, or 'user' if unauthenticated/missing.
 */
export async function fetchUserRole(client) {
  const authResult = await client.auth.getUser()
  const userId = authResult.data?.user?.id
  if (!userId) return 'user'

  const query = client
    .from('users')
    .select('role')
    .eq('id', userId)
    .maybeSingle()
  const { data, error } = await query
  if (error) throw error
  return data?.role || 'user'
}
