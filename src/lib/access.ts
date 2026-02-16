import { supabase } from './supabaseClient'
import type { UserAccess } from './accessTypes'

export async function fetchUserAccess(): Promise<UserAccess | null> {
  const { data: sessionData, error: sessionError } = await supabase.auth.getSession()
  if (sessionError) return null

  const userId = sessionData.session?.user?.id
  if (!userId) return null

  const { data, error } = await supabase
    .from('user_access')
    .select('role, location')
    .eq('user_id', userId)
    .maybeSingle()

  if (error) {
    if ((error as any)?.code === 'PGRST116') return null
    return null
  }
  return data as UserAccess
}
