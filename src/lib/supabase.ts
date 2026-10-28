import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined
const key = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined

export const configMissing = !url || !key

// The anon/publishable key is designed to be public. Security comes from the
// Row Level Security rules inside the database.
export const supabase = createClient(url || 'http://localhost', key || 'missing-key')
