import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/auth'
import Modal from '../components/Modal'
import { Spinner } from '../components/Layout'
import {
  EVENT_CATEGORIES, eventCatLabel, formatDateTime, toInputValue, uploadAttachment,
  removeAttachment, openAttachment, MAX_FILE, ALLOWED_TYPES,
} from '../lib/content'

const PAGE = 15
interface Year { id: string; label: string; is_current: boolean }
interface Course { id: string; code: string; name: string }

export default function EventsAdmin() {
  const { session } = useAuth()
  const [years, setYears] = useState<Year[]>([])
  const [courses, setCourses] = useState<Course[]>([])
  const [rows, setRows] = useState<any[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(0)
  const [status, setStatus] = useState('')
  const [category, setCategory] = useState('')
  const [yearId, setYearId] = useState('')
  const [search, setSearch] = useState('')
  const [dq, setDq] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [editing, setEditing] = useState<any | null | undefined>(undefined)
  const [reload, setReload] = useState(0)
  const [busyId, setBusyId] = useState('')

  useEffect(() => {
    Promise.all([
      supabase.from('academic_years').select('id, label, is_current').order('label', { ascending: false }),
      supabase.from('courses').select('id, code, name').order('code'),
    ]).then(([y, c]) => { setYears((y.data as Year[]) ?? []); setCourses((c.data as Course[]) ?? []) })
  }, [])

  useEffect(() => {
    const t = setTimeout(() => { setDq(search); setPage(0) }, 300)
    return () => clearTimeout(t)
  }, [search])

  useEffect(() => {
    setLoading(true)
    let q: any = supabase.from('events').select('*', { count: 'exact' }).order('event_start', { ascending: false })
    if (status) q = q.eq('status', status)
    if (category) q = q.eq('category', category)
    if (yearId) q = q.eq('academic_year_id', yearId)
    const t = dq.replace(/[%,()]/g, ' ').trim()
    if (t) q = q.ilike('title', '%' + t + '%')
    q.range(page * PAGE, page * PAGE + PAGE - 1).then(({ data, count, error: e }: any) => {
      setError(e ? e.message : '')
      setRows(data ?? [])
      setTotal(count ?? 0)
      setLoading(false)
    })
  }, [status, category, yearId, dq, page, reload])

  const yearLabel = (id: string | null) => years.find(y => y.id === id)?.label ?? ''

  async function changeStatus(r: any, next: string) {
    setBusyId(r.id); setError('')
    const { error: e } = await supabase.from('events').update({ status: next }).eq('id', r.id)
    setBusyId('')
    if (e) setError(e.message); else setReload(n => n + 1)
  }

  async function remove(r: any) {
    if (!window.confirm('Permanently delete "' + r.title + '"? All its registrations and attendance records will be deleted too. This cannot be undone.')) return
    setBusyId(r.id); setError('')
    try {
      if (r.attachment_path) await removeAttachment(r.attachment_path)
      const { error: e } = await supabase.from('events').delete().eq('id', r.id)
      if (e) throw new Error(e.message)
      setReload(n => n + 1)
    } catch (ex: any) { setError(ex.message) }
    setBusyId('')
  }

  const pages = Math.max(1, Math.ceil(total / PAGE))
  const badge = (s: string) => s === 'published' ? 'bg-green-100 text-green-800' : s === 'draft' ? 'bg-amber-100 text-amber-800' : s === 'closed' ? 'bg-orange-100 text-orange-800' : 'bg-slate-200 text-slate-600'

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <Link to="/admin" className="text-sm text-brand-green">&larr; Dashboard</Link>
          <h1 className="text-2xl font-bold text-brand-navy">Events and attendance</h1>
        </div>
        <button className="btn-green" onClick={() => setEditing(null)}>+ New event</button>
      </div>

      <div className="card space-y-3">
        <input className="input" placeholder="Search by event name" value={search} onChange={e => setSearch(e.target.value)} />
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
          <select className="input" value={status} onChange={e => { setStatus(e.target.value); setPage(0) }}>
            <option value="">Any status</option>
            <option value="draft">Draft</option>
            <option value="published">Published</option>
            <option value="closed">Registration closed</option>
            <option value="archived">Archived</option>
          </select>
          <select className="input" value={category} onChange={e => { setCategory(e.target.value); setPage(0) }}>
            <option value="">All categories</option>
            {EVENT_CATEGORIES.map(c => <option key={c[0]} value={c[0]}>{c[1]}</option>)}
          </select>
          <select className="input" value={yearId} onChange={e => { setYearId(e.target.value); setPage(0) }}>
            <option value="">All academic years</option>
            {years.map(y => <option key={y.id} value={y.id}>{y.label}</option>)}
          </select>
        </div>
      </div>

      {error && <div className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</div>}

      {loading ? <Spinner /> : rows.length === 0 ? (
        <div className="card text-slate-500">No events yet. Tap "+ New event" to add one.</div>
      ) : (
        <div className="space-y-2">
          <div className="text-sm text-slate-500">{total} event{total === 1 ? '' : 's'}</div>
          {rows.map(r => (
            <div key={r.id} className="card space-y-3">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-semibold text-brand-navy">{r.title}</span>
                  <span className={'rounded-full px-2 py-0.5 text-xs font-semibold ' + badge(r.status)}>{r.status === 'closed' ? 'registration closed' : r.status}</span>
                  {r.is_public && <span className="rounded-full bg-blue-100 px-2 py-0.5 text-xs font-semibold text-blue-800">public</span>}
                </div>
                <div className="mt-1 text-sm text-slate-600">
                  {eventCatLabel(r.category)} &middot; {formatDateTime(r.event_start)}
                  {r.venue ? ' · ' + r.venue : ''}{yearLabel(r.academic_year_id) ? ' · ' + yearLabel(r.academic_year_id) : ''}
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                <Link to={'/admin/events/' + r.id} className="btn-navy !py-1.5">Participants</Link>
                <button className="btn-outline !py-1.5" onClick={() => setEditing(r)}>Edit</button>
                {r.status === 'draft' && <button className="btn-green !py-1.5" disabled={busyId === r.id} onClick={() => changeStatus(r, 'published')}>Publish</button>}
                {r.status === 'published' && <>
                  <button className="btn-outline !py-1.5" disabled={busyId === r.id} onClick={() => changeStatus(r, 'closed')}>Close registration</button>
                  <button className="btn-outline !py-1.5" disabled={busyId === r.id} onClick={() => changeStatus(r, 'draft')}>Unpublish</button>
                </>}
                {r.status === 'closed' && <button className="btn-outline !py-1.5" disabled={busyId === r.id} onClick={() => changeStatus(r, 'published')}>Reopen registration</button>}
                {r.status !== 'archived' ? (
                  <button className="btn-outline !py-1.5" disabled={busyId === r.id} onClick={() => changeStatus(r, 'archived')}>Archive</button>
                ) : (
                  <button className="btn-outline !py-1.5" disabled={busyId === r.id} onClick={() => changeStatus(r, 'draft')}>Restore</button>
                )}
                <button className="btn !py-1.5 border border-red-300 bg-white text-red-700 hover:bg-red-50" disabled={busyId === r.id} onClick={() => remove(r)}>Delete</button>
              </div>
            </div>
          ))}
          <div className="flex items-center justify-between pt-2">
            <button className="btn-outline" disabled={page === 0} onClick={() => setPage(p => p - 1)}>Previous</button>
            <span className="text-sm text-slate-500">Page {page + 1} of {pages}</span>
            <button className="btn-outline" disabled={page + 1 >= pages} onClick={() => setPage(p => p + 1)}>Next</button>
          </div>
        </div>
      )}

      {editing !== undefined && (
        <EventEditor row={editing} years={years} courses={courses} userId={session?.user.id ?? null}
          onClose={() => setEditing(undefined)} onSaved={() => { setEditing(undefined); setReload(n => n + 1) }} />
      )}
    </div>
  )
}

function EventEditor({ row, years, courses, userId, onClose, onSaved }:
  { row: any | null; years: Year[]; courses: Course[]; userId: string | null; onClose: () => void; onSaved: () => void }) {
  const current = years.find(y => y.is_current)
  const [title, setTitle] = useState(row?.title ?? '')
  const [desc, setDesc] = useState(row?.description ?? '')
  const [category, setCategory] = useState(row?.category ?? 'workshop')
  const [start, setStart] = useState(toInputValue(row?.event_start))
  const [end, setEnd] = useState(toInputValue(row?.event_end))
  const [deadline, setDeadline] = useState(toInputValue(row?.registration_deadline))
  const [venue, setVenue] = useState(row?.venue ?? '')
  const [organiser, setOrganiser] = useState(row?.organiser ?? '')
  const [yearId, setYearId] = useState<string>(row ? (row.academic_year_id ?? '') : (current?.id ?? ''))
  const [isPublic, setIsPublic] = useState<boolean>(row?.is_public ?? false)
  const [selected, setSelected] = useState<string[]>([])
  const [existing, setExisting] = useState<string[]>([])
  const [file, setFile] = useState<File | null>(null)
  const [removeFile, setRemoveFile] = useState(false)
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (!row) return
    supabase.from('event_eligible_courses').select('course_id').eq('event_id', row.id)
      .then(({ data }) => { const ids = (data ?? []).map((x: any) => x.course_id); setSelected(ids); setExisting(ids) })
  }, [row])

  function pickFile(f: File | null) {
    setErr('')
    if (f && f.size > MAX_FILE) { setErr('File is too large. Maximum size is 5 MB.'); return }
    if (f && !ALLOWED_TYPES.includes(f.type)) { setErr('Only PDF, PNG, JPG or WEBP files are allowed.'); return }
    setFile(f)
  }
  const toggle = (id: string) => setSelected(s => s.includes(id) ? s.filter(x => x !== id) : [...s, id])

  async function save(statusOverride?: 'draft' | 'published') {
    setErr('')
    if (title.trim().length < 3 || title.trim().length > 200) { setErr('Event name must be 3 to 200 characters.'); return }
    if (!start) { setErr('Please choose the start date and time.'); return }
    if (!yearId) { setErr('Please choose an academic year.'); return }
    const startD = new Date(start)
    if (end && new Date(end) < startD) { setErr('The end time is before the start time.'); return }
    if (deadline && new Date(deadline) > startD) { setErr('The registration deadline must be before the event starts.'); return }
    setBusy(true)
    const id: string = row?.id ?? crypto.randomUUID()
    const status: string = statusOverride ?? row?.status ?? 'draft'
    const oldPath: string | null = row?.attachment_path ?? null
    let newPath: string | null = oldPath
    let uploaded = false
    try {
      if (file) {
        const label = years.find(y => y.id === yearId)?.label ?? ''
        newPath = await uploadAttachment(file, 'events', id, yearId, label)
        uploaded = true
      } else if (removeFile) newPath = null

      const payload: any = {
        title: title.trim(), description: desc.trim() || null, category,
        event_start: startD.toISOString(), event_end: end ? new Date(end).toISOString() : null,
        registration_deadline: deadline ? new Date(deadline).toISOString() : null,
        venue: venue.trim() || null, organiser: organiser.trim() || null,
        academic_year_id: yearId, is_public: isPublic, status, attachment_path: newPath,
      }
      let dbErr: any
      if (row) ({ error: dbErr } = await supabase.from('events').update(payload).eq('id', id))
      else ({ error: dbErr } = await supabase.from('events').insert({ ...payload, id, created_by: userId }))
      if (dbErr) {
        if (uploaded && newPath) await removeAttachment(newPath).catch(() => {})
        throw new Error(dbErr.message)
      }

      // eligible courses: add new ones first, then remove old ones (never leave the event open by accident)
      const toAdd = selected.filter(c => !existing.includes(c))
      const toRemove = existing.filter(c => !selected.includes(c))
      if (toAdd.length) {
        const { error: e1 } = await supabase.from('event_eligible_courses').insert(toAdd.map(c => ({ event_id: id, course_id: c })))
        if (e1) throw new Error('Event saved, but eligible courses failed: ' + e1.message)
      }
      if (toRemove.length) {
        const { error: e2 } = await supabase.from('event_eligible_courses').delete().eq('event_id', id).in('course_id', toRemove)
        if (e2) throw new Error('Event saved, but eligible courses failed: ' + e2.message)
      }

      if (oldPath && oldPath !== newPath) await removeAttachment(oldPath).catch(() => {})
      if (row && newPath && newPath === oldPath) {
        await supabase.from('uploaded_files').update({ academic_year_id: yearId }).eq('path', newPath)
      }
      onSaved()
    } catch (ex: any) { setErr(ex.message) }
    setBusy(false)
  }

  return (
    <Modal title={row ? 'Edit event' : 'New event'} onClose={onClose}>
      <div className="space-y-3">
        <div>
          <label className="mb-1 block text-sm font-medium">Event name</label>
          <input className="input" value={title} maxLength={200} onChange={e => setTitle(e.target.value)} />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium">Description</label>
          <textarea className="input min-h-[90px]" value={desc} maxLength={3000} onChange={e => setDesc(e.target.value)} />
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-sm font-medium">Category</label>
            <select className="input" value={category} onChange={e => setCategory(e.target.value)}>
              {EVENT_CATEGORIES.map(c => <option key={c[0]} value={c[0]}>{c[1]}</option>)}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium">Academic year</label>
            <select className="input" value={yearId} onChange={e => setYearId(e.target.value)}>
              <option value="">Choose...</option>
              {years.map(y => <option key={y.id} value={y.id}>{y.label}</option>)}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium">Starts</label>
            <input className="input" type="datetime-local" value={start} onChange={e => setStart(e.target.value)} />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium">Ends (optional)</label>
            <input className="input" type="datetime-local" value={end} onChange={e => setEnd(e.target.value)} />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium">Venue</label>
            <input className="input" value={venue} maxLength={150} onChange={e => setVenue(e.target.value)} />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium">Resource person / organiser</label>
            <input className="input" value={organiser} maxLength={150} onChange={e => setOrganiser(e.target.value)} />
          </div>
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium">Registration deadline (optional)</label>
          <input className="input" type="datetime-local" value={deadline} onChange={e => setDeadline(e.target.value)} />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium">Eligible courses</label>
          <div className="flex flex-wrap gap-2">
            {courses.map(c => (
              <label key={c.id} className={'flex items-center gap-1 rounded-lg border px-2 py-1 text-sm ' + (selected.includes(c.id) ? 'border-brand-green bg-brand-greenLight' : 'border-slate-300')}>
                <input type="checkbox" checked={selected.includes(c.id)} onChange={() => toggle(c.id)} /> {c.code}
              </label>
            ))}
          </div>
          <p className="mt-1 text-xs text-slate-500">Leave all unticked to open the event to every course.</p>
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium">Document (optional)</label>
          {row?.attachment_path && !removeFile && !file && (
            <div className="mb-1 flex items-center gap-3 text-sm">
              <button type="button" className="text-brand-green underline" onClick={() => openAttachment(row.attachment_path).catch((e: any) => setErr(e.message))}>View current file</button>
              <button type="button" className="text-red-600 underline" onClick={() => setRemoveFile(true)}>Remove it</button>
            </div>
          )}
          {removeFile && <div className="mb-1 text-sm text-amber-700">The file will be deleted when you save.</div>}
          <input type="file" accept=".pdf,.png,.jpg,.jpeg,.webp" className="block w-full text-sm" onChange={e => pickFile(e.target.files?.[0] ?? null)} />
          <p className="mt-1 text-xs text-slate-500">PDF, PNG, JPG or WEBP. Maximum 5 MB.</p>
        </div>
        <label className="flex items-start gap-2 rounded-lg bg-slate-50 p-3 text-sm">
          <input type="checkbox" className="mt-1" checked={isPublic} onChange={e => setIsPublic(e.target.checked)} />
          <span><b>Show on the public home page.</b> Only the event details are public. Registration needs a student login.</span>
        </label>
        {err && <div className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{err}</div>}
        {row ? (
          <button className="btn-green w-full" disabled={busy} onClick={() => save()}>{busy ? 'Saving...' : 'Save changes'}</button>
        ) : (
          <div className="grid grid-cols-2 gap-2">
            <button className="btn-outline" disabled={busy} onClick={() => save('draft')}>{busy ? 'Saving...' : 'Save as draft'}</button>
            <button className="btn-green" disabled={busy} onClick={() => save('published')}>{busy ? 'Saving...' : 'Publish now'}</button>
          </div>
        )}
      </div>
    </Modal>
  )
}
