// Per-role personal setlist caps. Single source of truth for both apps; must
// stay in sync with the DB trigger public.check_personal_setlist_limit(), whose
// live body comes from
// supabase/migrations/20260708000000_remove_collaborator_role.sql:99-104.
// Owner is uncapped (Infinity).

const STANDARD_LIMIT = 50

export const PERSONAL_SETLIST_LIMITS = {
  user: 30,
  editor: STANDARD_LIMIT,
  admin: STANDARD_LIMIT,
  owner: Infinity,
}

// The personal setlist cap for a role. Unknown roles fall back to the base
// `user` cap, matching the trigger's ELSE branch.
export function personalSetlistLimit(role) {
  const limit = PERSONAL_SETLIST_LIMITS[role]
  if (limit !== undefined) return limit
  return PERSONAL_SETLIST_LIMITS.user
}
