import { supabase } from './supabase'

export type Kind = 'notices' | 'placement_resources'

export const BUCKET = 'campus-files'
export const MAX_FILE = 5 * 1024 * 1024 // 5 MB (also enforced by the storage bucket)
export const ALLOWED_TYPES = ['application/pdf', 'image/png', 'image/jpeg', 'image/webp']

interface Cfg {
  heading: string
  singular: string
  bodyField: 'body' | 'description'
  bodyLabel: string
  hasLink: boolean
  categories: [string, string][]
}

export const CONTENT: Record<Kind, Cfg> = {
  notices: {
    heading: 'Notices', singular: 'notice', bodyField: 'body', bodyLabel: 'Details', hasLink: false,
    categories: [
      ['placement_notice', 'Placement notice'],
      ['recruitment_announcement', 'Recruitment announcement'],
      ['training_programme', 'Training programme'],
      ['workshop_seminar', 'Workshop / seminar'],
      ['student_achievement', 'Student achievement'],
      ['other', 'Other'],
    ],
  },
  placement_resources: {
    heading: 'Placement resources', singular: 'resource', bodyField: 'description', bodyLabel: 'Description', hasLink: true,
    categories: [
      ['resume_guide', 'Resume-writing guide'],
      ['aptitude_practice', 'Aptitude practice'],
      ['interview_preparation', 'Interview preparation'],
      ['group_discussion', 'Group discussion'],
      ['communication_skills', 'Communication skills'],
      ['employability', 'Employability'],
      ['placement_pdf', 'Placement PDF'],
      ['other', 'Other'],
    ],
  },
}

export function catLabel(kind: Kind, v: string): string {
  return CONTENT[kind].categories.find(c => c[0] === v)?.[1] ?? v
}

export function formatDate(iso?: string | null): string {
  if (!iso) return ''
  return new Date(iso).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
}

// Only allow normal web links (blocks javascript: links)
export const isHttpUrl = (s: string) => /^https?:\/\/[^\s]+$/i.test(s)

const safeName = (n: string) => n.replace(/[^a-zA-Z0-9._-]+/g, '_').slice(-80)

export async function uploadAttachment(
  file: File, kind: Kind | 'events', recordId: string, yearId: string | null, yearLabel: string,
): Promise<string> {
  if (file.size > MAX_FILE) throw new Error('File is too large. Maximum size is 5 MB.')
  if (!ALLOWED_TYPES.includes(file.type)) throw new Error('Only PDF, PNG, JPG or WEBP files are allowed.')
  const path = `${yearLabel || 'general'}/${kind}/${recordId}-${Date.now()}-${safeName(file.name)}`
  const { error } = await supabase.storage.from(BUCKET).upload(path, file, { contentType: file.type, upsert: false })
  if (error) throw new Error('Upload failed: ' + error.message)
  const { data: u } = await supabase.auth.getUser()
  const { error: e2 } = await supabase.from('uploaded_files').insert({
    bucket: BUCKET, path, size_bytes: file.size, mime_type: file.type,
    academic_year_id: yearId, linked_table: kind, linked_id: recordId, uploaded_by: u.user?.id ?? null,
  })
  if (e2) {
    await supabase.storage.from(BUCKET).remove([path])
    throw new Error('Could not record the file: ' + e2.message)
  }
  return path
}

// Deletes the real file from storage, then its registry row.
export async function removeAttachment(path: string): Promise<void> {
  const { error } = await supabase.storage.from(BUCKET).remove([path])
  if (error) throw new Error('Could not delete the file: ' + error.message)
  await supabase.from('uploaded_files').delete().eq('path', path)
}

export async function openAttachment(path: string): Promise<void> {
  const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(path, 120)
  if (error || !data) throw new Error('Could not open the file. ' + (error?.message ?? ''))
  const a = document.createElement('a')
  a.href = data.signedUrl
  a.target = '_blank'
  a.rel = 'noopener'
  document.body.appendChild(a)
  a.click()
  a.remove()
}

// ---------- Events ----------
export const EVENT_CATEGORIES: [string, string][] = [
  ['workshop', 'Workshop'],
  ['aptitude_training', 'Aptitude training'],
  ['resume_session', 'Resume-writing session'],
  ['interview_prep', 'Interview preparation'],
  ['employability_skills', 'Employability skills'],
  ['communication_skills', 'Communication skills'],
  ['guest_lecture', 'Guest lecture'],
  ['campus_drive', 'Campus drive'],
  ['other', 'Other'],
]
export const eventCatLabel = (v: string) => EVENT_CATEGORIES.find(c => c[0] === v)?.[1] ?? v

export function formatDateTime(iso?: string | null): string {
  if (!iso) return ''
  return new Date(iso).toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit' })
}

// ISO time -> value for <input type="datetime-local">
export function toInputValue(iso?: string | null): string {
  if (!iso) return ''
  const d = new Date(iso)
  const p = (n: number) => String(n).padStart(2, '0')
  return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate()) + 'T' + p(d.getHours()) + ':' + p(d.getMinutes())
}

export function startOfToday(): string {
  const d = new Date()
  d.setHours(0, 0, 0, 0)
  return d.toISOString()
}
