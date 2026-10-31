import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/auth'
import Modal from '../components/Modal'
import CompanyLogo from '../components/CompanyLogo'
import { Spinner } from '../components/Layout'
import { cleanupOfferFile } from '../lib/offers'
import {
  formatDateTime, isHttpUrl, toInputValue, uploadAttachment, removeAttachment, openAttachment,
  MAX_FILE, ALLOWED_TYPES,
} from '../lib/content'

const PAGE = 15
interface Year { id: string; label: string; is_current: boolean }
interface Course { id: string; code: string; name: string }

export default function DrivesAdmin() {
  const { session } = useAuth()
  const [years, setYears] = useState<Year[]>([])
  const [courses, setCourses] = useState<Course[]>([])
  const [companies, setCompanies] = useState<any[]>([])
  const [rows, setRows] = useState<any[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(0)
  const [status, setStatus] = useState('')
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
      supabase.from('companies').select('id, name, logo_path').order('name').limit(500),
    ]).then(([y, c, co]) => {
      setYears((y.data as Year[]) ?? []); setCourses((c.data as Course[]) ?? []); setCompanies(co.data ?? [])
    })
  }, [reload])

  useEffect(() => {
    const t = setTimeout(() => { setDq(search); setPage(0) }, 300)
    return () => clearTimeout(t)
  }, [search])

  useEffect(() => {
    setLoading(true)
    let q: any = supabase.from('campus_drives').select('*, companies(name, logo_path)', { count: 'exact' }).order('created_at', { ascending: false })
    if (status) q = q.eq('status', status)
    if (yearId) q = q.eq('academic_year_id', yearId)
    const t = dq.replace(/[%,()]/g, ' ').trim()
    if (t) q = q.ilike('job_title', '%' + t + '%')
    q.range(page * PAGE, page * PAGE + PAGE - 1).then(({ data, count, error: e }: any) => {
      setError(e ? e.message : ''); setRows(data ?? []); setTotal(count ?? 0); setLoading(false)
    })
  }, [status, yearId, dq, page, reload])

  const yearLabel = (id: string | null) => years.find(y => y.id === id)?.label ?? ''
  const co = (r: any) => (Array.isArray(r.companies) ? r.companies[0] : r.companies)

  async function changeStatus(r: any, next: string) {
    setBusyId(r.id); setError('')
    const { error: e } = await supabase.from('campus_drives').update({ status: next }).eq('id', r.id)
    setBusyId('')
    if (e) setError(e.message); else setReload(n => n + 1)
  }

  async function remove(r: any) {
    if (!window.confirm('Permanently delete this drive? All applicants, their statuses and any placement results for it will be deleted too. This cannot be undone.')) return
    setBusyId(r.id); setError('')
    try {
      if (r.attachment_path) await removeAttachment(r.attachment_path)
      const { data: offs } = await supabase.from('offer_letters').select('file_path').eq('drive_id', r.id)
      const { error: e } = await supabase.from('campus_drives').delete().eq('id', r.id)
      if (e) throw new Error(e.message)
      for (const path of Array.from(new Set((offs ?? []).map((o: any) => o.file_path)))) await cleanupOfferFile(path).catch(() => {})
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
          <h1 className="text-2xl font-bold text-brand-navy">Recruitment drives</h1>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link to="/admin/companies" className="btn-outline">Companies</Link>
          <button className="btn-green" onClick={() => setEditing(null)}>+ New drive</button>
        </div>
      </div>

      <div className="card space-y-3">
        <input className="input" placeholder="Search by job title" value={search} onChange={e => setSearch(e.target.value)} />
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          <select className="input" value={status} onChange={e => { setStatus(e.target.value); setPage(0) }}>
            <option value="">Any status</option>
            <option value="draft">Draft</option>
            <option value="published">Published</option>
            <option value="closed">Closed</option>
            <option value="archived">Archived</option>
          </select>
          <select className="input" value={yearId} onChange={e => { setYearId(e.target.value); setPage(0) }}>
            <option value="">All academic years</option>
            {years.map(y => <option key={y.id} value={y.id}>{y.label}</option>)}
          </select>
        </div>
      </div>

      {error && <div className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</div>}

      {loading ? <Spinner /> : rows.length === 0 ? (
        <div className="card text-slate-500">No drives yet. Add a company first, then tap "+ New drive".</div>
      ) : (
        <div className="space-y-2">
          <div className="text-sm text-slate-500">{total} drive{total === 1 ? '' : 's'}</div>
          {rows.map(r => (
            <div key={r.id} className="card space-y-3">
              <div className="flex items-start gap-3">
                <CompanyLogo path={co(r)?.logo_path} name={co(r)?.name ?? '?'} />
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-semibold text-brand-navy">{co(r)?.name} - {r.job_title}</span>
                    <span className={'rounded-full px-2 py-0.5 text-xs font-semibold ' + badge(r.status)}>{r.status}</span>
                    {r.is_public && <span className="rounded-full bg-blue-100 px-2 py-0.5 text-xs font-semibold text-blue-800">public</span>}
                  </div>
                  <div className="mt-1 text-sm text-slate-600">
                    {yearLabel(r.academic_year_id)}
                    {r.application_deadline ? ' · Apply by ' + formatDateTime(r.application_deadline) : ''}
                    {r.drive_date ? ' · Drive ' + formatDateTime(r.drive_date) : ''}
                  </div>
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                <Link to={'/admin/drives/' + r.id} className="btn-navy !py-1.5">Applicants</Link>
                <button className="btn-outline !py-1.5" onClick={() => setEditing(r)}>Edit</button>
                {r.status === 'draft' && <button className="btn-green !py-1.5" disabled={busyId === r.id} onClick={() => changeStatus(r, 'published')}>Publish</button>}
                {r.status === 'published' && <>
                  <button className="btn-outline !py-1.5" disabled={busyId === r.id} onClick={() => changeStatus(r, 'closed')}>Close</button>
                  <button className="btn-outline !py-1.5" disabled={busyId === r.id} onClick={() => changeStatus(r, 'draft')}>Unpublish</button>
                </>}
                {r.status === 'closed' && <button className="btn-outline !py-1.5" disabled={busyId === r.id} onClick={() => changeStatus(r, 'published')}>Reopen</button>}
                {r.status !== 'archived'
                  ? <button className="btn-outline !py-1.5" disabled={busyId === r.id} onClick={() => changeStatus(r, 'archived')}>Archive</button>
                  : <button className="btn-outline !py-1.5" disabled={busyId === r.id} onClick={() => changeStatus(r, 'draft')}>Restore</button>}
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
        <DriveEditor row={editing} years={years} courses={courses} companies={companies} userId={session?.user.id ?? null}
          onClose={() => setEditing(undefined)} onSaved={() => { setEditing(undefined); setReload(n => n + 1) }} />
      )}
    </div>
  )
}

function DriveEditor({ row, years, courses, companies, userId, onClose, onSaved }:
  { row: any | null; years: Year[]; courses: Course[]; companies: any[]; userId: string | null; onClose: () => void; onSaved: () => void }) {
  const current = years.find(y => y.is_current)
  const [f, setF] = useState({
    company_id: row?.company_id ?? '', job_title: row?.job_title ?? '', description: row?.description ?? '',
    academic_year_id: row ? (row.academic_year_id ?? '') : (current?.id ?? ''),
    required_qualification: row?.required_qualification ?? '', required_skills: row?.required_skills ?? '',
    min_percentage: row?.min_percentage != null ? String(row.min_percentage) : '',
    package_details: row?.package_details ?? '', job_location: row?.job_location ?? '',
    application_deadline: toInputValue(row?.application_deadline), drive_date: toInputValue(row?.drive_date),
    venue: row?.venue ?? '', selection_process: row?.selection_process ?? '', documents_required: row?.documents_required ?? '',
    instructions: row?.instructions ?? '', external_link: row?.external_link ?? '', is_public: row?.is_public ?? false,
  })
  const set = (k: string, v: any) => setF(p => ({ ...p, [k]: v }))
  const [sems, setSems] = useState<number[]>(row?.eligible_semesters ?? [])
  const [selected, setSelected] = useState<string[]>([])
  const [existing, setExisting] = useState<string[]>([])
  const [file, setFile] = useState<File | null>(null)
  const [removeFile, setRemoveFile] = useState(false)
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (!row) return
    supabase.from('drive_eligible_courses').select('course_id').eq('drive_id', row.id)
      .then(({ data }) => { const ids = (data ?? []).map((x: any) => x.course_id); setSelected(ids); setExisting(ids) })
  }, [row])

  const toggleCourse = (id: string) => setSelected(s => s.includes(id) ? s.filter(x => x !== id) : [...s, id])
  const toggleSem = (n: number) => setSems(s => s.includes(n) ? s.filter(x => x !== n) : [...s, n].sort((a, b) => a - b))

  function pickFile(x: File | null) {
    setErr('')
    if (x && x.size > MAX_FILE) { setErr('File is too large. Maximum size is 5 MB.'); return }
    if (x && !ALLOWED_TYPES.includes(x.type)) { setErr('Only PDF, PNG, JPG or WEBP files are allowed.'); return }
    setFile(x)
  }

  async function save(statusOverride?: 'draft' | 'published') {
    setErr('')
    if (!f.company_id) { setErr('Please choose a company. Add one in Companies first if needed.'); return }
    if (f.job_title.trim().length < 2) { setErr('Job title is required.'); return }
    if (!f.academic_year_id) { setErr('Please choose an academic year.'); return }
    if (selected.length === 0) { setErr('Tick at least one eligible course.'); return }
    if (f.min_percentage !== '' && (isNaN(Number(f.min_percentage)) || Number(f.min_percentage) < 0 || Number(f.min_percentage) > 100)) { setErr('Minimum percentage must be between 0 and 100.'); return }
    if (f.external_link.trim() && !isHttpUrl(f.external_link.trim())) { setErr('The application link must start with http:// or https://'); return }
    if (f.application_deadline && f.drive_date && new Date(f.application_deadline) > new Date(f.drive_date)) { setErr('The application deadline is after the drive date.'); return }
    setBusy(true)
    const id: string = row?.id ?? crypto.randomUUID()
    const status: string = statusOverride ?? row?.status ?? 'draft'
    const oldPath: string | null = row?.attachment_path ?? null
    let newPath: string | null = oldPath
    let uploaded = false
    const t = (v: string) => v.trim() || null
    try {
      if (file) {
        const label = years.find(y => y.id === f.academic_year_id)?.label ?? ''
        newPath = await uploadAttachment(file, 'drives', id, f.academic_year_id, label); uploaded = true
      } else if (removeFile) newPath = null

      const payload: any = {
        company_id: f.company_id, job_title: f.job_title.trim(), description: t(f.description),
        academic_year_id: f.academic_year_id, eligible_semesters: sems.length ? sems : null,
        required_qualification: t(f.required_qualification), required_skills: t(f.required_skills),
        min_percentage: f.min_percentage === '' ? null : Number(f.min_percentage),
        package_details: t(f.package_details), job_location: t(f.job_location),
        application_deadline: f.application_deadline ? new Date(f.application_deadline).toISOString() : null,
        drive_date: f.drive_date ? new Date(f.drive_date).toISOString() : null,
        venue: t(f.venue), selection_process: t(f.selection_process), documents_required: t(f.documents_required),
        instructions: t(f.instructions), external_link: t(f.external_link),
        is_public: f.is_public, status, attachment_path: newPath,
      }
      let dbErr: any
      if (row) ({ error: dbErr } = await supabase.from('campus_drives').update(payload).eq('id', id))
      else ({ error: dbErr } = await supabase.from('campus_drives').insert({ ...payload, id, created_by: userId }))
      if (dbErr) {
        if (uploaded && newPath) await removeAttachment(newPath).catch(() => {})
        throw new Error(dbErr.message)
      }
      const toAdd = selected.filter(c => !existing.includes(c))
      const toRemove = existing.filter(c => !selected.includes(c))
      if (toAdd.length) {
        const { error: e1 } = await supabase.from('drive_eligible_courses').insert(toAdd.map(c => ({ drive_id: id, course_id: c })))
        if (e1) throw new Error('Drive saved, but eligible courses failed: ' + e1.message)
      }
      if (toRemove.length) {
        const { error: e2 } = await supabase.from('drive_eligible_courses').delete().eq('drive_id', id).in('course_id', toRemove)
        if (e2) throw new Error('Drive saved, but eligible courses failed: ' + e2.message)
      }
      if (oldPath && oldPath !== newPath) await removeAttachment(oldPath).catch(() => {})
      if (row && newPath && newPath === oldPath) {
        await supabase.from('uploaded_files').update({ academic_year_id: f.academic_year_id }).eq('path', newPath)
      }
      onSaved()
    } catch (ex: any) { setErr(ex.message) }
    setBusy(false)
  }

  const Txt = ({ k, label, max = 150, ph }: { k: string; label: string; max?: number; ph?: string }) => (
    <div><label className="mb-1 block text-sm font-medium">{label}</label>
      <input className="input" value={(f as any)[k]} maxLength={max} placeholder={ph} onChange={e => set(k, e.target.value)} /></div>
  )
  const Area = ({ k, label, rows = 3 }: { k: string; label: string; rows?: number }) => (
    <div><label className="mb-1 block text-sm font-medium">{label}</label>
      <textarea className="input" rows={rows} value={(f as any)[k]} maxLength={3000} onChange={e => set(k, e.target.value)} /></div>
  )

  return (
    <Modal title={row ? 'Edit drive' : 'New drive'} onClose={onClose}>
      <div className="space-y-3">
        <div>
          <label className="mb-1 block text-sm font-medium">Company</label>
          <select className="input" value={f.company_id} onChange={e => set('company_id', e.target.value)}>
            <option value="">Choose...</option>
            {companies.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          {companies.length === 0 && <p className="mt-1 text-xs text-amber-700">No companies yet. Close this box and add one under Companies.</p>}
        </div>
        {Txt({ k: 'job_title', label: 'Job title' })}
        {Area({ k: 'description', label: 'Job description' })}
        <div>
          <label className="mb-1 block text-sm font-medium">Academic year</label>
          <select className="input" value={f.academic_year_id} onChange={e => set('academic_year_id', e.target.value)}>
            <option value="">Choose...</option>
            {years.map(y => <option key={y.id} value={y.id}>{y.label}</option>)}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium">Eligible courses (required)</label>
          <div className="flex flex-wrap gap-2">
            {courses.map(c => (
              <label key={c.id} className={'flex items-center gap-1 rounded-lg border px-2 py-1 text-sm ' + (selected.includes(c.id) ? 'border-brand-green bg-brand-greenLight' : 'border-slate-300')}>
                <input type="checkbox" checked={selected.includes(c.id)} onChange={() => toggleCourse(c.id)} /> {c.code}
              </label>
            ))}
          </div>
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium">Eligible semesters</label>
          <div className="flex flex-wrap gap-2">
            {[1, 2, 3, 4, 5, 6, 7, 8].map(n => (
              <label key={n} className={'flex items-center gap-1 rounded-lg border px-2 py-1 text-sm ' + (sems.includes(n) ? 'border-brand-green bg-brand-greenLight' : 'border-slate-300')}>
                <input type="checkbox" checked={sems.includes(n)} onChange={() => toggleSem(n)} /> {n}
              </label>
            ))}
          </div>
          <p className="mt-1 text-xs text-slate-500">Leave all unticked to allow every semester.</p>
        </div>
        {Txt({ k: 'required_qualification', label: 'Required qualification', ph: 'e.g. Any degree' })}
        {Txt({ k: 'required_skills', label: 'Required skills', max: 300 })}
        {Txt({ k: 'min_percentage', label: 'Minimum marks / percentage (optional)', max: 6, ph: 'e.g. 60' })}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {Txt({ k: 'package_details', label: 'Salary / package', ph: 'e.g. 2.4 LPA' })}
          {Txt({ k: 'job_location', label: 'Job location' })}
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div><label className="mb-1 block text-sm font-medium">Application deadline</label>
            <input className="input" type="datetime-local" value={f.application_deadline} onChange={e => set('application_deadline', e.target.value)} /></div>
          <div><label className="mb-1 block text-sm font-medium">Recruitment date</label>
            <input className="input" type="datetime-local" value={f.drive_date} onChange={e => set('drive_date', e.target.value)} /></div>
        </div>
        {Txt({ k: 'venue', label: 'Venue' })}
        {Area({ k: 'selection_process', label: 'Selection process' })}
        {Area({ k: 'documents_required', label: 'Documents required', rows: 2 })}
        {Area({ k: 'instructions', label: 'Instructions', rows: 2 })}
        {Txt({ k: 'external_link', label: 'External application link (optional)', max: 300, ph: 'https://...' })}
        <div>
          <label className="mb-1 block text-sm font-medium">Attachment (optional)</label>
          {row?.attachment_path && !removeFile && !file && (
            <div className="mb-1 flex items-center gap-3 text-sm">
              <button type="button" className="text-brand-green underline" onClick={() => openAttachment(row.attachment_path).catch((e: any) => setErr(e.message))}>View current file</button>
              <button type="button" className="text-red-600 underline" onClick={() => setRemoveFile(true)}>Remove it</button>
            </div>
          )}
          {removeFile && <div className="mb-1 text-sm text-amber-700">The file will be deleted when you save.</div>}
          <input type="file" accept=".pdf,.png,.jpg,.jpeg,.webp" className="block w-full text-sm" onChange={e => pickFile(e.target.files?.[0] ?? null)} />
        </div>
        <label className="flex items-start gap-2 rounded-lg bg-slate-50 p-3 text-sm">
          <input type="checkbox" className="mt-1" checked={f.is_public} onChange={e => set('is_public', e.target.checked)} />
          <span><b>Show on the public home page.</b> Visitors see the company, job and dates only. Registration needs a student login.</span>
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
