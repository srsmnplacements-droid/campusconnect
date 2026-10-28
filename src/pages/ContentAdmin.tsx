import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/auth'
import Modal from '../components/Modal'
import { Spinner } from '../components/Layout'
import {
  CONTENT, Kind, catLabel, formatDate, isHttpUrl, uploadAttachment, removeAttachment,
  openAttachment, MAX_FILE, ALLOWED_TYPES,
} from '../lib/content'

const PAGE = 15
interface Year { id: string; label: string; is_current: boolean }

export default function ContentAdmin({ kind }: { kind: Kind }) {
  const cfg = CONTENT[kind]
  const { session } = useAuth()
  const [years, setYears] = useState<Year[]>([])
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
  const [editing, setEditing] = useState<any | null | undefined>(undefined) // undefined = closed, null = new
  const [reload, setReload] = useState(0)
  const [busyId, setBusyId] = useState('')

  useEffect(() => {
    supabase.from('academic_years').select('id, label, is_current').order('label', { ascending: false })
      .then(({ data }) => setYears((data as Year[]) ?? []))
  }, [])

  useEffect(() => {
    const t = setTimeout(() => { setDq(search); setPage(0) }, 300)
    return () => clearTimeout(t)
  }, [search])

  useEffect(() => {
    setLoading(true)
    let q: any = supabase.from(kind).select('*', { count: 'exact' }).order('created_at', { ascending: false })
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
  }, [kind, status, category, yearId, dq, page, reload])

  const yearLabel = (id: string | null) => years.find(y => y.id === id)?.label ?? ''

  async function changeStatus(r: any, next: 'draft' | 'published' | 'archived') {
    setBusyId(r.id); setError('')
    const patch: any = { status: next }
    if (next === 'published' && !r.published_at) patch.published_at = new Date().toISOString()
    const { error: e } = await supabase.from(kind).update(patch).eq('id', r.id)
    setBusyId('')
    if (e) setError(e.message); else setReload(n => n + 1)
  }

  async function remove(r: any) {
    if (!window.confirm('Permanently delete "' + r.title + '"' + (r.attachment_path ? ' and its attached file' : '') + '? This cannot be undone.')) return
    setBusyId(r.id); setError('')
    try {
      if (r.attachment_path) await removeAttachment(r.attachment_path)
      const { error: e } = await supabase.from(kind).delete().eq('id', r.id)
      if (e) throw new Error(e.message)
      setReload(n => n + 1)
    } catch (ex: any) { setError(ex.message) }
    setBusyId('')
  }

  async function openFile(path: string) {
    try { await openAttachment(path) } catch (ex: any) { setError(ex.message) }
  }

  const pages = Math.max(1, Math.ceil(total / PAGE))
  const badge = (s: string) => s === 'published' ? 'bg-green-100 text-green-800' : s === 'draft' ? 'bg-amber-100 text-amber-800' : 'bg-slate-200 text-slate-600'

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <Link to="/admin" className="text-sm text-brand-green">&larr; Dashboard</Link>
          <h1 className="text-2xl font-bold text-brand-navy">{cfg.heading}</h1>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link to={kind === 'notices' ? '/admin/resources' : '/admin/notices'} className="btn-outline">
            Go to {kind === 'notices' ? 'Resources' : 'Notices'}
          </Link>
          <button className="btn-green" onClick={() => setEditing(null)}>+ New {cfg.singular}</button>
        </div>
      </div>

      <div className="card space-y-3">
        <input className="input" placeholder="Search by title" value={search} onChange={e => setSearch(e.target.value)} />
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
          <select className="input" value={status} onChange={e => { setStatus(e.target.value); setPage(0) }}>
            <option value="">Any status</option>
            <option value="draft">Draft</option>
            <option value="published">Published</option>
            <option value="archived">Archived</option>
          </select>
          <select className="input" value={category} onChange={e => { setCategory(e.target.value); setPage(0) }}>
            <option value="">All categories</option>
            {cfg.categories.map(c => <option key={c[0]} value={c[0]}>{c[1]}</option>)}
          </select>
          <select className="input" value={yearId} onChange={e => { setYearId(e.target.value); setPage(0) }}>
            <option value="">All academic years</option>
            {years.map(y => <option key={y.id} value={y.id}>{y.label}</option>)}
          </select>
        </div>
      </div>

      {error && <div className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</div>}

      {loading ? <Spinner /> : rows.length === 0 ? (
        <div className="card text-slate-500">Nothing here yet. Tap "+ New {cfg.singular}" to add one.</div>
      ) : (
        <div className="space-y-2">
          <div className="text-sm text-slate-500">{total} item{total === 1 ? '' : 's'}</div>
          {rows.map(r => (
            <div key={r.id} className="card space-y-3">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-semibold text-brand-navy">{r.title}</span>
                  <span className={'rounded-full px-2 py-0.5 text-xs font-semibold ' + badge(r.status)}>{r.status}</span>
                  {r.is_public && <span className="rounded-full bg-blue-100 px-2 py-0.5 text-xs font-semibold text-blue-800">public</span>}
                </div>
                <div className="mt-1 text-sm text-slate-600">
                  {catLabel(kind, r.category)}
                  {yearLabel(r.academic_year_id) ? ' · ' + yearLabel(r.academic_year_id) : ''}
                  {r.published_at ? ' · ' + formatDate(r.published_at) : ''}
                </div>
                {r.attachment_path && (
                  <button className="mt-1 text-sm font-medium text-brand-green underline" onClick={() => openFile(r.attachment_path)}>
                    View attachment
                  </button>
                )}
              </div>
              <div className="flex flex-wrap gap-2">
                <button className="btn-outline !py-1.5" onClick={() => setEditing(r)}>Edit</button>
                {r.status !== 'published' && (
                  <button className="btn-green !py-1.5" disabled={busyId === r.id} onClick={() => changeStatus(r, 'published')}>Publish</button>
                )}
                {r.status === 'published' && (
                  <button className="btn-outline !py-1.5" disabled={busyId === r.id} onClick={() => changeStatus(r, 'draft')}>Unpublish</button>
                )}
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
        <Editor kind={kind} row={editing} years={years} userId={session?.user.id ?? null}
          onClose={() => setEditing(undefined)}
          onSaved={() => { setEditing(undefined); setReload(n => n + 1) }} />
      )}
    </div>
  )
}

function Editor({ kind, row, years, userId, onClose, onSaved }:
  { kind: Kind; row: any | null; years: Year[]; userId: string | null; onClose: () => void; onSaved: () => void }) {
  const cfg = CONTENT[kind]
  const current = years.find(y => y.is_current)
  const [title, setTitle] = useState(row?.title ?? '')
  const [text, setText] = useState(row?.[cfg.bodyField] ?? '')
  const [category, setCategory] = useState(row?.category ?? cfg.categories[0][0])
  const [yearId, setYearId] = useState<string>(row ? (row.academic_year_id ?? '') : (current?.id ?? ''))
  const [isPublic, setIsPublic] = useState<boolean>(row?.is_public ?? false)
  const [link, setLink] = useState(row?.external_link ?? '')
  const [file, setFile] = useState<File | null>(null)
  const [removeFile, setRemoveFile] = useState(false)
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)

  function pickFile(f: File | null) {
    setErr('')
    if (f && f.size > MAX_FILE) { setErr('File is too large. Maximum size is 5 MB.'); return }
    if (f && !ALLOWED_TYPES.includes(f.type)) { setErr('Only PDF, PNG, JPG or WEBP files are allowed.'); return }
    setFile(f)
  }

  async function save(statusOverride?: 'draft' | 'published') {
    setErr('')
    if (title.trim().length < 3 || title.trim().length > 200) { setErr('Title must be 3 to 200 characters.'); return }
    if (cfg.hasLink && link.trim() && !isHttpUrl(link.trim())) { setErr('The link must start with http:// or https://'); return }
    setBusy(true)
    const id: string = row?.id ?? crypto.randomUUID()
    const status: string = statusOverride ?? row?.status ?? 'draft'
    const now = new Date().toISOString()
    const oldPath: string | null = row?.attachment_path ?? null
    let newPath: string | null = oldPath
    let uploaded = false
    try {
      if (file) {
        const label = years.find(y => y.id === yearId)?.label ?? ''
        newPath = await uploadAttachment(file, kind, id, yearId || null, label)
        uploaded = true
      } else if (removeFile) {
        newPath = null
      }
      const payload: any = {
        title: title.trim(),
        [cfg.bodyField]: text.trim() || null,
        category,
        academic_year_id: yearId || null,
        is_public: isPublic,
        status,
        published_at: status === 'published' ? (row?.published_at ?? now) : (row?.published_at ?? null),
        attachment_path: newPath,
      }
      if (cfg.hasLink) payload.external_link = link.trim() || null

      let dbErr: any
      if (row) {
        ;({ error: dbErr } = await supabase.from(kind).update(payload).eq('id', id))
      } else {
        ;({ error: dbErr } = await supabase.from(kind).insert({ ...payload, id, created_by: userId }))
      }
      if (dbErr) {
        if (uploaded && newPath) await removeAttachment(newPath).catch(() => {})
        throw new Error(dbErr.message)
      }
      if (oldPath && oldPath !== newPath) await removeAttachment(oldPath).catch(() => {})
      if (row && newPath && newPath === oldPath) {
        await supabase.from('uploaded_files').update({ academic_year_id: yearId || null }).eq('path', newPath)
      }
      onSaved()
    } catch (ex: any) { setErr(ex.message) }
    setBusy(false)
  }

  return (
    <Modal title={row ? 'Edit ' + cfg.singular : 'New ' + cfg.singular} onClose={onClose}>
      <div className="space-y-3">
        <div>
          <label className="mb-1 block text-sm font-medium">Title</label>
          <input className="input" value={title} onChange={e => setTitle(e.target.value)} maxLength={200} />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium">{cfg.bodyLabel}</label>
          <textarea className="input min-h-[110px]" value={text} onChange={e => setText(e.target.value)} maxLength={5000} />
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-sm font-medium">Category</label>
            <select className="input" value={category} onChange={e => setCategory(e.target.value)}>
              {cfg.categories.map(c => <option key={c[0]} value={c[0]}>{c[1]}</option>)}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium">Academic year</label>
            <select className="input" value={yearId} onChange={e => setYearId(e.target.value)}>
              <option value="">Not specific to a year</option>
              {years.map(y => <option key={y.id} value={y.id}>{y.label}</option>)}
            </select>
          </div>
        </div>
        {cfg.hasLink && (
          <div>
            <label className="mb-1 block text-sm font-medium">External link (optional)</label>
            <input className="input" value={link} onChange={e => setLink(e.target.value)} placeholder="https://..." inputMode="url" />
          </div>
        )}
        <div>
          <label className="mb-1 block text-sm font-medium">Attachment (optional)</label>
          {row?.attachment_path && !removeFile && !file && (
            <div className="mb-1 flex items-center gap-3 text-sm">
              <span className="text-slate-600">A file is attached.</span>
              <button type="button" className="text-red-600 underline" onClick={() => setRemoveFile(true)}>Remove it</button>
            </div>
          )}
          {removeFile && <div className="mb-1 text-sm text-amber-700">The file will be deleted when you save.</div>}
          <input type="file" accept=".pdf,.png,.jpg,.jpeg,.webp" className="block w-full text-sm"
            onChange={e => pickFile(e.target.files?.[0] ?? null)} />
          <p className="mt-1 text-xs text-slate-500">PDF, PNG, JPG or WEBP. Maximum 5 MB. A new file replaces the old one.</p>
        </div>
        <label className="flex items-start gap-2 rounded-lg bg-slate-50 p-3 text-sm">
          <input type="checkbox" className="mt-1" checked={isPublic} onChange={e => setIsPublic(e.target.checked)} />
          <span><b>Show on the public home page.</b> Anyone can read the text without logging in. Attachments stay private to logged-in students.</span>
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
