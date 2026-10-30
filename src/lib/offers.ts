import { supabase } from './supabase'
import { ALLOWED_TYPES, MAX_FILE } from './content'

export const OFFER_BUCKET = 'offer-letters'
const safeName = (n: string) => n.replace(/[^a-zA-Z0-9._-]+/g, '_').slice(-80)

// Offer letters go into the student's own private folder: <student id>/<file>
export async function uploadOffer(file: File, studentId: string, offerId: string, yearId: string): Promise<string> {
  if (file.size > MAX_FILE) throw new Error('File is too large. Maximum size is 5 MB.')
  if (!ALLOWED_TYPES.includes(file.type)) throw new Error('Only PDF, PNG, JPG or WEBP files are allowed.')
  const path = `${studentId}/${offerId}-${Date.now()}-${safeName(file.name)}`
  const { error } = await supabase.storage.from(OFFER_BUCKET).upload(path, file, { contentType: file.type, upsert: false })
  if (error) throw new Error('Upload failed: ' + error.message)
  const { data: u } = await supabase.auth.getUser()
  const { error: e2 } = await supabase.from('uploaded_files').insert({
    bucket: OFFER_BUCKET, path, size_bytes: file.size, mime_type: file.type, academic_year_id: yearId,
    linked_table: 'offer_letters', linked_id: offerId, uploaded_by: u.user?.id ?? null,
  })
  if (e2) {
    await supabase.storage.from(OFFER_BUCKET).remove([path])
    throw new Error('Could not record the file: ' + e2.message)
  }
  return path
}
