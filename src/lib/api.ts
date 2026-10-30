import { supabase } from './supabase'

export interface RowResult {
  register_no: string
  status: 'ok' | 'invalid' | 'duplicate' | 'created' | 'failed'
  message: string
  temp_password?: string
}

// Calls the secure server function. Only works when signed in as admin.
export async function callAdmin<T = any>(body: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.functions.invoke('admin-students', { body })
  if (error) throw new Error('Could not reach the server function. ' + error.message)
  if (!data || data.ok === false) throw new Error(data?.error ?? 'Unknown error')
  return data as T
}

// Calls the secure archive / deletion server function (admin only).
export async function callArchive<T = any>(body: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.functions.invoke('admin-archive', { body })
  if (error) throw new Error('Could not reach the archive function. ' + error.message)
  if (!data || data.ok === false) throw new Error(data?.error ?? 'Unknown error')
  return data as T
}
